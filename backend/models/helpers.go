package models

import (
	"context"
	"strconv"

	"github.com/lrndwy/gokil/orm"
	"github.com/lrndwy/gokil/views"
)

func Ctx(ctx *views.Context) context.Context {
	return ctx.Request.Context()
}

func ParseID(s string) (int64, error) {
	return strconv.ParseInt(s, 10, 64)
}

func GetByID[T any](ctx *views.Context, idStr string) (*T, error) {
	id, err := ParseID(idStr)
	if err != nil {
		return nil, err
	}
	return orm.GetByID[T](Ctx(ctx), id)
}
