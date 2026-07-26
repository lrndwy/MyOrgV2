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
		ok, _ := permission.UserHas(c, user, "attendance.approve")
		if !ok {
			return c.Error(403, "forbidden")
		}
		id, err := models.ParseID(c.Param("id"))
		if err != nil {
			return c.Error(400, "invalid id")
		}
		var body struct {
			Action string `json:"action"`
			Note   string `json:"note"`
		}
		if err := c.Bind(&body); err != nil {
			return c.Error(400, err.Error())
		}
		approve := body.Action == "approve"
		pr, err := services.PermissionRequestService{}.Review(c.Request.Context(), id, user.ID, approve, body.Note)
		if err != nil {
			return c.Error(400, err.Error())
		}
		return c.Success(200, "permission reviewed", pr)
	})(ctx)
}

func DELETE(ctx *views.Context) error {
	return auth.RequireAuth(func(c *views.Context) error {
		user, _ := auth.CurrentUser(c.Request.Context())
		ok, _ := permission.UserHas(c, user, "attendance.approve")
		if !ok {
			return c.Error(403, "forbidden")
		}
		id, err := models.ParseID(c.Param("id"))
		if err != nil {
			return c.Error(400, "invalid id")
		}
		if err := (services.PermissionRequestService{}).Delete(c.Request.Context(), id); err != nil {
			return c.Error(400, err.Error())
		}
		services.LogActivity(c.Request.Context(), user.ID, "delete", "permission_request", id,
			"Menghapus pengajuan izin", c.Request.RemoteAddr)
		return c.Success(200, "permission request deleted", nil)
	})(ctx)
}
