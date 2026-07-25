package letter_categories

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
		ok, _ := permission.UserHas(c, user, "letters.manage")
		if !ok {
			return c.Error(403, "forbidden")
		}
		list, err := services.LetterService{}.ListCategories(c.Request.Context())
		if err != nil {
			return c.Error(500, err.Error())
		}
		return c.Success(200, "letter categories", list)
	})(ctx)
}

func POST(ctx *views.Context) error {
	return auth.RequireAuth(func(c *views.Context) error {
		user, _ := auth.CurrentUser(c.Request.Context())
		ok, _ := permission.UserHas(c, user, "letters.manage")
		if !ok {
			return c.Error(403, "forbidden")
		}
		var body models.LetterCategory
		if err := c.Bind(&body); err != nil {
			return c.Error(400, err.Error())
		}
		cat, err := services.LetterService{}.CreateCategory(c.Request.Context(), &body)
		if err != nil {
			return c.Error(500, err.Error())
		}
		return c.Success(201, "category created", cat)
	})(ctx)
}
