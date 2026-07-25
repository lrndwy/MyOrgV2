package avatar

import (
	"backend/internal/auth"
	"backend/services"

	"github.com/lrndwy/gokil/views"
)

func POST(ctx *views.Context) error {
	return auth.RequireAuth(func(c *views.Context) error {
		user, _ := auth.CurrentUser(c.Request.Context())
		if err := c.ParseMultipart(5 << 20); err != nil {
			return c.Error(400, err.Error())
		}
		file, hdr, err := c.FormFile("avatar")
		if err != nil || file == nil {
			return c.Error(400, "file avatar wajib diunggah")
		}
		url, err := services.UserService{}.UploadAvatar(c.Request.Context(), user.ID, file, hdr)
		if err != nil {
			return c.Error(500, err.Error())
		}
		return c.Success(200, "avatar uploaded", map[string]any{"avatar_url": url})
	})(ctx)
}
