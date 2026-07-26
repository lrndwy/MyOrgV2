package settings

import (
	"encoding/json"

	"backend/internal/auth"
	"backend/internal/permission"
	"backend/services"

	"github.com/lrndwy/gokil/views"
)

func GET(ctx *views.Context) error {
	s, err := services.SettingsService{}.GetPublic(ctx.Request.Context())
	if err != nil {
		return ctx.Error(404, "settings not found")
	}
	return ctx.Success(200, "settings", map[string]any{
		"web_name": s.WebName, "logo_url": s.LogoURL, "icon_url": s.IconURL,
		"theme": s.Theme, "appearance": s.Appearance,
		"allow_self_register":              s.AllowSelfRegister,
		"allow_cross_division_events_view": s.AllowCrossDivisionEventsView,
	})
}

func PUT(ctx *views.Context) error {
	return auth.RequireAuth(putSettings)(ctx)
}

func putSettings(ctx *views.Context) error {
	user, _ := auth.CurrentUser(ctx.Request.Context())
	ok, err := permission.UserHas(ctx, user, "settings.manage")
	if err != nil {
		return ctx.Error(500, err.Error())
	}
	if !ok {
		return ctx.Error(403, "forbidden")
	}
	if err := ctx.ParseMultipart(10 << 20); err != nil {
		return ctx.Error(400, err.Error())
	}
	values := map[string]any{}
	if v := ctx.Request.FormValue("web_name"); v != "" {
		values["web_name"] = v
	}
	if v := ctx.Request.FormValue("theme"); v != "" {
		values["theme"] = v
	}
	if v := ctx.Request.FormValue("allow_self_register"); v != "" {
		values["allow_self_register"] = v == "true" || v == "1"
	}
	if v := ctx.Request.FormValue("allow_cross_division_events_view"); v != "" {
		values["allow_cross_division_events_view"] = v == "true" || v == "1"
	}
	if raw := ctx.Request.FormValue("json"); raw != "" {
		var body map[string]any
		if err := json.Unmarshal([]byte(raw), &body); err == nil {
			for k, v := range body {
				values[k] = v
			}
		}
	}
	logo, logoHdr, _ := ctx.FormFile("logo")
	icon, iconHdr, _ := ctx.FormFile("icon")
	s, err := services.SettingsService{}.Update(ctx.Request.Context(), values, logo, icon, logoHdr, iconHdr)
	if err != nil {
		return ctx.Error(500, err.Error())
	}
	return ctx.Success(200, "settings updated", s)
}
