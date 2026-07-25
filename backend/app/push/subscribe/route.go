package subscribe

import (
	"backend/internal/auth"
	"backend/models"

	"github.com/lrndwy/gokil/orm"
	"github.com/lrndwy/gokil/views"
)

func GET(ctx *views.Context) error {
	return auth.RequireAuth(listSubscriptions)(ctx)
}

func POST(ctx *views.Context) error {
	return auth.RequireAuth(createSubscription)(ctx)
}

func DELETE(ctx *views.Context) error {
	return auth.RequireAuth(deleteSubscription)(ctx)
}

func listSubscriptions(ctx *views.Context) error {
	user, _ := auth.CurrentUser(ctx.Request.Context())
	items, err := orm.Objects[models.PushSubscription](ctx.Request.Context()).
		Filter("user_id", user.ID).All()
	if err != nil {
		return err
	}
	return ctx.OK("subscriptions retrieved", items)
}

func createSubscription(ctx *views.Context) error {
	user, _ := auth.CurrentUser(ctx.Request.Context())
	var body struct {
		Endpoint string `json:"endpoint"`
		P256dh   string `json:"p256dh"`
		Auth     string `json:"auth"`
	}
	if err := ctx.Bind(&body); err != nil {
		return views.BadRequest(err.Error())
	}
	if body.Endpoint == "" {
		return views.BadRequest("endpoint required")
	}
	existing, err := orm.Objects[models.PushSubscription](ctx.Request.Context()).
		Filter("endpoint", body.Endpoint).First()
	if err == nil && existing != nil {
		_, _ = orm.UpdateByID[models.PushSubscription](ctx.Request.Context(), existing.ID, map[string]any{
			"user_id": user.ID,
			"p256dh":  body.P256dh,
			"auth":    body.Auth,
		})
		existing.UserID = user.ID
		existing.P256dh = body.P256dh
		existing.Auth = body.Auth
		return ctx.OK("subscription updated", existing)
	}
	sub, err := orm.Create(ctx.Request.Context(), &models.PushSubscription{
		UserID:   user.ID,
		Endpoint: body.Endpoint,
		P256dh:   body.P256dh,
		Auth:     body.Auth,
	})
	if err != nil {
		return err
	}
	return ctx.Created("subscription created", sub)
}

func deleteSubscription(ctx *views.Context) error {
	user, _ := auth.CurrentUser(ctx.Request.Context())
	endpoint := ctx.Query("endpoint")
	if endpoint == "" {
		return views.BadRequest("endpoint query required")
	}
	if _, err := orm.Objects[models.PushSubscription](ctx.Request.Context()).
		Filter("user_id", user.ID).
		Filter("endpoint", endpoint).
		Delete(); err != nil {
		return err
	}
	return ctx.OK("subscription deleted", nil)
}
