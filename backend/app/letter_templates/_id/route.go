package id

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

func PUT(ctx *views.Context) error {
	return auth.RequireAuth(func(c *views.Context) error {
		user, _ := auth.CurrentUser(c.Request.Context())
		ok, _ := permission.UserHas(c, user, "letters.manage")
		if !ok {
			return c.Error(403, "forbidden")
		}
		id, err := models.ParseID(c.Param("id"))
		if err != nil {
			return c.Error(400, "invalid id")
		}
		values := map[string]any{}
		ct := c.Request.Header.Get("Content-Type")
		if strings.HasPrefix(ct, "multipart/") {
			if err := c.ParseMultipart(20 << 20); err != nil {
				return c.Error(400, err.Error())
			}
			if v := c.Request.FormValue("name"); v != "" {
				values["name"] = v
			}
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
				values["template_url"] = url
			}
		} else {
			if err := c.Bind(&values); err != nil {
				return c.Error(400, err.Error())
			}
		}
		if len(values) == 0 {
			return c.Error(400, "no fields to update")
		}
		t, err := services.LetterService{}.UpdateTemplate(c.Request.Context(), id, values)
		if err != nil {
			return c.Error(500, err.Error())
		}
		return c.Success(200, "template updated", t)
	})(ctx)
}

func DELETE(ctx *views.Context) error {
	return auth.RequireAuth(func(c *views.Context) error {
		user, _ := auth.CurrentUser(c.Request.Context())
		ok, _ := permission.UserHas(c, user, "letters.manage")
		if !ok {
			return c.Error(403, "forbidden")
		}
		id, err := models.ParseID(c.Param("id"))
		if err != nil {
			return c.Error(400, "invalid id")
		}
		svc := services.LetterService{}
		if err := svc.DeleteTemplate(c.Request.Context(), id); err != nil {
			return c.Error(500, err.Error())
		}
		return c.Success(200, "template deleted", nil)
	})(ctx)
}

func fileExt(name string) string {
	if i := strings.LastIndex(name, "."); i >= 0 {
		return name[i:]
	}
	return ""
}
