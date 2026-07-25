package preview_number

import (
	"time"

	"backend/internal/auth"
	"backend/internal/permission"
	"backend/models"
	"backend/services"

	"github.com/lrndwy/gokil/views"
)

func POST(ctx *views.Context) error {
	return auth.RequireAuth(func(c *views.Context) error {
		user, _ := auth.CurrentUser(c.Request.Context())
		ok, _ := permission.UserHas(c, user, "letters.view")
		if !ok {
			return c.Error(403, "forbidden")
		}
		id, err := models.ParseID(c.Param("id"))
		if err != nil {
			return c.Error(400, "invalid id")
		}
		var body struct {
			LetterDate string            `json:"letter_date"`
			Segments   map[string]string `json:"segments"`
		}
		if err := c.Bind(&body); err != nil {
			return c.Error(400, err.Error())
		}
		date := time.Now()
		if body.LetterDate != "" {
			if parsed, err := time.Parse("2006-01-02", body.LetterDate); err == nil {
				date = parsed
			} else if parsed, err := time.Parse(time.RFC3339, body.LetterDate); err == nil {
				date = parsed
			}
		}
		segments := services.SegmentsFromVariableValues(body.Segments)
		preview, err := services.LetterService{}.PreviewNumber(c.Request.Context(), id, date, segments)
		if err != nil {
			return c.Error(400, err.Error())
		}
		cat, _ := services.LetterService{}.GetCategory(c.Request.Context(), id)
		numberPlaceholders := []string{}
		if cat != nil {
			numberPlaceholders = services.ExtractCustomPlaceholders(cat.NumberFormatTemplate)
		}
		return c.Success(200, "number preview", map[string]any{
			"preview":             preview,
			"number_placeholders": numberPlaceholders,
		})
	})(ctx)
}
