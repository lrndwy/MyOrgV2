package avatar

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
		ok, _ := permission.UserHas(c, user, "users.edit")
		if !ok {
			return c.Error(403, "forbidden")
		}
		id, err := models.ParseID(c.Param("id"))
		if err != nil {
			return c.Error(400, "invalid id")
		}
		if err := c.ParseMultipart(5 << 20); err != nil {
			return c.Error(400, err.Error())
		}
		file, hdr, err := c.FormFile("avatar")
		if err != nil || file == nil {
			return c.Error(400, "file avatar wajib diunggah")
		}
		url, err := services.UserService{}.UploadAvatar(c.Request.Context(), id, file, hdr)
		if err != nil {
			return c.Error(500, err.Error())
		}
		services.LogActivity(c.Request.Context(), user.ID, "update", "user", id,
			"Mengupload avatar pengguna", c.Request.RemoteAddr)
		return c.Success(200, "avatar uploaded", map[string]any{"avatar_url": url})
	})(ctx)
}
