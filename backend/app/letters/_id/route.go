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
		return c.Success(200, "letter", letter)
	})(ctx)
}

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
			for _, field := range []string{"subject", "letter_code", "sender", "recipient", "description"} {
				if v := c.Request.FormValue(field); v != "" {
					values[field] = v
				}
			}
			file, hdr, err := c.FormFile("file")
			if err == nil && file != nil && hdr != nil {
				defer file.Close()
				data, err := io.ReadAll(file)
				if err != nil {
					return c.Error(500, err.Error())
				}
				key := storageutil.Key("letters/attachments", hdr.Filename)
				url, err := storageutil.Upload(c.Request.Context(), key, data, hdr.Header.Get("Content-Type"))
				if err != nil {
					return c.Error(500, err.Error())
				}
				existing, _ := services.LetterService{}.Get(c.Request.Context(), id)
				if existing != nil && existing.Type == "outgoing" {
					values["document_url"] = url
				} else {
					values["attachment_url"] = url
				}
			}
		} else {
			if err := c.Bind(&values); err != nil {
				return c.Error(400, err.Error())
			}
		}
		if len(values) == 0 {
			return c.Error(400, "no fields to update")
		}
		letter, err := services.LetterService{}.Update(c.Request.Context(), id, values)
		if err != nil {
			return c.Error(500, err.Error())
		}
		return c.Success(200, "letter updated", letter)
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
		if err := svc.Delete(c.Request.Context(), id); err != nil {
			return c.Error(500, err.Error())
		}
		return c.Success(200, "letter deleted", nil)
	})(ctx)
}
