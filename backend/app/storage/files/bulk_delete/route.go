package bulk_delete

import (
	"backend/internal/auth"
	"backend/internal/permission"
	"backend/services"

	"github.com/lrndwy/gokil/views"
)

func POST(ctx *views.Context) error {
	return auth.RequireAuth(func(c *views.Context) error {
		user, _ := auth.CurrentUser(c.Request.Context())
		ok, _ := permission.UserHas(c, user, "storage.manage")
		if !ok {
			return c.Error(403, "forbidden")
		}
		var body struct {
			IDs []int64 `json:"ids"`
		}
		if err := c.Bind(&body); err != nil {
			return c.Error(400, err.Error())
		}
		if len(body.IDs) == 0 {
			return c.Error(400, "ids array is required")
		}
		svc := services.StorageService{}
		deleted := 0
		for _, id := range body.IDs {
			if err := svc.DeleteFile(c.Request.Context(), id); err == nil {
				deleted++
			}
		}
		return c.Success(200, "files deleted", map[string]any{
			"deleted": deleted,
			"total":   len(body.IDs),
		})
	})(ctx)
}
