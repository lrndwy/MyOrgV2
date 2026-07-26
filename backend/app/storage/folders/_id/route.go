package id

import (
	"backend/internal/auth"
	"backend/internal/permission"
	"backend/models"
	"backend/services"

	"github.com/lrndwy/gokil/views"
)

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
		if err := (services.StorageService{}).DeleteFolder(c.Request.Context(), id); err != nil {
			return c.Error(500, err.Error())
		}
		services.LogActivity(c.Request.Context(), user.ID, "delete", "storage_folder", id,
			"Menghapus folder penyimpanan beserta isinya", c.Request.RemoteAddr)
		return c.Success(200, "folder deleted", nil)
	})(ctx)
}
