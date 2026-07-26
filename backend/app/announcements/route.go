package announcements

import (
	"io"
	"log"
	"strings"
	"time"

	"backend/internal/auth"
	"backend/internal/permission"
	"backend/internal/storageutil"
	"backend/models"
	"backend/services"

	"github.com/lrndwy/gokil/orm"
	"github.com/lrndwy/gokil/views"
)

func GET(ctx *views.Context) error {
	return auth.RequireAuth(func(c *views.Context) error {
		user, _ := auth.CurrentUser(c.Request.Context())
		list, err := services.AnnouncementService{}.ListForUser(c.Request.Context(), user.ID)
		if err != nil {
			return c.Error(500, err.Error())
		}
		return c.Success(200, "announcements", list)
	})(ctx)
}

func POST(ctx *views.Context) error {
	return auth.RequireAuth(func(c *views.Context) error {
		user, _ := auth.CurrentUser(c.Request.Context())
		ok, _ := permission.UserHas(c, user, "announcement.create")
		if !ok {
			return c.Error(403, "forbidden")
		}

		var title, content, targetType string
		var targetDivisionID *int64
		var bannerURL string

		ct := c.Request.Header.Get("Content-Type")
		if strings.HasPrefix(ct, "multipart/form-data") {
			if err := c.ParseMultipart(30 << 20); err != nil {
				return c.Error(400, err.Error())
			}
			title = c.Request.FormValue("title")
			content = c.Request.FormValue("content")
			targetType = c.Request.FormValue("target_type")
			if targetType == "" {
				targetType = "all"
			}
			if v := c.Request.FormValue("target_division_id"); v != "" {
				id, err := models.ParseID(v)
				if err == nil {
					targetDivisionID = &id
				}
			}
			banner, hdr, _ := c.FormFile("banner")
			if banner != nil && hdr != nil {
				defer banner.Close()
				data, err := io.ReadAll(banner)
				if err != nil {
					return c.Error(500, err.Error())
				}
				key := storageutil.Key("announcements/banners", "banner"+fileExt(hdr.Filename))
				url, err := storageutil.Upload(c.Request.Context(), key, data, hdr.Header.Get("Content-Type"))
				if err != nil {
					return c.Error(500, err.Error())
				}
				bannerURL = url
			}
		} else {
			var body struct {
				Title            string `json:"title"`
				Content          string `json:"content"`
				TargetType       string `json:"target_type"`
				TargetDivisionID *int64 `json:"target_division_id"`
				PublishDate      string `json:"publish_date"`
			}
			if err := c.Bind(&body); err != nil {
				return c.Error(400, err.Error())
			}
			title = body.Title
			content = body.Content
			targetType = body.TargetType
			targetDivisionID = body.TargetDivisionID
		}

		a, err := services.AnnouncementService{}.Create(c.Request.Context(), &models.Announcement{
			Title: title, Content: content, BannerURL: bannerURL,
			TargetType: targetType, TargetDivisionID: targetDivisionID,
			PublishDate: time.Now(), CreatedByID: user.ID,
		})
		if err != nil {
			return c.Error(500, err.Error())
		}

		if strings.HasPrefix(ct, "multipart/form-data") {
			if form := c.Request.MultipartForm; form != nil {
				for _, fh := range form.File["attachments"] {
					f, err := fh.Open()
					if err != nil {
						continue
					}
					data, err := io.ReadAll(f)
					f.Close()
					if err != nil {
						continue
					}
					key := storageutil.Key("announcements/attachments", fh.Filename)
					url, err := storageutil.Upload(c.Request.Context(), key, data, fh.Header.Get("Content-Type"))
					if err != nil {
						continue
					}
					if _, err := orm.Create(c.Request.Context(), &models.AnnouncementAttachment{
						AnnouncementID: a.ID, FileURL: url, FileType: fh.Header.Get("Content-Type"),
					}); err != nil {
						log.Printf("failed to save attachment record: %v", err)
					}
				}
			}
		}
		services.LogActivity(c.Request.Context(), user.ID, "create", "announcement", a.ID,
			"Membuat pengumuman "+title, c.Request.RemoteAddr)
		return c.Success(201, "announcement created", a)
	})(ctx)
}

func fileExt(name string) string {
	if i := strings.LastIndex(name, "."); i >= 0 {
		return name[i:]
	}
	return ""
}
