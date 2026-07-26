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
	"backend/internal/storageutil"
	"backend/services"

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
	raw, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return ctx.Error(500, err.Error())
	}
	buf := &bytes.Buffer{}
	zw := zip.NewWriter(buf)
	w, err := zw.Create("data.json")
	if err != nil {
		return ctx.Error(500, err.Error())
	}
	if _, err := w.Write(raw); err != nil {
		return ctx.Error(500, err.Error())
	}

	written := map[string]bool{}
	type missingFile struct {
		Key string `json:"key"`
		URL string `json:"url"`
	}
	missing := []missingFile{}
	storageRoot := storageRootPath()

	// 1) Semua file yang dirujuk kolom URL di database — bekerja untuk
	//    provider lokal maupun S3/MinIO (dibaca lewat URL-nya).
	for key, url := range (services.BackupService{}).CollectFileRefs(payload) {
		name := "storage/" + key
		if written[name] {
			continue
		}
		data, err := storageutil.ReadURL(reqCtx, url)
		if err != nil {
			// Fallback: coba baca langsung dari disk lokal (mis. base URL
			// menunjuk host publik yang tidak bisa diakses dari server).
			data, err = os.ReadFile(filepath.Join(storageRoot, filepath.FromSlash(key)))
		}
		if err != nil {
			// File dirujuk database tapi tidak ditemukan di storage —
			// catat di manifest agar terlihat, jangan gagalkan backup.
			missing = append(missing, missingFile{Key: key, URL: url})
			continue
		}
		fw, err := zw.Create(name)
		if err != nil {
			continue
		}
		if _, err := fw.Write(data); err == nil {
			written[name] = true
		}
	}

	// 2) Sapu direktori storage lokal (provider lokal) untuk file yang tidak
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

	// 3) Manifest: transparan soal apa yang ikut dan apa yang tidak ditemukan,
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
	if len(dataJSON) > 0 {
		var payload map[string]json.RawMessage
		if err := json.Unmarshal(dataJSON, &payload); err != nil {
			return ctx.Error(400, "data.json tidak valid: "+err.Error())
		}
		dbStats, err = services.BackupService{}.RestoreJSON(reqCtx, payload)
		if err != nil {
			return ctx.Error(500, err.Error())
		}
	}

	services.LogActivity(reqCtx, user.ID, "restore", "backup", 0,
		"Memulihkan backup sistem", ctx.Request.RemoteAddr)
	return ctx.Success(200, "backup restored", map[string]any{
		"files_restored": filesRestored,
		"files_failed":   filesFailed,
		"database":       dbStats,
	})
}
