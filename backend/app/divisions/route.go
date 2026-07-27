package divisions

import (
	"backend/internal/auth"
	"backend/internal/permission"
	"backend/services"

	"github.com/lrndwy/gokil/views"
)

// GET daftar divisi hanya butuh login: data referensi (nama + deskripsi) yang
// dipakai panel anggota (halaman divisi, profil) dan dropdown form admin
// (event, user) yang pemegang rolenya belum tentu punya divisions.view.
func GET(ctx *views.Context) error {
	return auth.RequireAuth(func(c *views.Context) error {
		list, err := services.DivisionService{}.List(c.Request.Context())
		if err != nil {
			return c.Error(500, err.Error())
		}
		return c.Success(200, "divisions", list)
	})(ctx)
}

func POST(ctx *views.Context) error {
	return auth.RequireAuth(func(c *views.Context) error {
		user, _ := auth.CurrentUser(c.Request.Context())
		ok, _ := permission.UserHas(c, user, "divisions.create")
		if !ok {
			return c.Error(403, "forbidden")
		}
		var body struct {
			Name        string `json:"name"`
			Description string `json:"description"`
		}
		if err := c.Bind(&body); err != nil {
			return c.Error(400, err.Error())
		}
		d, err := services.DivisionService{}.Create(c.Request.Context(), body.Name, body.Description)
		if err != nil {
			return c.Error(500, err.Error())
		}
		services.LogActivity(c.Request.Context(), user.ID, "create", "division", d.ID,
			"Membuat divisi "+body.Name, c.Request.RemoteAddr)
		return c.Success(201, "division created", d)
	})(ctx)
}
