package backup

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"io"
	"os"
	"path/filepath"
	"strings"

	"backend/internal/auth"
	"backend/internal/permission"
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
	payload, err := services.BackupService{}.ExportJSON(ctx.Request.Context())
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
	storageRoot := storageRootPath()
	_ = filepath.Walk(storageRoot, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return nil
		}
		rel, err := filepath.Rel(storageRoot, path)
		if err != nil {
			return nil
		}
		fw, err := zw.Create("storage/" + filepath.ToSlash(rel))
		if err != nil {
			return nil
		}
		f, err := os.Open(path)
		if err != nil {
			return nil
		}
		defer f.Close()
		_, _ = io.Copy(fw, f)
		return nil
	})
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
	storageRoot, err := filepath.Abs(storageRootPath())
	if err != nil {
		return ctx.Error(500, err.Error())
	}
	filesRestored := 0
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
		if strings.HasPrefix(f.Name, "storage/") {
			rel := strings.TrimPrefix(f.Name, "storage/")
			dest := filepath.Join(storageRoot, filepath.FromSlash(rel))
			// Tolak entry zip yang mencoba keluar dari storage root (zip-slip).
			if dest != storageRoot && !strings.HasPrefix(dest, storageRoot+string(os.PathSeparator)) {
				continue
			}
			rc, err := f.Open()
			if err != nil {
				continue
			}
			_ = os.MkdirAll(filepath.Dir(dest), 0o755)
			out, err := os.Create(dest)
			if err == nil {
				_, _ = io.Copy(out, rc)
				out.Close()
				filesRestored++
			}
			rc.Close()
		}
	}

	dbStats := map[string]int{}
	if len(dataJSON) > 0 {
		var payload map[string]json.RawMessage
		if err := json.Unmarshal(dataJSON, &payload); err != nil {
			return ctx.Error(400, "data.json tidak valid: "+err.Error())
		}
		dbStats, err = services.BackupService{}.RestoreJSON(ctx.Request.Context(), payload)
		if err != nil {
			return ctx.Error(500, err.Error())
		}
	}

	services.LogActivity(ctx.Request.Context(), user.ID, "restore", "backup", 0,
		"Memulihkan backup sistem", ctx.Request.RemoteAddr)
	return ctx.Success(200, "backup restored", map[string]any{
		"files_restored": filesRestored,
		"database":       dbStats,
	})
}
