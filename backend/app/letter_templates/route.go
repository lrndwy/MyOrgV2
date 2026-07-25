package letter_templates

import (
	"io"
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
		list, err := services.LetterService{}.ListTemplates(c.Request.Context())
		if err != nil {
			return c.Error(500, err.Error())
		}
		return c.Success(200, "letter templates", list)
	})(ctx)
}

func POST(ctx *views.Context) error {
	return auth.RequireAuth(func(c *views.Context) error {
		user, _ := auth.CurrentUser(c.Request.Context())
		ok, _ := permission.UserHas(c, user, "letters.manage")
		if !ok {
			return c.Error(403, "forbidden")
		}
		if err := c.ParseMultipart(20 << 20); err != nil {
			return c.Error(400, err.Error())
		}
		categoryID, _ := models.ParseID(c.Request.FormValue("category_id"))
		name := c.Request.FormValue("name")
		if name == "" || categoryID == 0 {
			return c.Error(400, "name and category_id required")
		}
		t := &models.LetterTemplate{Name: name, CategoryID: categoryID}
		file, hdr, err := c.FormFile("template")
		if err == nil && file != nil && hdr != nil {
			defer file.Close()
			data, err := io.ReadAll(file)
			if err != nil {
				return c.Error(500, err.Error())
			}
			key := storageutil.Key("letter-templates", "template"+fileExt(hdr.Filename))
			url, err := storageutil.Upload(c.Request.Context(), key, data, hdr.Header.Get("Content-Type"))
			if err != nil {
				return c.Error(500, err.Error())
			}
			t.TemplateURL = url
		}
		created, err := services.LetterService{}.CreateTemplate(c.Request.Context(), t)
		if err != nil {
			return c.Error(500, err.Error())
		}
		return c.Success(201, "template created", created)
	})(ctx)
}

func fileExt(name string) string {
	if i := strings.LastIndex(name, "."); i >= 0 {
		return name[i:]
	}
	return ""
}
