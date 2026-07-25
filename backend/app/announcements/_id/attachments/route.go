package attachments

import (
	"backend/internal/auth"
	"backend/models"
	"backend/services"

	"github.com/lrndwy/gokil/views"
)

func GET(ctx *views.Context) error {
	return auth.RequireAuth(func(c *views.Context) error {
		id, err := models.ParseID(c.Param("id"))
		if err != nil {
			return c.Error(400, "invalid id")
		}
		list, err := services.AnnouncementService{}.GetAttachments(c.Request.Context(), id)
		if err != nil {
			return c.Error(500, err.Error())
		}
		return c.Success(200, "attachments", list)
	})(ctx)
}
