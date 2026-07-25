package variables

import (
	"backend/internal/auth"
	"backend/internal/letterutil"
	"backend/internal/permission"
	"backend/internal/storageutil"
	"backend/models"
	"backend/services"
	"time"

	"github.com/lrndwy/gokil/views"
)

func GET(ctx *views.Context) error {
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
		t, err := services.LetterService{}.GetTemplate(c.Request.Context(), id)
		if err != nil {
			return c.NotFound()
		}
		var vars []string
		if t.TemplateURL != "" {
			data, err := storageutil.ReadURL(c.Request.Context(), t.TemplateURL)
			if err == nil {
				vars, _ = letterutil.ListPlaceholders(data)
			}
		}
		var userVars []string
		autoSet := map[string]struct{}{
			"{NOMOR_SURAT}": {}, "{NOMOR}": {}, "{LETTER_CODE}": {},
			"{PERIHAL}": {}, "{SUBJECT}": {},
		}
		for _, v := range vars {
			if _, skip := autoSet[v]; skip {
				continue
			}
			userVars = append(userVars, v)
		}
		cat, _ := services.LetterService{}.GetCategory(c.Request.Context(), t.CategoryID)
		preview := ""
		numberPlaceholders := []string{}
		numberFormatTemplate := ""
		if cat != nil {
			numberFormatTemplate = cat.NumberFormatTemplate
			numberPlaceholders = services.ExtractCustomPlaceholders(cat.NumberFormatTemplate)
			preview, _ = services.LetterService{}.PreviewNumber(c.Request.Context(), cat.ID, time.Now(), nil)
		}
		return c.Success(200, "template variables", map[string]any{
			"variables":              vars,
			"user_variables":         userVars,
			"next_number_preview":    preview,
			"category_id":            t.CategoryID,
			"number_format_template": numberFormatTemplate,
			"number_placeholders":    numberPlaceholders,
		})
	})(ctx)
}
