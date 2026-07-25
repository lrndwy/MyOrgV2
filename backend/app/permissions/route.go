package permissions

import (
	"backend/internal/auth"
	"backend/internal/permission"
	"backend/models"

	"github.com/lrndwy/gokil/orm"
	"github.com/lrndwy/gokil/views"
)

func GET(ctx *views.Context) error {
	return auth.RequireAuth(func(c *views.Context) error {
		user, _ := auth.CurrentUser(c.Request.Context())
		ok, _ := permission.UserHas(c, user, "roles.view")
		if !ok {
			return c.Error(403, "forbidden")
		}
		all, err := orm.Objects[models.Permission](c.Request.Context()).OrderBy("module", "code").All()
		if err != nil {
			return c.Error(500, err.Error())
		}
		return c.Success(200, "permissions", all)
	})(ctx)
}
