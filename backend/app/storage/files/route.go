package files

import (
	"io"
	"strings"

	"backend/internal/auth"
	"backend/internal/permission"
	"backend/internal/storageutil"
	"backend/models"
	"backend/services"

	"github.com/lrndwy/gokil/views"
)

func GET(ctx *views.Context) error {
	return auth.RequireAuth(func(c *views.Context) error {
		user, _ := auth.CurrentUser(c.Request.Context())
		ok, _ := permission.UserHas(c, user, "storage.view")
		if !ok {
			return c.Error(403, "forbidden")
		}
		var folderID *int64
		if v := c.Query("folder_id"); v != "" {
			id, err := models.ParseID(v)
			if err == nil {
				folderID = &id
			}
		}
		files, err := services.StorageService{}.ListFiles(c.Request.Context(), folderID)
		if err != nil {
			return c.Error(500, err.Error())
		}
		return c.Success(200, "storage files", files)
	})(ctx)
}

func POST(ctx *views.Context) error {
	return auth.RequireAuth(func(c *views.Context) error {
		user, _ := auth.CurrentUser(c.Request.Context())
		ok, _ := permission.UserHas(c, user, "storage.manage")
		if !ok {
			return c.Error(403, "forbidden")
		}
		if err := c.ParseMultipart(50 << 20); err != nil {
			return c.Error(400, err.Error())
		}
		file, hdr, err := c.Request.FormFile("file")
		if err != nil {
			return c.Error(400, "file is required")
		}
		defer file.Close()

		data, err := io.ReadAll(file)
		if err != nil {
			return c.Error(500, err.Error())
		}

		key := storageutil.Key("storage", hdr.Filename)
		url, err := storageutil.Upload(c.Request.Context(), key, data, hdr.Header.Get("Content-Type"))
		if err != nil {
			return c.Error(500, err.Error())
		}

		var folderID *int64
		if v := c.Request.FormValue("folder_id"); v != "" {
			id, err := models.ParseID(v)
			if err == nil {
				folderID = &id
			}
		}

		f, err := services.StorageService{}.CreateFile(c.Request.Context(), &models.StorageFile{
			Name:        hdr.Filename,
			FileURL:     url,
			MimeType:    hdr.Header.Get("Content-Type"),
			SizeBytes:   hdr.Size,
			FolderID:    folderID,
			CreatedByID: user.ID,
		})
		if err != nil {
			return c.Error(500, err.Error())
		}
		return c.Success(201, "file uploaded", f)
	})(ctx)
}

func fileExt(name string) string {
	if i := strings.LastIndex(name, "."); i >= 0 {
		return name[i:]
	}
	return ""
}
