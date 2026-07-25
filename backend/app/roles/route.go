package roles

import (
	"backend/internal/auth"
	"backend/internal/permission"
	"backend/services"

	"github.com/lrndwy/gokil/views"
)

func GET(ctx *views.Context) error {
	return auth.RequireAuth(func(c *views.Context) error {
		user, _ := auth.CurrentUser(c.Request.Context())
		ok, _ := permission.UserHas(c, user, "roles.view")
		if !ok {
			return c.Error(403, "forbidden")
		}
		list, err := services.RoleService{}.ListPublic(c.Request.Context())
		if err != nil {
			return c.Error(500, err.Error())
		}
		return c.Success(200, "roles", list)
	})(ctx)
}

func POST(ctx *views.Context) error {
	return auth.RequireAuth(func(c *views.Context) error {
		user, _ := auth.CurrentUser(c.Request.Context())
		ok, _ := permission.UserHas(c, user, "roles.create")
		if !ok {
			return c.Error(403, "forbidden")
		}
		var body struct {
			Name        string `json:"name"`
			Description string `json:"description"`
		}
		if err := c.Bind(&body); err != nil {
			return c.Error(400, err.Error())
		}
		r, err := services.RoleService{}.Create(c.Request.Context(), body.Name, body.Description)
		if err != nil {
			return c.Error(500, err.Error())
		}
		return c.Success(201, "role created", r)
	})(ctx)
}
