package id

import (
	"io"
	"strconv"
	"strings"

	"backend/internal/auth"
	"backend/internal/permission"
	"backend/internal/storageutil"
	"backend/internal/timeutil"
	"backend/models"
	"backend/services"

	"github.com/lrndwy/gokil/views"
)

func GET(ctx *views.Context) error {
	return auth.RequireAuth(func(c *views.Context) error {
		user, _ := auth.CurrentUser(c.Request.Context())
		ok, _ := permission.UserHas(c, user, "events.view")
		if !ok {
			return c.Error(403, "forbidden")
		}
		id, err := models.ParseID(c.Param("id"))
		if err != nil {
			return c.Error(400, "invalid id")
		}
		e, err := services.EventService{}.GetForUser(c.Request.Context(), id, user.ID)
		if err != nil {
			return c.NotFound()
		}
		return c.Success(200, "event", e)
	})(ctx)
}

func PUT(ctx *views.Context) error {
	return auth.RequireAuth(func(c *views.Context) error {
		user, _ := auth.CurrentUser(c.Request.Context())
		ok, _ := permission.UserHas(c, user, "events.edit")
		if !ok {
			return c.Error(403, "forbidden")
		}
		id, err := models.ParseID(c.Param("id"))
		if err != nil {
			return c.Error(400, "invalid id")
		}

		values := map[string]any{}
		ct := c.Request.Header.Get("Content-Type")
		if strings.HasPrefix(ct, "multipart/form-data") {
			if err := c.ParseMultipart(20 << 20); err != nil {
				return c.Error(400, err.Error())
			}
			if v := c.Request.FormValue("title"); v != "" {
				values["title"] = v
			}
			if v := c.Request.FormValue("description"); v != "" {
				values["description"] = v
			}
			if v := c.Request.FormValue("location"); v != "" {
				values["location"] = v
			}
			if v := c.Request.FormValue("start_time"); v != "" {
				start, err := timeutil.ParseFlexible(v)
				if err != nil {
					return c.Error(400, "invalid start_time")
				}
				values["start_time"] = start
			}
			if v := c.Request.FormValue("end_time"); v != "" {
				end, err := timeutil.ParseFlexible(v)
				if err != nil {
					return c.Error(400, "invalid end_time")
				}
				values["end_time"] = end
			}
			values["allow_permission"] = c.Request.FormValue("allow_permission") == "true"
			if v := c.Request.FormValue("division_id"); v != "" {
				divID, _ := strconv.ParseInt(v, 10, 64)
				if divID > 0 {
					values["division_id"] = divID
				} else {
					values["division_id"] = nil
				}
			}
			banner, hdr, _ := c.FormFile("banner")
			if banner != nil && hdr != nil {
				defer banner.Close()
				data, err := io.ReadAll(banner)
				if err != nil {
					return c.Error(500, err.Error())
				}
				key := storageutil.Key("events/banners", "banner"+fileExt(hdr.Filename))
				url, err := storageutil.Upload(c.Request.Context(), key, data, hdr.Header.Get("Content-Type"))
				if err != nil {
					return c.Error(500, err.Error())
				}
				values["banner_url"] = url
			}
		} else {
			var body map[string]any
			if err := c.Bind(&body); err != nil {
				return c.Error(400, err.Error())
			}
			if startRaw, ok := body["start_time"].(string); ok && startRaw != "" {
				start, err := timeutil.ParseFlexible(startRaw)
				if err != nil {
					return c.Error(400, "invalid start_time")
				}
				body["start_time"] = start
			}
			if endRaw, ok := body["end_time"].(string); ok && endRaw != "" {
				end, err := timeutil.ParseFlexible(endRaw)
				if err != nil {
					return c.Error(400, "invalid end_time")
				}
				body["end_time"] = end
			}
			values = body
		}

		e, err := services.EventService{}.Update(c.Request.Context(), id, values)
		if err != nil {
			return c.Error(500, err.Error())
		}
		services.LogActivity(c.Request.Context(), user.ID, "update", "event", id,
			"Memperbarui event", c.Request.RemoteAddr)
		return c.Success(200, "event updated", e)
	})(ctx)
}

func DELETE(ctx *views.Context) error {
	return auth.RequireAuth(func(c *views.Context) error {
		user, _ := auth.CurrentUser(c.Request.Context())
		ok, _ := permission.UserHas(c, user, "events.delete")
		if !ok {
			return c.Error(403, "forbidden")
		}
		id, err := models.ParseID(c.Param("id"))
		if err != nil {
			return c.Error(400, "invalid id")
		}
		if err := (services.EventService{}).Delete(c.Request.Context(), id); err != nil {
			return c.Error(500, err.Error())
		}
		services.LogActivity(c.Request.Context(), user.ID, "delete", "event", id,
			"Menghapus event", c.Request.RemoteAddr)
		return c.Success(200, "event deleted", nil)
	})(ctx)
}

func fileExt(name string) string {
	if i := strings.LastIndex(name, "."); i >= 0 {
		return name[i:]
	}
	return ""
}
