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
		ok, _ := permission.UserHas(c, user, "violations.manage")
		if !ok {
			return c.Error(403, "forbidden")
		}
		id, err := models.ParseID(c.Param("id"))
		if err != nil {
			return c.Error(400, "invalid id")
		}
		var body map[string]any
		if err := c.Bind(&body); err != nil {
			return c.Error(400, err.Error())
		}
		v, err := services.ViolationTypeService{}.Update(c.Request.Context(), id, body)
		if err != nil {
			return c.Error(500, err.Error())
		}
		services.LogActivity(c.Request.Context(), user.ID, "update", "violation_type", id,
			"Mengubah tipe pelanggaran", c.Request.RemoteAddr)
		return c.Success(200, "violation type updated", v)
	})(ctx)
}

func DELETE(ctx *views.Context) error {
	return auth.RequireAuth(func(c *views.Context) error {
		user, _ := auth.CurrentUser(c.Request.Context())
		ok, _ := permission.UserHas(c, user, "violations.manage")
		if !ok {
			return c.Error(403, "forbidden")
		}
		id, err := models.ParseID(c.Param("id"))
		if err != nil {
			return c.Error(400, "invalid id")
		}
		svc := services.ViolationTypeService{}
		if err := svc.Delete(c.Request.Context(), id); err != nil {
			return c.Error(500, err.Error())
		}
		services.LogActivity(c.Request.Context(), user.ID, "delete", "violation_type", id,
			"Menghapus tipe pelanggaran", c.Request.RemoteAddr)
		return c.Success(200, "violation type deleted", nil)
	})(ctx)
}
