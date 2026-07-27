package attendance

import (
	"backend/internal/auth"
	"backend/internal/permission"
	"backend/models"
	"backend/services"

	"github.com/lrndwy/gokil/views"
)

func POST(ctx *views.Context) error {
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
		var body struct {
			Selfie    string `json:"selfie"`
			Signature string `json:"signature"`
		}
		if err := c.Bind(&body); err != nil {
			return c.Error(400, err.Error())
		}
		a, err := services.AttendanceService{}.Submit(c.Request.Context(), eventID, user.ID, body.Selfie, body.Signature)
		if err != nil {
			return c.Error(400, err.Error())
		}
		services.LogActivity(c.Request.Context(), user.ID, "create", "attendance", a.ID,
			"Mengisi absensi event", c.Request.RemoteAddr)
		return c.Success(201, "attendance recorded", a)
	})(ctx)
}
