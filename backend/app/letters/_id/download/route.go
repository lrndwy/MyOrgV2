package download

import (
	"net/http"
	"path/filepath"
	"strings"

	"backend/internal/auth"
	"backend/internal/permission"
	"backend/internal/storageutil"
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
		id, err := models.ParseID(c.Param("id"))
		if err != nil {
			return c.Error(400, "invalid id")
		}
		letter, err := services.LetterService{}.Get(c.Request.Context(), id)
		if err != nil {
			return c.NotFound()
		}
		url := letter.DocumentURL
		if url == "" {
			url = letter.AttachmentURL
		}
		if url == "" {
			return c.Error(404, "no document")
		}
		if strings.HasPrefix(url, "http://") || strings.HasPrefix(url, "https://") {
			http.Redirect(c.Writer, c.Request, url, http.StatusFound)
			return nil
		}
		data, err := storageutil.ReadURL(c.Request.Context(), url)
		if err != nil {
			return c.Error(500, err.Error())
		}
		name := filepath.Base(url)
		c.Writer.Header().Set("Content-Disposition", `attachment; filename="`+name+`"`)
		c.Writer.Header().Set("Content-Type", "application/octet-stream")
		c.Writer.WriteHeader(200)
		_, _ = c.Writer.Write(data)
		return nil
	})(ctx)
}
