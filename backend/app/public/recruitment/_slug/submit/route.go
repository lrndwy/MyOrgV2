package submit

import (
	"encoding/json"

	"backend/models"
	"backend/services"

	"github.com/lrndwy/gokil/views"
)

func POST(ctx *views.Context) error {
	var body struct {
		Name               string          `json:"name"`
		NIM                string          `json:"nim"`
		DivisionInterestID int64           `json:"division_interest_id"`
		Contact            string          `json:"contact"`
		CustomAnswers      json.RawMessage `json:"custom_answers"`
	}
	if err := ctx.Bind(&body); err != nil {
		return ctx.Error(400, err.Error())
	}
	sub, err := services.RecruitmentService{}.SubmitPublic(ctx.Request.Context(), ctx.Param("slug"), &models.RecruitmentSubmission{
		Name: body.Name, NIM: body.NIM, DivisionInterestID: body.DivisionInterestID,
		Contact: body.Contact, CustomAnswers: body.CustomAnswers,
	})
	if err != nil {
		return ctx.Error(400, err.Error())
	}
	return ctx.Success(201, "submitted", sub)
}
