package violations

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
		ok, _ := permission.UserHas(c, user, "violations.view")
		if !ok {
			return c.Error(403, "forbidden")
		}
		var userID int64
		if q := c.Query("user_id"); q != "" {
			id, err := models.ParseID(q)
			if err == nil {
				userID = id
			}
		}
		list, err := services.ViolationService{}.List(c.Request.Context(), userID)
		if err != nil {
			return c.Error(500, err.Error())
		}
		return c.Success(200, "violations", list)
	})(ctx)
}

func POST(ctx *views.Context) error {
	return auth.RequireAuth(func(c *views.Context) error {
		user, _ := auth.CurrentUser(c.Request.Context())
		ok, _ := permission.UserHas(c, user, "violations.manage")
		if !ok {
			return c.Error(403, "forbidden")
		}
		var body struct {
			UserID        int64  `json:"user_id"`
			ViolationType string `json:"violation_type"`
			Description   string `json:"description"`
			SPLevel       string `json:"sp_level"`
			DocumentURL   string `json:"document_url"`
			IssuedDate    string `json:"issued_date"`
		}
		if err := c.Bind(&body); err != nil {
			return c.Error(400, err.Error())
		}
		issued, err := time.Parse("2006-01-02", body.IssuedDate)
		if err != nil {
			issued = time.Now()
		}
		v, err := services.ViolationService{}.Create(c.Request.Context(), &models.Violation{
			UserID: body.UserID, ViolationType: body.ViolationType, Description: body.Description,
			SPLevel: body.SPLevel, DocumentURL: body.DocumentURL, IssuedByID: user.ID, IssuedDate: issued,
		})
		if err != nil {
			return c.Error(500, err.Error())
		}
		return c.Success(201, "violation created", v)
	})(ctx)
}
