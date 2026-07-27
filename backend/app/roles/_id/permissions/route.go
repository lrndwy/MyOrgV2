package permissions

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
		ok, _ := permission.UserHas(c, user, "roles.view")
		if !ok {
			return c.Error(403, "forbidden")
		}
		id, err := models.ParseID(c.Param("id"))
		if err != nil {
			return c.Error(400, "invalid id")
		}
		all, assigned, err := services.RoleService{}.GetPermissions(c.Request.Context(), id)
		if err != nil {
			return c.Error(500, err.Error())
		}
		return c.Success(200, "role permissions", map[string]any{
			"permissions": all, "assigned_ids": assigned,
		})
	})(ctx)
}

func PUT(ctx *views.Context) error {
	return auth.RequireAuth(func(c *views.Context) error {
		user, _ := auth.CurrentUser(c.Request.Context())
		ok, _ := permission.UserHas(c, user, "roles.edit")
		if !ok {
			return c.Error(403, "forbidden")
		}
		id, err := models.ParseID(c.Param("id"))
		if err != nil {
			return c.Error(400, "invalid id")
		}
		var body struct {
			PermissionIDs []int64 `json:"permission_ids"`
		}
		if err := c.Bind(&body); err != nil {
			return c.Error(400, err.Error())
		}
		if err := (services.RoleService{}).ReplacePermissions(c.Request.Context(), id, body.PermissionIDs); err != nil {
			return c.Error(500, err.Error())
		}
		services.LogActivity(c.Request.Context(), user.ID, "update", "role", id,
			"Mengubah permission role", c.Request.RemoteAddr)
		return c.Success(200, "permissions updated", nil)
	})(ctx)
}
