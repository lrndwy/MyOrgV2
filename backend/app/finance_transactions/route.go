package finance_transactions

import (
	"io"
	"strconv"
	"strings"
	"time"

	"backend/internal/auth"
	"backend/internal/permission"
	"backend/internal/storageutil"
	"backend/internal/timeutil"
	"backend/models"
	"backend/services"

	"github.com/lrndwy/gokil/orm"
	"github.com/lrndwy/gokil/views"
)

func GET(ctx *views.Context) error {
	return auth.RequireAuth(func(c *views.Context) error {
		user, _ := auth.CurrentUser(c.Request.Context())
		ok, _ := permission.UserHas(c, user, "finance.view")
		if !ok {
			return c.Error(403, "forbidden")
		}
		data, err := services.FinanceService{}.ListTransactionsWithCategories(c.Request.Context())
		if err != nil {
			return c.Error(500, err.Error())
		}
		return c.Success(200, "finance transactions", data)
	})(ctx)
}

func POST(ctx *views.Context) error {
	return auth.RequireAuth(func(c *views.Context) error {
		user, _ := auth.CurrentUser(c.Request.Context())
		ok, _ := permission.UserHas(c, user, "finance.create")
		if !ok {
			return c.Error(403, "forbidden")
		}

		var categoryID int64
		var txType string
		var amount float64
		var description, dateRaw, receiptURL string

		ct := c.Request.Header.Get("Content-Type")
		if strings.HasPrefix(ct, "multipart/form-data") {
			if err := c.ParseMultipart(20 << 20); err != nil {
				return c.Error(400, err.Error())
			}
			categoryID, _ = models.ParseID(c.Request.FormValue("category_id"))
			txType = c.Request.FormValue("type")
			if v := c.Request.FormValue("amount"); v != "" {
				amount, _ = strconv.ParseFloat(v, 64)
			}
			description = c.Request.FormValue("description")
			dateRaw = c.Request.FormValue("transaction_date")
			receipt, hdr, _ := c.FormFile("receipt")
			if receipt != nil && hdr != nil {
				defer receipt.Close()
				data, err := io.ReadAll(receipt)
				if err != nil {
					return c.Error(500, err.Error())
				}
				key := storageutil.Key("finance/receipts", "receipt"+fileExt(hdr.Filename))
				url, err := storageutil.Upload(c.Request.Context(), key, data, hdr.Header.Get("Content-Type"))
				if err != nil {
					return c.Error(500, err.Error())
				}
				receiptURL = url
			}
		} else {
			var body struct {
				CategoryID      int64   `json:"category_id"`
				Type            string  `json:"type"`
				Amount          float64 `json:"amount"`
				Description     string  `json:"description"`
				TransactionDate string  `json:"transaction_date"`
			}
			if err := c.Bind(&body); err != nil {
				return c.Error(400, err.Error())
			}
			categoryID = body.CategoryID
			txType = body.Type
			amount = body.Amount
			description = body.Description
			dateRaw = body.TransactionDate
		}

		if txType == "" {
			cat, err := orm.GetByID[models.FinanceCategory](c.Request.Context(), categoryID)
			if err == nil {
				txType = cat.Type
			}
		}

		td, err := timeutil.ParseFlexible(dateRaw)
		if err != nil || td.IsZero() {
			td = time.Now()
		}
		t, err := services.FinanceService{}.CreateTransaction(c.Request.Context(), &models.FinanceTransaction{
			CategoryID: categoryID, Type: txType, Amount: amount, Description: description,
			ReceiptURL: receiptURL, TransactionDate: td, CreatedByID: user.ID,
		})
		if err != nil {
			return c.Error(500, err.Error())
		}
		return c.Success(201, "transaction created", t)
	})(ctx)
}

func fileExt(name string) string {
	if i := strings.LastIndex(name, "."); i >= 0 {
		return name[i:]
	}
	return ""
}
