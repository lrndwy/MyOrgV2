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
		ok, _ := permission.UserHas(c, user, "finance.categories.manage")
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
		cat, err := services.FinanceService{}.UpdateCategory(c.Request.Context(), id, body)
		if err != nil {
			return c.Error(500, err.Error())
		}
		services.LogActivity(c.Request.Context(), user.ID, "update", "finance_category", id,
			"Memperbarui kategori keuangan", c.Request.RemoteAddr)
		return c.Success(200, "category updated", cat)
	})(ctx)
}

func DELETE(ctx *views.Context) error {
	return auth.RequireAuth(func(c *views.Context) error {
		user, _ := auth.CurrentUser(c.Request.Context())
		ok, _ := permission.UserHas(c, user, "finance.categories.manage")
		if !ok {
			return c.Error(403, "forbidden")
		}
		id, err := models.ParseID(c.Param("id"))
		if err != nil {
			return c.Error(400, "invalid id")
		}
		if err := (services.FinanceService{}).DeleteCategory(c.Request.Context(), id); err != nil {
			return c.Error(500, err.Error())
		}
		services.LogActivity(c.Request.Context(), user.ID, "delete", "finance_category", id,
			"Menghapus kategori keuangan", c.Request.RemoteAddr)
		return c.Success(200, "category deleted", nil)
	})(ctx)
}
