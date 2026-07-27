package bulk_delete

import (
	"strconv"

	"backend/internal/auth"
	"backend/internal/permission"
	"backend/services"

	"github.com/lrndwy/gokil/views"
)

func POST(ctx *views.Context) error {
	return auth.RequireAuth(func(c *views.Context) error {
		user, _ := auth.CurrentUser(c.Request.Context())
		ok, _ := permission.UserHas(c, user, "letters.manage")
		if !ok {
			return c.Error(403, "forbidden")
		}
		var body struct {
			IDs []int64 `json:"ids"`
		}
		if err := c.Bind(&body); err != nil {
			return c.Error(400, err.Error())
		}
		svc := services.LetterService{}
		deleted := 0
		for _, id := range body.IDs {
			if err := svc.Delete(c.Request.Context(), id); err == nil {
				deleted++
			}
		}
		services.LogActivity(c.Request.Context(), user.ID, "delete", "letter", 0,
			"Menghapus "+strconv.Itoa(deleted)+" surat secara massal", c.Request.RemoteAddr)
		return c.Success(200, "letters deleted", map[string]any{"deleted": deleted})
	})(ctx)
}
