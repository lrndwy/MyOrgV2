package events

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
		okView, _ := permission.UserHas(c, user, "events.view")
		if !okView {
			return c.Error(403, "forbidden")
		}
		canViewAll, _ := permission.UserHas(c, user, "events.view_all")
		list, err := services.EventService{}.ListVisible(c.Request.Context(), user, canViewAll)
		if err != nil {
			return c.Error(500, err.Error())
		}
		return c.Success(200, "events", list)
	})(ctx)
}

func POST(ctx *views.Context) error {
	return auth.RequireAuth(func(c *views.Context) error {
		user, _ := auth.CurrentUser(c.Request.Context())
		ok, _ := permission.UserHas(c, user, "events.create")
		if !ok {
			return c.Error(403, "forbidden")
		}
		var (
			title           string
			description     string
			location        string
			bannerURL       string
			startRaw        string
			endRaw          string
			allowPermission bool
			divisionID      *int64
		)

		ct := c.Request.Header.Get("Content-Type")
		if strings.HasPrefix(ct, "multipart/form-data") {
			if err := c.ParseMultipart(20 << 20); err != nil {
				return c.Error(400, err.Error())
			}
			title = c.Request.FormValue("title")
			description = c.Request.FormValue("description")
			location = c.Request.FormValue("location")
			startRaw = c.Request.FormValue("start_time")
			endRaw = c.Request.FormValue("end_time")
			allowPermission = c.Request.FormValue("allow_permission") == "true"
			if v := c.Request.FormValue("division_id"); v != "" {
				id, _ := strconv.ParseInt(v, 10, 64)
				if id > 0 {
					divisionID = &id
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
				bannerURL = url
			}
		} else {
			var body struct {
				Title           string `json:"title"`
				Description     string `json:"description"`
				DivisionID      *int64 `json:"division_id"`
				Location        string `json:"location"`
				BannerURL       string `json:"banner_url"`
				StartTime       string `json:"start_time"`
				EndTime         string `json:"end_time"`
				AllowPermission bool   `json:"allow_permission"`
			}
			if err := c.Bind(&body); err != nil {
				return c.Error(400, err.Error())
			}
			title = body.Title
			description = body.Description
			location = body.Location
			bannerURL = body.BannerURL
			startRaw = body.StartTime
			endRaw = body.EndTime
			allowPermission = body.AllowPermission
			divisionID = body.DivisionID
		}

		start, err := timeutil.ParseFlexible(startRaw)
		if err != nil {
			return c.Error(400, "invalid start_time")
		}
		end, err := timeutil.ParseFlexible(endRaw)
		if err != nil {
			return c.Error(400, "invalid end_time")
		}
		e, err := services.EventService{}.Create(c.Request.Context(), &models.Event{
			Title: title, Description: description, DivisionID: divisionID,
			Location: location, BannerURL: bannerURL, StartTime: start, EndTime: end,
			AllowPermission: allowPermission, CreatedByID: user.ID,
		})
		if err != nil {
			return c.Error(500, err.Error())
		}
		services.LogActivity(c.Request.Context(), user.ID, "create", "event", e.ID,
			"Membuat event "+title, c.Request.RemoteAddr)
		return c.Success(201, "event created", e)
	})(ctx)
}

func fileExt(name string) string {
	if i := strings.LastIndex(name, "."); i >= 0 {
		return name[i:]
	}
	return ""
}
