package wallets

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
		ok, _ := permission.UserHas(c, user, "finance.view")
		if !ok {
			return c.Error(403, "forbidden")
		}
		wallets, err := services.FinanceService{}.ListWallets(c.Request.Context())
		if err != nil {
			return c.Error(500, err.Error())
		}
		return c.Success(200, "wallets", wallets)
	})(ctx)
}

func POST(ctx *views.Context) error {
	return auth.RequireAuth(func(c *views.Context) error {
		user, _ := auth.CurrentUser(c.Request.Context())
		ok, _ := permission.UserHas(c, user, "finance.wallets.manage")
		if !ok {
			return c.Error(403, "forbidden")
		}
		var body struct {
			Name           string  `json:"name"`
			Description    string  `json:"description"`
			InitialBalance float64 `json:"initial_balance"`
		}
		if err := c.Bind(&body); err != nil {
			return c.Error(400, err.Error())
		}
		if body.Name == "" {
			return c.Error(400, "nama wallet wajib diisi")
		}
		w, err := services.FinanceService{}.CreateWallet(c.Request.Context(), &models.Wallet{
			Name: body.Name, Description: body.Description,
			InitialBalance: body.InitialBalance, IsActive: true,
		})
		if err != nil {
			return c.Error(500, err.Error())
		}
		services.LogActivity(c.Request.Context(), user.ID, "create", "wallet", w.ID,
			"Membuat wallet "+w.Name, c.Request.RemoteAddr)
		return c.Success(201, "wallet created", w)
	})(ctx)
}
