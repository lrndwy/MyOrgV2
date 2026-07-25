package slug

import (
	"backend/services"

	"github.com/lrndwy/gokil/views"
)

func GET(ctx *views.Context) error {
	rec, err := services.RecruitmentService{}.GetBySlug(ctx.Request.Context(), ctx.Param("slug"))
	if err != nil {
		return ctx.NotFound()
	}
	return ctx.Success(200, "recruitment", rec)
}
