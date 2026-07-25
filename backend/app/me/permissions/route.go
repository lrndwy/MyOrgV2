package permissions

import (
	"backend/internal/auth"
	"backend/internal/permission"

	"github.com/lrndwy/gokil/views"
)

func GET(ctx *views.Context) error {
	return auth.RequireAuth(getPermissions)(ctx)
}

func getPermissions(ctx *views.Context) error {
	user, _ := auth.CurrentUser(ctx.Request.Context())
	codes, err := permission.ListCodes(ctx, user)
	if err != nil {
		return ctx.Error(500, err.Error())
	}
	return ctx.Success(200, "permissions", codes)
}
