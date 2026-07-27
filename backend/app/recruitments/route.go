package recruitments

import (
	"time"

	"backend/internal/auth"
	"backend/internal/permission"
	"backend/models"
	"backend/services"

	"github.com/lrndwy/gokil/views"
)

func GET(ctx *views.Context) error {
	return auth.RequireAuth(func(c *views.Context) error {
		user, _ := auth.CurrentUser(c.Request.Context())
		ok, _ := permission.UserHas(c, user, "recruitment.manage")
		if !ok {
			return c.Error(403, "forbidden")
		}
		list, err := services.RecruitmentService{}.List(c.Request.Context())
		if err != nil {
			return c.Error(500, err.Error())
		}
		return c.Success(200, "recruitments", list)
	})(ctx)
}

func POST(ctx *views.Context) error {
	return auth.RequireAuth(func(c *views.Context) error {
		user, _ := auth.CurrentUser(c.Request.Context())
		ok, _ := permission.UserHas(c, user, "recruitment.manage")
		if !ok {
			return c.Error(403, "forbidden")
		}
		var body struct {
			Title       string `json:"title"`
			Description string `json:"description"`
			Slug        string `json:"slug"`
			OpenDate    string `json:"open_date"`
			CloseDate   string `json:"close_date"`
			Status      string `json:"status"`
		}
		if err := c.Bind(&body); err != nil {
			return c.Error(400, err.Error())
		}
		open, _ := time.Parse("2006-01-02", body.OpenDate)
		close, _ := time.Parse("2006-01-02", body.CloseDate)
		r, err := services.RecruitmentService{}.Create(c.Request.Context(), &models.Recruitment{
			Title: body.Title, Description: body.Description, Slug: body.Slug,
			OpenDate: open, CloseDate: close, Status: body.Status, CreatedByID: user.ID,
		})
		if err != nil {
			return c.Error(500, err.Error())
		}
		services.LogActivity(c.Request.Context(), user.ID, "create", "recruitment", r.ID,
			"Membuat rekrutmen "+body.Title, c.Request.RemoteAddr)
		return c.Success(201, "recruitment created", r)
	})(ctx)
}
