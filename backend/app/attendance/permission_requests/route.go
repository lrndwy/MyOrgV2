package permission_requests

import (
	"backend/internal/auth"
	"backend/internal/permission"
	"backend/services"

	"github.com/lrndwy/gokil/views"
)

// URL: /attendance/permission_requests (underscore; PRD hyphen variant documented here)

func GET(ctx *views.Context) error {
	return auth.RequireAuth(func(c *views.Context) error {
		user, _ := auth.CurrentUser(c.Request.Context())
		ok, _ := permission.UserHas(c, user, "attendance.approve")
		if !ok {
			return c.Error(403, "forbidden")
		}
		list, err := services.PermissionRequestService{}.ListPending(c.Request.Context())
		if err != nil {
			return c.Error(500, err.Error())
		}
		return c.Success(200, "permission requests", list)
	})(ctx)
}
