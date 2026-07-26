package id

import (
	"backend/internal/auth"
	"backend/internal/permission"
	"backend/models"
	"backend/services"

	"github.com/lrndwy/gokil/views"
)

func PUT(ctx *views.Context) error {
	return auth.RequireAuth(func(c *views.Context) error {
		user, _ := auth.CurrentUser(c.Request.Context())
		ok, _ := permission.UserHas(c, user, "storage.manage")
		if !ok {
			return c.Error(403, "forbidden")
		}
		id, err := models.ParseID(c.Param("id"))
		if err != nil {
			return c.Error(400, "invalid id")
		}
		var body struct {
			FolderID *int64 `json:"folder_id"`
		}
		if err := c.Bind(&body); err != nil {
			return c.Error(400, err.Error())
		}
		f, err := services.StorageService{}.MoveFile(c.Request.Context(), id, body.FolderID)
		if err != nil {
			return c.Error(400, err.Error())
		}
		return c.Success(200, "file moved", f)
	})(ctx)
}

func DELETE(ctx *views.Context) error {
	return auth.RequireAuth(func(c *views.Context) error {
		user, _ := auth.CurrentUser(c.Request.Context())
		ok, _ := permission.UserHas(c, user, "storage.manage")
		if !ok {
			return c.Error(403, "forbidden")
		}
		id, err := models.ParseID(c.Param("id"))
		if err != nil {
			return c.Error(400, "invalid id")
		}
		if err := (services.StorageService{}).DeleteFile(c.Request.Context(), id); err != nil {
			return c.Error(500, err.Error())
		}
		return c.Success(200, "file deleted", nil)
	})(ctx)
}
