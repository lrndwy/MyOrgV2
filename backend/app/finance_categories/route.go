package finance_categories

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
		// finance.create/edit tanpa finance.view tetap butuh kategori di form.
		ok, _ := permission.UserHasAny(c, user,
			"finance.view", "finance.create", "finance.edit")
		if !ok {
			return c.Error(403, "forbidden")
		}
		list, err := services.FinanceService{}.ListCategories(c.Request.Context())
		if err != nil {
			return c.Error(500, err.Error())
		}
		return c.Success(200, "finance categories", list)
	})(ctx)
}

func POST(ctx *views.Context) error {
	return auth.RequireAuth(func(c *views.Context) error {
		user, _ := auth.CurrentUser(c.Request.Context())
		ok, _ := permission.UserHas(c, user, "finance.categories.manage")
		if !ok {
			return c.Error(403, "forbidden")
		}
		var body models.FinanceCategory
		if err := c.Bind(&body); err != nil {
			return c.Error(400, err.Error())
		}
		cat, err := services.FinanceService{}.CreateCategory(c.Request.Context(), &body)
		if err != nil {
			return c.Error(500, err.Error())
		}
		return c.Success(201, "category created", cat)
	})(ctx)
}
