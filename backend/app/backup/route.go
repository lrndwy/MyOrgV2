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

func exportBackup(ctx *views.Context) error {
	user, _ := auth.CurrentUser(ctx.Request.Context())
	ok, _ := permission.UserHas(ctx, user, "backup.manage")
	if !ok {
		return ctx.Error(403, "forbidden")
	}
	reqCtx := ctx.Request.Context()
	payload := map[string]any{}
	tables := []struct {
		key string
		fn  func() (any, error)
	}{
		{"permissions", func() (any, error) { return orm.Objects[models.Permission](reqCtx).All() }},
		{"roles", func() (any, error) { return orm.Objects[models.Role](reqCtx).All() }},
		{"role_permissions", func() (any, error) { return orm.Objects[models.RolePermission](reqCtx).All() }},
		{"divisions", func() (any, error) { return orm.Objects[models.Division](reqCtx).All() }},
		{"letter_categories", func() (any, error) { return orm.Objects[models.LetterCategory](reqCtx).All() }},
		{"letter_templates", func() (any, error) { return orm.Objects[models.LetterTemplate](reqCtx).All() }},
		{"organization_settings", func() (any, error) { return orm.Objects[models.OrganizationSettings](reqCtx).All() }},
		{"users", func() (any, error) { return orm.Objects[models.User](reqCtx).All() }},
		{"events", func() (any, error) { return orm.Objects[models.Event](reqCtx).All() }},
		{"letters", func() (any, error) { return orm.Objects[models.Letter](reqCtx).All() }},
		{"announcements", func() (any, error) { return orm.Objects[models.Announcement](reqCtx).All() }},
		{"finance_categories", func() (any, error) { return orm.Objects[models.FinanceCategory](reqCtx).All() }},
		{"finance_transactions", func() (any, error) { return orm.Objects[models.FinanceTransaction](reqCtx).All() }},
		{"violation_types", func() (any, error) { return orm.Objects[models.ViolationType](reqCtx).All() }},
		{"storage_folders", func() (any, error) { return orm.Objects[models.StorageFolder](reqCtx).All() }},
		{"storage_files", func() (any, error) { return orm.Objects[models.StorageFile](reqCtx).All() }},
	}
	for _, t := range tables {
		data, err := t.fn()
		if err != nil {
			return ctx.Error(500, err.Error())
		}
		payload[t.key] = data
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
	storageRoot := os.Getenv("GOKIL_STORAGE_LOCAL_PATH")
	if storageRoot == "" {
		storageRoot = "storage"
	}
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
	storageRoot := os.Getenv("GOKIL_STORAGE_LOCAL_PATH")
	if storageRoot == "" {
		storageRoot = "storage"
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
			rc, err := f.Open()
			if err != nil {
				continue
			}
			dest := filepath.Join(storageRoot, filepath.FromSlash(strings.TrimPrefix(f.Name, "storage/")))
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
		if err := json.Unmarshal(dataJSON, &payload); err == nil {
			dbStats, err = services.BackupService{}.RestoreJSON(ctx.Request.Context(), payload)
			if err != nil {
				return ctx.Error(500, err.Error())
			}
		}
	}

	return ctx.Success(200, "backup restored", map[string]any{
		"files_restored": filesRestored,
		"database":       dbStats,
	})
}
