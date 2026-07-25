package parse_incoming

import (
	"io"

	"backend/internal/auth"
	"backend/internal/letterutil"
	"backend/internal/permission"

	"github.com/lrndwy/gokil/views"
)

func POST(ctx *views.Context) error {
	return auth.RequireAuth(func(c *views.Context) error {
		user, _ := auth.CurrentUser(c.Request.Context())
		ok, _ := permission.UserHas(c, user, "letters.manage")
		if !ok {
			return c.Error(403, "forbidden")
		}
		if err := c.ParseMultipart(30 << 20); err != nil {
			return c.Error(400, err.Error())
		}
		file, hdr, err := c.FormFile("file")
		if err != nil {
			return c.Error(400, "file required")
		}
		defer file.Close()
		data, err := io.ReadAll(file)
		if err != nil {
			return c.Error(500, err.Error())
		}
		text, method, err := letterutil.ExtractText(c.Request.Context(), data, hdr.Filename)
		if err != nil {
			return c.Error(502, "ocr failed: "+err.Error())
		}
		code, detected := letterutil.DetectLetterCode(text)
		return c.Success(200, "parsed", map[string]any{
			"letter_code":     code,
			"extracted_text":  text,
			"detected":        detected,
			"method":          method,
		})
	})(ctx)
}
