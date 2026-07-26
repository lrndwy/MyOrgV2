package folders

import (
	"backend/internal/auth"
	"backend/internal/permission"
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
		folders, err := services.StorageService{}.ListFolders(c.Request.Context())
		if err != nil {
			return c.Error(500, err.Error())
		}
		return c.Success(200, "storage folders", folders)
	})(ctx)
}

func POST(ctx *views.Context) error {
	return auth.RequireAuth(func(c *views.Context) error {
		user, _ := auth.CurrentUser(c.Request.Context())
		ok, _ := permission.UserHas(c, user, "storage.manage")
		if !ok {
			return c.Error(403, "forbidden")
		}
		var body struct {
			Name     string `json:"name"`
			ParentID *int64 `json:"parent_id"`
		}
		if err := c.Bind(&body); err != nil {
			return c.Error(400, err.Error())
		}
		if body.Name == "" {
			return c.Error(400, "name is required")
		}
		folder, err := services.StorageService{}.CreateFolder(c.Request.Context(), &models.StorageFolder{
			Name:     body.Name,
			ParentID: body.ParentID,
		})
		if err != nil {
			return c.Error(500, err.Error())
		}
		return c.Success(201, "folder created", folder)
	})(ctx)
}
