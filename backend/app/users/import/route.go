package importpkg

import (
	"encoding/csv"
	"io"
	"strconv"
	"strings"

	"backend/internal/auth"
	"backend/internal/permission"
	"backend/services"

	"github.com/lrndwy/gokil/views"
)

func POST(ctx *views.Context) error {
	return auth.RequireAuth(func(c *views.Context) error {
		user, _ := auth.CurrentUser(c.Request.Context())
		ok, _ := permission.UserHas(c, user, "users.import")
		if !ok {
			return c.Error(403, "forbidden")
		}
		if err := c.ParseMultipart(10 << 20); err != nil {
			return c.Error(400, err.Error())
		}
		file, _, err := c.FormFile("file")
		if err != nil {
			return c.Error(400, "file required")
		}
		defer file.Close()
		data, err := io.ReadAll(file)
		if err != nil {
			return c.Error(400, err.Error())
		}
		reader := csv.NewReader(strings.NewReader(string(data)))
		records, err := reader.ReadAll()
		if err != nil || len(records) < 2 {
			return c.Error(400, "invalid csv")
		}
		header := records[0]
		idx := map[string]int{}
		for i, h := range header {
			idx[strings.TrimSpace(h)] = i
		}
		var rows []map[string]string
		for _, rec := range records[1:] {
			row := map[string]string{}
			for k, i := range idx {
				if i < len(rec) {
					row[k] = rec[i]
				}
			}
			rows = append(rows, row)
		}
		success, failures := services.UserService{}.ImportCSV(c.Request.Context(), rows)
		services.LogActivity(c.Request.Context(), user.ID, "create", "user", 0,
			"Import "+strconv.Itoa(success)+" pengguna dari CSV", c.Request.RemoteAddr)
		return c.Success(200, "import complete", map[string]any{
			"success_count": success, "failures": failures,
		})
	})(ctx)
}
