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
		ok, _ := permission.UserHas(c, user, "finance.wallets.manage")
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
		allowed := map[string]bool{"name": true, "description": true, "initial_balance": true, "is_active": true}
		values := map[string]any{}
		for k, v := range body {
			if allowed[k] {
				values[k] = v
			}
		}
		w, err := services.FinanceService{}.UpdateWallet(c.Request.Context(), id, values)
		if err != nil {
			return c.Error(500, err.Error())
		}
		return c.Success(200, "wallet updated", w)
	})(ctx)
}

func DELETE(ctx *views.Context) error {
	return auth.RequireAuth(func(c *views.Context) error {
		user, _ := auth.CurrentUser(c.Request.Context())
		ok, _ := permission.UserHas(c, user, "finance.wallets.manage")
		if !ok {
			return c.Error(403, "forbidden")
		}
		id, err := models.ParseID(c.Param("id"))
		if err != nil {
			return c.Error(400, "invalid id")
		}
		if err := (services.FinanceService{}).DeleteWallet(c.Request.Context(), id); err != nil {
			return c.Error(400, err.Error())
		}
		services.LogActivity(c.Request.Context(), user.ID, "delete", "wallet", id,
			"Menghapus wallet", c.Request.RemoteAddr)
		return c.Success(200, "wallet deleted", nil)
	})(ctx)
}
