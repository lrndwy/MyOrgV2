package permission_requests

import (
	"backend/internal/auth"
	"backend/internal/permission"
	"backend/services"

	"github.com/lrndwy/gokil/views"
)

func POST(ctx *views.Context) error {
	return auth.RequireAuth(func(c *views.Context) error {
		user, _ := auth.CurrentUser(c.Request.Context())
		ok, _ := permission.UserHas(c, user, "permission.submit")
		if !ok {
			return c.Error(403, "forbidden")
		}
		var body struct {
			EventID int64  `json:"event_id"`
			Reason  string `json:"reason"`
			Proof   string `json:"proof"`
		}
		if err := c.Bind(&body); err != nil {
			return c.Error(400, err.Error())
		}
		pr, err := services.PermissionRequestService{}.Create(c.Request.Context(), body.EventID, user.ID, body.Reason, body.Proof)
		if err != nil {
			return c.Error(400, err.Error())
		}
		return c.Success(201, "permission request created", pr)
	})(ctx)
}
