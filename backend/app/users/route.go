package users

import (
	"backend/internal/auth"
	"backend/internal/permission"
	"backend/models"
	"backend/services"

	"github.com/lrndwy/gokil/views"
)

func GET(ctx *views.Context) error {
	return auth.RequireAuth(func(c *views.Context) error {
		user, _ := auth.CurrentUser(c.Request.Context())
		// Daftar user juga dibutuhkan dropdown form pencatatan pelanggaran.
		ok, err := permission.UserHasAny(c, user, "users.view", "violations.manage")
		if err != nil || !ok {
			return c.Error(403, "forbidden")
		}
		list, err := services.UserService{}.ListPublic(c.Request.Context(), c.Query("status"))
		if err != nil {
			return c.Error(500, err.Error())
		}
		return c.Success(200, "users", list)
	})(ctx)
}

func POST(ctx *views.Context) error {
	return auth.RequireAuth(func(c *views.Context) error {
		user, _ := auth.CurrentUser(c.Request.Context())
		ok, err := permission.UserHas(c, user, "users.create")
		if err != nil || !ok {
			return c.Error(403, "forbidden")
		}
		var body struct {
			Username   string `json:"username"`
			Email      string `json:"email"`
			Password   string `json:"password"`
			FullName   string `json:"full_name"`
			DivisionID int64  `json:"division_id"`
			RoleID     int64  `json:"role_id"`
		}
		if err := c.Bind(&body); err != nil {
			return c.Error(400, err.Error())
		}
		u, err := services.UserService{}.Create(c.Request.Context(), &models.User{
			Username: body.Username, Email: body.Email, FullName: body.FullName,
			DivisionID: body.DivisionID, RoleID: body.RoleID,
		}, body.Password)
		if err != nil {
			return c.Error(500, err.Error())
		}
		services.LogActivity(c.Request.Context(), user.ID, "create", "user", u.ID,
			"Membuat pengguna "+body.FullName, c.Request.RemoteAddr)
		return c.Success(201, "user created", u)
	})(ctx)
}
