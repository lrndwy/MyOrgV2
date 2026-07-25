package password

import (
	"backend/internal/auth"
	"backend/services"

	"github.com/lrndwy/gokil/views"
)

func PUT(ctx *views.Context) error {
	return auth.RequireAuth(putPassword)(ctx)
}

func putPassword(ctx *views.Context) error {
	user, _ := auth.CurrentUser(ctx.Request.Context())
	var body struct {
		OldPassword string `json:"old_password"`
		NewPassword string `json:"new_password"`
	}
	if err := ctx.Bind(&body); err != nil {
		return ctx.Error(400, err.Error())
	}
	if err := (services.ProfileService{}).ChangePassword(ctx.Request.Context(), user.ID, body.OldPassword, body.NewPassword); err != nil {
		return ctx.Error(400, err.Error())
	}
	return ctx.Success(200, "password updated", nil)
}
