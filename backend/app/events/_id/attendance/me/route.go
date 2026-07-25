package me

import (
	"backend/internal/auth"
	"backend/internal/permission"
	"backend/models"
	"backend/services"

	"github.com/lrndwy/gokil/views"
)

func GET(ctx *views.Context) error {
	return auth.RequireAuth(func(c *views.Context) error {
		user, _ := auth.CurrentUser(c.Request.Context())
		ok, _ := permission.UserHas(c, user, "attendance.submit")
		if !ok {
			return c.Error(403, "forbidden")
		}
		eventID, err := models.ParseID(c.Param("id"))
		if err != nil {
			return c.Error(400, "invalid event id")
		}
		a, err := services.AttendanceService{}.GetMine(c.Request.Context(), eventID, user.ID)
		if err != nil {
			return c.NotFound()
		}
		return c.Success(200, "attendance", a)
	})(ctx)
}
