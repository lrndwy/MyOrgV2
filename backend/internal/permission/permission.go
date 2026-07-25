package permission

import (
	"net/http"

	"backend/internal/auth"
	"backend/models"

	"github.com/lrndwy/gokil/orm"
	"github.com/lrndwy/gokil/views"
)

func Require(code string) views.Middleware {
	return func(next views.Handler) views.Handler {
		return auth.RequireAuth(func(ctx *views.Context) error {
			user, _ := auth.CurrentUser(ctx.Request.Context())
			if user == nil {
				return ctx.Error(http.StatusUnauthorized, "unauthorized")
			}
			ok, err := UserHas(ctx, user, code)
			if err != nil {
				return ctx.Error(http.StatusInternalServerError, err.Error())
			}
			if !ok {
				return ctx.Error(http.StatusForbidden, "forbidden")
			}
			return next(ctx)
		})
	}
}

func UserHas(ctx *views.Context, user *auth.User, code string) (bool, error) {
	if user.IsSystemAdmin {
		return true, nil
	}
	rdb := ctx.Request.Context()
	perms, err := orm.Objects[models.RolePermission](rdb).
		Filter("role_id", user.RoleID).
		All()
	if err != nil {
		return false, err
	}
	if len(perms) == 0 {
		return false, nil
	}
	ids := make([]int64, 0, len(perms))
	for _, rp := range perms {
		ids = append(ids, rp.PermissionID)
	}
	all, err := orm.Objects[models.Permission](rdb).Filter("code", code).All()
	if err != nil {
		return false, err
	}
	if len(all) == 0 {
		return false, nil
	}
	targetID := all[0].ID
	for _, id := range ids {
		if id == targetID {
			return true, nil
		}
	}
	return false, nil
}

func ListCodes(ctx *views.Context, user *auth.User) ([]string, error) {
	if user.IsSystemAdmin {
		all, err := orm.Objects[models.Permission](ctx.Request.Context()).All()
		if err != nil {
			return nil, err
		}
		codes := make([]string, 0, len(all))
		for _, p := range all {
			codes = append(codes, p.Code)
		}
		return codes, nil
	}
	rps, err := orm.Objects[models.RolePermission](ctx.Request.Context()).
		Filter("role_id", user.RoleID).
		All()
	if err != nil {
		return nil, err
	}
	codes := make([]string, 0, len(rps))
	for _, rp := range rps {
		p, err := orm.GetByID[models.Permission](ctx.Request.Context(), rp.PermissionID)
		if err != nil {
			continue
		}
		codes = append(codes, p.Code)
	}
	return codes, nil
}
