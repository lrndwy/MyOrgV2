package me

import (
	"backend/internal/auth"
	"backend/services"

	"github.com/lrndwy/gokil/views"
)

func GET(ctx *views.Context) error {
	return auth.RequireAuth(getMe)(ctx)
}

func getMe(ctx *views.Context) error {
	user, _ := auth.CurrentUser(ctx.Request.Context())
	data, err := services.ProfileService{}.Get(ctx.Request.Context(), user.ID)
	if err != nil {
		return ctx.Error(404, err.Error())
	}
	return ctx.Success(200, "profile", data)
}

func PUT(ctx *views.Context) error {
	return auth.RequireAuth(putMe)(ctx)
}

func putMe(ctx *views.Context) error {
	user, _ := auth.CurrentUser(ctx.Request.Context())
	var body map[string]any
	if err := ctx.Bind(&body); err != nil {
		return ctx.Error(400, err.Error())
	}
	u, err := services.ProfileService{}.Update(ctx.Request.Context(), user.ID, body)
	if err != nil {
		return ctx.Error(500, err.Error())
	}
	return ctx.Success(200, "profile updated", u)
}
