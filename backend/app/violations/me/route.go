package me

import (
	"backend/internal/auth"
	"backend/services"

	"github.com/lrndwy/gokil/views"
)

// GET /violations/me: pelanggaran & SP milik user login sendiri — cukup auth,
// tanpa permission violations.view (itu untuk melihat data orang lain).
func GET(ctx *views.Context) error {
	return auth.RequireAuth(func(c *views.Context) error {
		user, _ := auth.CurrentUser(c.Request.Context())
		list, err := services.ViolationService{}.List(c.Request.Context(), user.ID)
		if err != nil {
			return c.Error(500, err.Error())
		}
		return c.Success(200, "my violations", list)
	})(ctx)
}
