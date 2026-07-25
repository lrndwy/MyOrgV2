package template

import (
	"backend/internal/auth"
	"backend/internal/permission"

	"github.com/lrndwy/gokil/views"
)

func GET(ctx *views.Context) error {
	return auth.RequireAuth(func(c *views.Context) error {
		user, _ := auth.CurrentUser(c.Request.Context())
		ok, _ := permission.UserHas(c, user, "users.import")
		if !ok {
			return c.Error(403, "forbidden")
		}
		csv := "username,email,full_name,division,role,password,phone\n"
		c.Writer.Header().Set("Content-Type", "text/csv")
		c.Writer.Header().Set("Content-Disposition", "attachment; filename=users_template.csv")
		_, err := c.Writer.Write([]byte(csv))
		return err
	})(ctx)
}
