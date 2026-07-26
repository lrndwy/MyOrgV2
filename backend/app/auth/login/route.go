package login

import (
	"backend/internal/auth"
	"backend/services"

	"github.com/lrndwy/gokil/views"
)

func POST(ctx *views.Context) error {
	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if err := ctx.Bind(&body); err != nil {
		return ctx.Error(400, err.Error())
	}
	result, err := services.AuthService{}.Login(ctx.Request.Context(), body.Username, body.Password)
	if err != nil {
		return ctx.Error(401, err.Error())
	}
	services.LogActivity(ctx.Request.Context(), result.User["id"].(int64), "login", "auth", result.User["id"].(int64),
		"Login berhasil", ctx.Request.RemoteAddr)
	auth.SetTokenCookie(ctx, result.Token)
	return ctx.Success(200, "login success", result)
}
