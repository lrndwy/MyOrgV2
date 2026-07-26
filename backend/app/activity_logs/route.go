package activity_logs

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
		ok, _ := permission.UserHas(c, user, "view.activity")
		if !ok {
			return c.Error(403, "forbidden")
		}
		var userID int64
		if v := c.Query("user_id"); v != "" {
			id, err := models.ParseID(v)
			if err == nil {
				userID = id
			}
		}
		resourceType := c.Query("resource_type")
		list, err := (services.ActivityLogService{}).List(c.Request.Context(), userID, resourceType)
		if err != nil {
			return c.Error(500, err.Error())
		}
		return c.Success(200, "activity logs", list)
	})(ctx)
}
