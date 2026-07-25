package violation_types

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
		ok, _ := permission.UserHas(c, user, "violations.view")
		if !ok {
			return c.Error(403, "forbidden")
		}
		list, err := services.ViolationTypeService{}.List(c.Request.Context())
		if err != nil {
			return c.Error(500, err.Error())
		}
		return c.Success(200, "violation types", list)
	})(ctx)
}

func POST(ctx *views.Context) error {
	return auth.RequireAuth(func(c *views.Context) error {
		user, _ := auth.CurrentUser(c.Request.Context())
		ok, _ := permission.UserHas(c, user, "violations.manage")
		if !ok {
			return c.Error(403, "forbidden")
		}
		var body models.ViolationType
		if err := c.Bind(&body); err != nil {
			return c.Error(400, err.Error())
		}
		v, err := services.ViolationTypeService{}.Create(c.Request.Context(), &body)
		if err != nil {
			return c.Error(500, err.Error())
		}
		return c.Success(201, "violation type created", v)
	})(ctx)
}
