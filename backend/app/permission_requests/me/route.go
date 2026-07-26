package me

import (
	"backend/internal/auth"
	"backend/internal/permission"
	"backend/services"

	"github.com/lrndwy/gokil/views"
)

func GET(ctx *views.Context) error {
	return auth.RequireAuth(func(c *views.Context) error {
		user, _ := auth.CurrentUser(c.Request.Context())
		ok, _ := permission.UserHas(c, user, "permission.submit")
		if !ok {
			return c.Error(403, "forbidden")
		}
		list, err := services.PermissionRequestService{}.ListMineDetailed(c.Request.Context(), user.ID)
		if err != nil {
			return c.Error(500, err.Error())
		}
		return c.Success(200, "my permission requests", list)
	})(ctx)
}
