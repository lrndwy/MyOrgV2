package register

import (
	"backend/services"

	"github.com/lrndwy/gokil/views"
)

func POST(ctx *views.Context) error {
	var body struct {
		Username   string `json:"username"`
		Email      string `json:"email"`
		Password   string `json:"password"`
		FullName   string `json:"full_name"`
		DivisionID int64  `json:"division_id"`
	}
	if err := ctx.Bind(&body); err != nil {
		return ctx.Error(400, err.Error())
	}
	user, err := services.AuthService{}.Register(ctx.Request.Context(), body.Username, body.Email, body.Password, body.FullName, body.DivisionID)
	if err != nil {
		return ctx.Error(400, err.Error())
	}
	return ctx.Success(201, "registered", user)
}
