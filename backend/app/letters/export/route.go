package export

import (
	"encoding/csv"
	"fmt"
	"strings"

	"backend/internal/auth"
	"backend/internal/permission"
	"backend/models"
	"backend/services"

	"github.com/lrndwy/gokil/views"
)

func GET(ctx *views.Context) error {
	return auth.RequireAuth(func(c *views.Context) error {
		user, _ := auth.CurrentUser(c.Request.Context())
		ok, _ := permission.UserHas(c, user, "letters.view")
		if !ok {
			return c.Error(403, "forbidden")
		}
		var categoryID int64
		if q := c.Query("category_id"); q != "" {
			categoryID, _ = models.ParseID(q)
		}
		list, err := services.LetterService{}.List(c.Request.Context(), c.Query("type"), categoryID)
		if err != nil {
			return c.Error(500, err.Error())
		}
		format := strings.ToLower(c.Query("format"))
		if format == "" {
			format = "csv"
		}
		if format != "csv" {
			format = "csv"
		}
		var b strings.Builder
		w := csv.NewWriter(&b)
		_ = w.Write([]string{"id", "type", "letter_code", "subject", "sender", "recipient", "letter_date"})
		for _, l := range list {
			_ = w.Write([]string{
				fmt.Sprintf("%d", l.ID),
				l.Type,
				l.LetterCode,
				l.Subject,
				l.Sender,
				l.Recipient,
				l.LetterDate.Format("2006-01-02"),
			})
		}
		w.Flush()
		c.Writer.Header().Set("Content-Type", "text/csv")
		c.Writer.Header().Set("Content-Disposition", `attachment; filename="letters.csv"`)
		c.Writer.WriteHeader(200)
		_, _ = c.Writer.Write([]byte(b.String()))
		return nil
	})(ctx)
}
