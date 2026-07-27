package password

import (
	"backend/internal/auth"
	"backend/internal/permission"
	"backend/models"
	"backend/services"

	"github.com/lrndwy/gokil/views"
)

func PUT(ctx *views.Context) error {
	return auth.RequireAuth(func(c *views.Context) error {
		user, _ := auth.CurrentUser(c.Request.Context())
		ok, _ := permission.UserHas(c, user, "users.edit")
		if !ok {
			return c.Error(403, "forbidden")
		}
		id, err := models.ParseID(c.Param("id"))
		if err != nil {
			return c.Error(400, "invalid id")
		}
		var body struct {
			NewPassword string `json:"new_password"`
		}
		if err := c.Bind(&body); err != nil {
			return c.Error(400, err.Error())
		}
		if err := (services.UserService{}).ChangePassword(c.Request.Context(), id, body.NewPassword); err != nil {
			return c.Error(500, err.Error())
		}
		services.LogActivity(c.Request.Context(), user.ID, "update", "user", id,
			"Mengubah password pengguna", c.Request.RemoteAddr)
		return c.Success(200, "password updated", nil)
	})(ctx)
}
