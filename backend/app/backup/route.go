package backup

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"io"
	"mime"
	"os"
	"path/filepath"
	"strings"

	"backend/internal/auth"
	"backend/internal/permission"
	"backend/internal/seed"
	"backend/internal/storageutil"
	"backend/models"
	"backend/services"

	"github.com/lrndwy/gokil/orm"
	"github.com/lrndwy/gokil/views"
)

func GET(ctx *views.Context) error {
	return auth.RequireAuth(exportBackup)(ctx)
}

func POST(ctx *views.Context) error {
	return auth.RequireAuth(importBackup)(ctx)
}

func storageRootPath() string {
	root := os.Getenv("GOKIL_STORAGE_LOCAL_PATH")
	if root == "" {
		root = "storage"
	}
	return root
}

func exportBackup(ctx *views.Context) error {
	user, _ := auth.CurrentUser(ctx.Request.Context())
	ok, _ := permission.UserHas(ctx, user, "backup.manage")
	if !ok {
		return ctx.Error(403, "forbidden")
	}
	reqCtx := ctx.Request.Context()
	payload, err := services.BackupService{}.ExportJSON(reqCtx)
	if err != nil {
		return ctx.Error(500, err.Error())
	}
	buf := &bytes.Buffer{}
	zw := zip.NewWriter(buf)

	written := map[string]bool{}
	type missingFile struct {
		Key string `json:"key"`
		URL string `json:"url"`
	}
	missing := []missingFile{}
	storageRoot := storageRootPath()

	// resolved memetakan nilai kolom apa adanya di DB -> key yang benar-benar
	// berhasil dibaca. Dipakai dua kali: sebagai nama entri ZIP dan untuk
	// menulis ulang data.json agar tidak lagi membawa base URL deployment ini.
	resolved := map[string]string{}

	// 1) Semua file yang dirujuk kolom URL di database — bekerja untuk
	//    provider lokal maupun S3/MinIO (dibaca lewat URL-nya). URL bisa berasal
	//    dari era storage lain (bucket/base URL berbeda), jadi tiap kandidat key
	//    dicoba dan yang benar-benar ada yang dipakai — bukan menebak.
	for _, ref := range services.CollectFileRefs(payload) {
		var content []byte
		var key string

		// Baca lewat nilai tersimpannya dulu (key -> provider, URL absolut ->
		// GET langsung, /storage/<key> -> disk).
		if data, err := storageutil.ReadStored(reqCtx, ref.Value); err == nil {
			content, key = data, ref.Keys[0]
		}
		// Fallback: cari langsung di disk untuk tiap kandidat key. Ini yang
		// menyelamatkan URL absolut mati (base lama) yang filenya masih ada
		// di volume, dan file era provider local.
		if content == nil {
			for _, candidate := range ref.Keys {
				data, err := os.ReadFile(filepath.Join(storageRoot, filepath.FromSlash(candidate)))
				if err == nil {
					content, key = data, candidate
					break
				}
			}
		}
		if content == nil {
			// File dirujuk database tapi tidak ditemukan di storage —
			// catat di manifest agar terlihat, jangan gagalkan backup.
			missing = append(missing, missingFile{Key: ref.Keys[0], URL: ref.Value})
			continue
		}
		resolved[ref.Value] = key

		name := "storage/" + key
		if written[name] {
			continue
		}
		fw, err := zw.Create(name)
		if err != nil {
			continue
		}
		if _, err := fw.Write(content); err == nil {
			written[name] = true
		}
	}

	// 2) data.json hanya memuat key storage. Nilai absolut era lama ditulis
	//    ulang memakai hasil resolusi di atas (key yang benar-benar terbaca),
	//    jadi ZIP tidak membawa base URL deployment ini dan restore di
	//    deployment/domain lain tetap benar. Nilai yang tidak teresolusi
	//    dibiarkan utuh (tautan luar) dan tetap tercatat di manifest.
	rawPayload := map[string]json.RawMessage{}
	for k, v := range payload {
		b, err := json.Marshal(v)
		if err != nil {
			return ctx.Error(500, err.Error())
		}
		rawPayload[k] = b
	}
	if _, err := services.NormalizeStoragePaths(rawPayload, func(value string) (string, bool) {
		key, ok := resolved[value]
		return key, ok
	}); err != nil {
		return ctx.Error(500, err.Error())
	}
	raw, err := json.MarshalIndent(rawPayload, "", "  ")
	if err != nil {
		return ctx.Error(500, err.Error())
	}
	w, err := zw.Create("data.json")
	if err != nil {
		return ctx.Error(500, err.Error())
	}
	if _, err := w.Write(raw); err != nil {
		return ctx.Error(500, err.Error())
	}

	// 3) Sapu direktori storage lokal (provider lokal) untuk file yang tidak
	//    terekam di kolom URL mana pun.
	_ = filepath.Walk(storageRoot, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return nil
		}
		rel, err := filepath.Rel(storageRoot, path)
		if err != nil {
			return nil
		}
		name := "storage/" + filepath.ToSlash(rel)
		if written[name] {
			return nil
		}
		fw, err := zw.Create(name)
		if err != nil {
			return nil
		}
		f, err := os.Open(path)
		if err != nil {
			return nil
		}
		defer f.Close()
		if _, err := io.Copy(fw, f); err == nil {
			written[name] = true
		}
		return nil
	})

	// 4) Manifest: transparan soal apa yang ikut dan apa yang tidak ditemukan,
	//    supaya file hilang tidak lolos tanpa terdeteksi.
	manifest := map[string]any{
		"files_included": len(written),
		"files_missing":  missing,
	}
	if mw, err := zw.Create("manifest.json"); err == nil {
		if raw, err := json.MarshalIndent(manifest, "", "  "); err == nil {
			_, _ = mw.Write(raw)
		}
	}

	if err := zw.Close(); err != nil {
		return ctx.Error(500, err.Error())
	}
	ctx.Writer.Header().Set("Content-Type", "application/zip")
	ctx.Writer.Header().Set("Content-Disposition", `attachment; filename="myorg-backup.zip"`)
	ctx.Writer.WriteHeader(200)
	_, _ = ctx.Writer.Write(buf.Bytes())
	return nil
}

func importBackup(ctx *views.Context) error {
	user, _ := auth.CurrentUser(ctx.Request.Context())
	ok, _ := permission.UserHas(ctx, user, "backup.manage")
	if !ok {
		return ctx.Error(403, "forbidden")
	}
	if err := ctx.ParseMultipart(200 << 20); err != nil {
		return ctx.Error(400, err.Error())
	}
	// Mode dibaca setelah ParseMultipart agar field form multipart terbaca:
	// "merge" menimpa tanpa mengosongkan tabel, default "replace".
	mode := services.ParseRestoreMode(ctx.Request.FormValue("mode"))
	file, _, err := ctx.FormFile("file")
	if err != nil {
		return ctx.Error(400, "file required")
	}
	defer file.Close()
	data, err := io.ReadAll(file)
	if err != nil {
		return ctx.Error(500, err.Error())
	}
	zr, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return ctx.Error(400, "invalid zip")
	}
	reqCtx := ctx.Request.Context()
	filesRestored := 0
	filesFailed := 0
	knownKeys := map[string]struct{}{}
	var dataJSON []byte
	for _, f := range zr.File {
		if f.Name == "data.json" {
			rc, err := f.Open()
			if err == nil {
				dataJSON, _ = io.ReadAll(rc)
				rc.Close()
			}
			continue
		}
		if !strings.HasPrefix(f.Name, "storage/") || f.FileInfo().IsDir() {
			continue
		}
		key := strings.TrimPrefix(f.Name, "storage/")
		// Tolak entry yang mencoba keluar dari storage root (zip-slip).
		if key == "" || strings.Contains(key, "..") || strings.HasPrefix(key, "/") {
			continue
		}
		knownKeys[key] = struct{}{}
		rc, err := f.Open()
		if err != nil {
			filesFailed++
			continue
		}
		content, err := io.ReadAll(rc)
		rc.Close()
		if err != nil {
			filesFailed++
			continue
		}
		contentType := mime.TypeByExtension(filepath.Ext(key))
		if contentType == "" {
			contentType = "application/octet-stream"
		}
		// Upload ke provider storage aktif (lokal maupun S3/MinIO), sehingga
		// restore berfungsi apa pun konfigurasi storage-nya.
		if _, err := storageutil.Upload(reqCtx, key, content, contentType); err != nil {
			filesFailed++
		} else {
			filesRestored++
		}
	}

	dbStats := map[string]int{}
	skipped := map[string]int{}
	urlsRewritten := 0
	if len(dataJSON) > 0 {
		var payload map[string]json.RawMessage
		if err := json.Unmarshal(dataJSON, &payload); err != nil {
			return ctx.Error(400, "data.json tidak valid: "+err.Error())
		}
		// Kolom file di DB hanya berisi key. ZIP lama masih membawa URL
		// absolut (atau "/storage/<key>" era provider local); keduanya
		// dinormalkan ke key dulu, jadi restore dari backup era/domain lain
		// tetap masuk sebagai path dan URL-nya dirakit dari env saat response.
		urlsRewritten, err = services.NormalizeStoragePaths(payload, services.KnownKeyResolver(knownKeys))
		if err != nil {
			return ctx.Error(400, "normalisasi path storage: "+err.Error())
		}
		if mode == services.RestoreMerge {
			dbStats, skipped, err = services.BackupService{}.RestoreJSONMerge(reqCtx, payload)
		} else {
			dbStats, err = services.BackupService{}.RestoreJSON(reqCtx, payload)
		}
		if err != nil {
			return ctx.Error(500, err.Error())
		}
		if err := seed.SyncMissingPermissions(reqCtx); err != nil {
			return ctx.Error(500, "sync permissions: "+err.Error())
		}
		if err := seed.SyncMissingSeedData(reqCtx); err != nil {
			return ctx.Error(500, "sync seed data: "+err.Error())
		}
	}

	if _, err := orm.GetByID[models.User](reqCtx, user.ID); err == nil {
		action := "Memulihkan backup sistem"
		if mode == services.RestoreMerge {
			action = "Menggabungkan backup sistem (mode merge)"
		}
		services.LogActivity(reqCtx, user.ID, "restore", "backup", 0,
			action, ctx.Request.RemoteAddr)
	}
	return ctx.Success(200, "backup restored", map[string]any{
		"mode":           string(mode),
		"files_restored": filesRestored,
		"files_failed":   filesFailed,
		"urls_rewritten": urlsRewritten,
		"database":       dbStats,
		"skipped":        skipped,
	})
}
