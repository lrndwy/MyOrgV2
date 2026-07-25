package logout

import (
	"backend/internal/auth"

	"github.com/lrndwy/gokil/views"
)

func POST(ctx *views.Context) error {
	auth.ClearTokenCookie(ctx)
	return ctx.Success(200, "logout success", nil)
}
