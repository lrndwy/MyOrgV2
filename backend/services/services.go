package services

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"strings"
	"time"

	"backend/internal/auth"
	"backend/internal/letterutil"
	"backend/internal/storageutil"
	"backend/models"

	"github.com/lrndwy/gokil/orm"
)

type SettingsService struct{}

func (SettingsService) GetPublic(ctx context.Context) (*models.OrganizationSettings, error) {
	s, err := orm.Objects[models.OrganizationSettings](ctx).First()
	if err != nil {
		return nil, err
	}
	return s, nil
}

func (SettingsService) Get(ctx context.Context) (*models.OrganizationSettings, error) {
	return SettingsService{}.GetPublic(ctx)
}

func (SettingsService) Update(ctx context.Context, values map[string]any, logo, icon multipart.File, logoHdr, iconHdr *multipart.FileHeader) (*models.OrganizationSettings, error) {
	s, err := orm.Objects[models.OrganizationSettings](ctx).First()
	if err != nil {
		return nil, err
	}
	if logo != nil && logoHdr != nil {
		defer logo.Close()
		data, err := io.ReadAll(logo)
		if err != nil {
			return nil, err
		}
		key := storageutil.Key("settings", "logo"+ext(logoHdr.Filename))
		url, err := storageutil.Upload(ctx, key, data, logoHdr.Header.Get("Content-Type"))
		if err != nil {
			return nil, err
		}
		values["logo_url"] = url
	}
	if icon != nil && iconHdr != nil {
		defer icon.Close()
		data, err := io.ReadAll(icon)
		if err != nil {
			return nil, err
		}
		key := storageutil.Key("settings", "icon"+ext(iconHdr.Filename))
		url, err := storageutil.Upload(ctx, key, data, iconHdr.Header.Get("Content-Type"))
		if err != nil {
			return nil, err
		}
		values["icon_url"] = url
	}
	return orm.UpdateByID[models.OrganizationSettings](ctx, s.ID, values)
}

func ext(name string) string {
	if i := strings.LastIndex(name, "."); i >= 0 {
		return name[i:]
	}
	return ""
}

type AuthService struct{}

type LoginResult struct {
	Token string         `json:"token"`
	User  map[string]any `json:"user"`
}

func (AuthService) Login(ctx context.Context, username, password string) (*LoginResult, error) {
	u, err := orm.Objects[models.User](ctx).Filter("username", username).First()
	if err != nil {
		u, err = orm.Objects[models.User](ctx).Filter("email", username).First()
		if err != nil {
			return nil, fmt.Errorf("invalid credentials")
		}
	}
	if u.Status != "active" {
		return nil, fmt.Errorf("account inactive")
	}
	if !auth.CheckPassword(u.PasswordHash, password) {
		return nil, fmt.Errorf("invalid credentials")
	}
	token, err := auth.IssueToken(u.ID)
	if err != nil {
		return nil, err
	}
	return &LoginResult{Token: token, User: userPayload(ctx, u)}, nil
}

func userPayload(ctx context.Context, u *models.User) map[string]any {
	out := map[string]any{
		"id": u.ID, "username": u.Username, "email": u.Email,
		"full_name": u.FullName, "avatar_url": u.AvatarURL,
		"division_id": u.DivisionID, "role_id": u.RoleID, "status": u.Status,
	}
	if role, err := orm.GetByID[models.Role](ctx, u.RoleID); err == nil {
		out["role"] = role.Name
	}
	if div, err := orm.GetByID[models.Division](ctx, u.DivisionID); err == nil {
		out["division"] = div.Name
	}
	return out
}

func (UserService) PublicView(ctx context.Context, u *models.User) map[string]any {
	return userPayload(ctx, u)
}

func (AuthService) Register(ctx context.Context, username, email, password, fullName string, divisionID int64) (*models.User, error) {
	settings, err := orm.Objects[models.OrganizationSettings](ctx).First()
	if err != nil {
		return nil, err
	}
	if !settings.AllowSelfRegister {
		return nil, fmt.Errorf("self registration disabled")
	}
	hash, err := auth.HashPassword(password)
	if err != nil {
		return nil, err
	}
	roles, err := orm.Objects[models.Role](ctx).Filter("is_system", false).All()
	if err != nil || len(roles) == 0 {
		return nil, fmt.Errorf("no assignable role")
	}
	roleID := roles[0].ID
	for _, r := range roles {
		if r.Name == "Anggota" {
			roleID = r.ID
			break
		}
	}
	return orm.Create(ctx, &models.User{
		Username: username, Email: email, PasswordHash: hash,
		FullName: fullName, DivisionID: divisionID, RoleID: roleID, Status: "active",
	})
}

type UserService struct{}

func (UserService) List(ctx context.Context, status string) ([]*models.User, error) {
	qs := orm.Objects[models.User](ctx)
	if status != "" {
		qs = qs.Filter("status", status)
	}
	return qs.OrderBy("-id").All()
}

func (UserService) ListPublic(ctx context.Context, status string) ([]map[string]any, error) {
	users, err := UserService{}.List(ctx, status)
	if err != nil {
		return nil, err
	}
	return enrichUsers(ctx, users), nil
}

func enrichUsers(ctx context.Context, users []*models.User) []map[string]any {
	divs, _ := orm.Objects[models.Division](ctx).All()
	roles, _ := orm.Objects[models.Role](ctx).All()
	divMap := map[int64]string{}
	for _, d := range divs {
		divMap[d.ID] = d.Name
	}
	roleMap := map[int64]string{}
	for _, r := range roles {
		roleMap[r.ID] = r.Name
	}
	out := make([]map[string]any, len(users))
	for i, u := range users {
		item := map[string]any{
			"id": u.ID, "username": u.Username, "email": u.Email,
			"full_name": u.FullName, "avatar_url": u.AvatarURL,
			"division_id": u.DivisionID, "role_id": u.RoleID, "status": u.Status,
			"created_at": u.CreatedAt, "updated_at": u.UpdatedAt,
			"phone": u.Phone, "hometown": u.Hometown,
		}
		if name, ok := divMap[u.DivisionID]; ok {
			item["division"] = name
		}
		if name, ok := roleMap[u.RoleID]; ok {
			item["role"] = name
		}
		out[i] = item
	}
	return out
}

func (UserService) Get(ctx context.Context, id int64) (*models.User, error) {
	return orm.GetByID[models.User](ctx, id)
}

func (UserService) Create(ctx context.Context, u *models.User, password string) (*models.User, error) {
	hash, err := auth.HashPassword(password)
	if err != nil {
		return nil, err
	}
	u.PasswordHash = hash
	u.Status = "active"
	return orm.Create(ctx, u)
}

func (UserService) Update(ctx context.Context, id int64, values map[string]any) (*models.User, error) {
	delete(values, "password_hash")
	return orm.UpdateByID[models.User](ctx, id, values)
}

func (UserService) Delete(ctx context.Context, id int64) error {
	_, err := orm.DeleteByID[models.User](ctx, id)
	return err
}

func (UserService) ChangePassword(ctx context.Context, id int64, newPassword string) error {
	hash, err := auth.HashPassword(newPassword)
	if err != nil {
		return err
	}
	_, err = orm.UpdateByID[models.User](ctx, id, map[string]any{"password_hash": hash})
	return err
}

func (UserService) UploadAvatar(ctx context.Context, id int64, file multipart.File, hdr *multipart.FileHeader) (string, error) {
	defer file.Close()
	data, err := io.ReadAll(file)
	if err != nil {
		return "", err
	}
	key := storageutil.Key("avatars", "avatar"+ext(hdr.Filename))
	url, err := storageutil.Upload(ctx, key, data, hdr.Header.Get("Content-Type"))
	if err != nil {
		return "", err
	}
	if _, err := orm.UpdateByID[models.User](ctx, id, map[string]any{"avatar_url": url}); err != nil {
		return "", err
	}
	return url, nil
}

func (UserService) ImportCSV(ctx context.Context, rows []map[string]string) (success int, failures []map[string]string) {
	for _, row := range rows {
		divName := row["division"]
		divs, _ := orm.Objects[models.Division](ctx).Filter("name", divName).All()
		if len(divs) == 0 {
			failures = append(failures, map[string]string{"row": row["username"], "error": "division not found"})
			continue
		}
		roles, _ := orm.Objects[models.Role](ctx).Filter("name", row["role"]).All()
		if len(roles) == 0 {
			failures = append(failures, map[string]string{"row": row["username"], "error": "role not found"})
			continue
		}
		pwd := row["password"]
		if pwd == "" {
			pwd = "changeme123"
		}
		_, err := UserService{}.Create(ctx, &models.User{
			Username: row["username"], Email: row["email"], FullName: row["full_name"],
			DivisionID: divs[0].ID, RoleID: roles[0].ID, Phone: row["phone"],
		}, pwd)
		if err != nil {
			failures = append(failures, map[string]string{"row": row["username"], "error": err.Error()})
			continue
		}
		success++
	}
	return success, failures
}

type RoleService struct{}

func (RoleService) List(ctx context.Context) ([]*models.Role, error) {
	return orm.Objects[models.Role](ctx).OrderBy("name").All()
}

func (RoleService) ListPublic(ctx context.Context) ([]map[string]any, error) {
	roles, err := RoleService{}.List(ctx)
	if err != nil {
		return nil, err
	}
	users, err := orm.Objects[models.User](ctx).All()
	if err != nil {
		return nil, err
	}
	counts := map[int64]int{}
	for _, u := range users {
		if u.Status == "deleted" {
			continue
		}
		counts[u.RoleID]++
	}
	out := make([]map[string]any, len(roles))
	for i, r := range roles {
		out[i] = map[string]any{
			"id":          r.ID,
			"name":        r.Name,
			"description": r.Description,
			"is_system":   r.IsSystem,
			"created_at":  r.CreatedAt,
			"updated_at":  r.UpdatedAt,
			"user_count":  counts[r.ID],
		}
	}
	return out, nil
}

func (RoleService) Create(ctx context.Context, name, description string) (*models.Role, error) {
	return orm.Create(ctx, &models.Role{Name: name, Description: description})
}

func (RoleService) Update(ctx context.Context, id int64, values map[string]any) (*models.Role, error) {
	return orm.UpdateByID[models.Role](ctx, id, values)
}

func (RoleService) Delete(ctx context.Context, id int64) error {
	count, err := orm.Objects[models.User](ctx).Filter("role_id", id).Count()
	if err != nil {
		return err
	}
	if count > 0 {
		return fmt.Errorf("role masih digunakan oleh %d anggota", count)
	}
	orm.Objects[models.RolePermission](ctx).Filter("role_id", id).Delete()
	_, err = orm.DeleteByID[models.Role](ctx, id)
	return err
}

func (RoleService) GetPermissions(ctx context.Context, roleID int64) ([]*models.Permission, []int64, error) {
	all, err := orm.Objects[models.Permission](ctx).OrderBy("module", "code").All()
	if err != nil {
		return nil, nil, err
	}
	rps, err := orm.Objects[models.RolePermission](ctx).Filter("role_id", roleID).All()
	if err != nil {
		return nil, nil, err
	}
	assigned := make([]int64, 0, len(rps))
	for _, rp := range rps {
		assigned = append(assigned, rp.PermissionID)
	}
	return all, assigned, nil
}

func (RoleService) ReplacePermissions(ctx context.Context, roleID int64, permissionIDs []int64) error {
	return orm.WithTx(ctx, func(txCtx context.Context, _ *orm.Tx) error {
		_, err := orm.Objects[models.RolePermission](txCtx).Filter("role_id", roleID).Delete()
		if err != nil {
			return err
		}
		for _, pid := range permissionIDs {
			if _, err := orm.Create(txCtx, &models.RolePermission{
				RoleID: roleID, PermissionID: pid,
			}); err != nil {
				return err
			}
		}
		return nil
	})
}

type DivisionService struct{}

func (DivisionService) List(ctx context.Context) ([]*models.Division, error) {
	return orm.Objects[models.Division](ctx).OrderBy("name").All()
}

func (DivisionService) Create(ctx context.Context, name, description string) (*models.Division, error) {
	return orm.Create(ctx, &models.Division{Name: name, Description: description})
}

func (DivisionService) Update(ctx context.Context, id int64, values map[string]any) (*models.Division, error) {
	return orm.UpdateByID[models.Division](ctx, id, values)
}

func (DivisionService) Delete(ctx context.Context, id int64) error {
	_, err := orm.DeleteByID[models.Division](ctx, id)
	return err
}

type EventService struct{}

func computeEventStatus(start, end, now time.Time) string {
	if now.Before(start) {
		return "upcoming"
	}
	if now.After(end) {
		return "finished"
	}
	return "ongoing"
}

func (EventService) syncEventStatus(ctx context.Context, e *models.Event) (*models.Event, error) {
	if e.Status == "cancelled" {
		return e, nil
	}
	next := computeEventStatus(e.StartTime, e.EndTime, time.Now())
	if next == e.Status {
		return e, nil
	}
	return orm.UpdateByID[models.Event](ctx, e.ID, map[string]any{"status": next})
}

func (EventService) ListVisible(ctx context.Context, user *auth.User, canViewAll bool) ([]*models.Event, error) {
	if err := (EventService{}).TransitionStatuses(ctx); err != nil {
		return nil, err
	}
	all, err := orm.Objects[models.Event](ctx).OrderBy("-start_time").All()
	if err != nil {
		return nil, err
	}
	if canViewAll {
		return all, nil
	}
	settings, _ := orm.Objects[models.OrganizationSettings](ctx).First()
	if settings != nil && settings.AllowCrossDivisionEventsView {
		return all, nil
	}
	u, err := orm.GetByID[models.User](ctx, user.ID)
	if err != nil {
		return nil, err
	}
	var visible []*models.Event
	for _, e := range all {
		if e.DivisionID == nil || *e.DivisionID == u.DivisionID {
			visible = append(visible, e)
		}
	}
	return visible, nil
}

func (EventService) Get(ctx context.Context, id int64) (*models.Event, error) {
	e, err := orm.GetByID[models.Event](ctx, id)
	if err != nil {
		return nil, err
	}
	return (EventService{}).syncEventStatus(ctx, e)
}

func (EventService) Create(ctx context.Context, e *models.Event) (*models.Event, error) {
	if e.Status != "cancelled" {
		e.Status = computeEventStatus(e.StartTime, e.EndTime, time.Now())
	}
	return orm.Create(ctx, e)
}

func (EventService) Update(ctx context.Context, id int64, values map[string]any) (*models.Event, error) {
	existing, err := orm.GetByID[models.Event](ctx, id)
	if err != nil {
		return nil, err
	}
	start := existing.StartTime
	end := existing.EndTime
	if v, ok := values["start_time"]; ok {
		if t, ok := v.(time.Time); ok {
			start = t
		}
	}
	if v, ok := values["end_time"]; ok {
		if t, ok := v.(time.Time); ok {
			end = t
		}
	}
	delete(values, "status")
	if existing.Status != "cancelled" {
		values["status"] = computeEventStatus(start, end, time.Now())
	}
	return orm.UpdateByID[models.Event](ctx, id, values)
}

func (EventService) Delete(ctx context.Context, id int64) error {
	_, err := orm.DeleteByID[models.Event](ctx, id)
	return err
}

func (EventService) TransitionStatuses(ctx context.Context) error {
	all, err := orm.Objects[models.Event](ctx).All()
	if err != nil {
		return err
	}
	now := time.Now()
	for _, e := range all {
		if e.Status == "cancelled" {
			continue
		}
		next := computeEventStatus(e.StartTime, e.EndTime, now)
		if next == e.Status {
			continue
		}
		if _, err := orm.UpdateByID[models.Event](ctx, e.ID, map[string]any{"status": next}); err != nil {
			return err
		}
	}
	return nil
}

func (EventService) Recap(ctx context.Context, eventID int64) (map[string]any, error) {
	event, err := orm.GetByID[models.Event](ctx, eventID)
	if err != nil {
		return nil, err
	}
	attendances, err := orm.Objects[models.Attendance](ctx).Filter("event_id", eventID).All()
	if err != nil {
		return nil, err
	}
	counts := map[string]int{"present": 0, "permitted": 0, "absent": 0, "rejected": 0}
	for _, a := range attendances {
		counts[a.Status]++
	}
	counts["total"] = len(attendances)
	return map[string]any{
		"event": event, "attendances": enrichAttendances(ctx, attendances), "summary": counts,
	}, nil
}

func enrichAttendances(ctx context.Context, attendances []*models.Attendance) []map[string]any {
	if len(attendances) == 0 {
		return []map[string]any{}
	}
	userIDs := make([]int64, 0, len(attendances))
	seen := map[int64]struct{}{}
	for _, a := range attendances {
		if _, ok := seen[a.UserID]; ok {
			continue
		}
		seen[a.UserID] = struct{}{}
		userIDs = append(userIDs, a.UserID)
	}
	userMap := map[int64]*models.User{}
	for _, uid := range userIDs {
		u, err := orm.GetByID[models.User](ctx, uid)
		if err == nil && u != nil {
			userMap[uid] = u
		}
	}
	out := make([]map[string]any, len(attendances))
	for i, a := range attendances {
		item := map[string]any{
			"id":            a.ID,
			"event_id":      a.EventID,
			"user_id":       a.UserID,
			"status":        a.Status,
			"selfie_url":    a.SelfieURL,
			"signature_url": a.SignatureURL,
			"checked_in_at": a.CheckedInAt,
		}
		if a.CheckedInAt != nil {
			item["attended_at"] = a.CheckedInAt
		}
		if u, ok := userMap[a.UserID]; ok {
			item["user"] = map[string]any{
				"id":         u.ID,
				"username":   u.Username,
				"email":      u.Email,
				"full_name":  u.FullName,
				"avatar_url": u.AvatarURL,
			}
			item["full_name"] = u.FullName
		}
		out[i] = item
	}
	return out
}

type AttendanceService struct{}

func (AttendanceService) Submit(ctx context.Context, eventID, userID int64, selfieData, signatureData string) (*models.Attendance, error) {
	event, err := orm.GetByID[models.Event](ctx, eventID)
	if err != nil {
		return nil, err
	}
	if event.Status != "ongoing" {
		return nil, fmt.Errorf("event is not ongoing")
	}
	existing, err := orm.Objects[models.Attendance](ctx).
		Filter("event_id", eventID).Filter("user_id", userID).First()
	if err == nil && existing != nil {
		return nil, fmt.Errorf("already checked in")
	}
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}

	selfieBytes, selfieCT, err := decodeUpload(selfieData)
	if err != nil {
		return nil, fmt.Errorf("invalid selfie: %w", err)
	}
	sigBytes, sigCT, err := decodeUpload(signatureData)
	if err != nil {
		return nil, fmt.Errorf("invalid signature: %w", err)
	}

	selfieKey := storageutil.Key(fmt.Sprintf("attendance/selfies/%d", eventID), fmt.Sprintf("%d.jpg", userID))
	selfieURL, err := storageutil.Upload(ctx, selfieKey, selfieBytes, selfieCT)
	if err != nil {
		return nil, err
	}
	sigKey := storageutil.Key(fmt.Sprintf("attendance/signatures/%d", eventID), fmt.Sprintf("%d.png", userID))
	sigURL, err := storageutil.Upload(ctx, sigKey, sigBytes, sigCT)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	return orm.Create(ctx, &models.Attendance{
		EventID: eventID, UserID: userID, Status: "present",
		SelfieURL: selfieURL, SignatureURL: sigURL, CheckedInAt: &now,
	})
}

func (AttendanceService) GetMine(ctx context.Context, eventID, userID int64) (*models.Attendance, error) {
	return orm.Objects[models.Attendance](ctx).
		Filter("event_id", eventID).Filter("user_id", userID).First()
}

func decodeUpload(data string) ([]byte, string, error) {
	if strings.HasPrefix(data, "data:") {
		return storageutil.DecodeDataURL(data)
	}
	return []byte(data), "application/octet-stream", nil
}

type PermissionRequestService struct{}

func (PermissionRequestService) Create(ctx context.Context, eventID, userID int64, reason, proofData string) (*models.PermissionRequest, error) {
	event, err := orm.GetByID[models.Event](ctx, eventID)
	if err != nil {
		return nil, err
	}
	if !event.AllowPermission {
		return nil, fmt.Errorf("permission not allowed for this event")
	}
	proofURL := ""
	if proofData != "" {
		data, ct, err := decodeUpload(proofData)
		if err != nil {
			return nil, err
		}
		key := storageutil.Key("permissions/proofs", fmt.Sprintf("%d-%d", eventID, userID))
		proofURL, err = storageutil.Upload(ctx, key, data, ct)
		if err != nil {
			return nil, err
		}
	}
	return orm.Create(ctx, &models.PermissionRequest{
		EventID: eventID, UserID: userID, Reason: reason, ProofURL: proofURL, Status: "pending",
	})
}

func (PermissionRequestService) ListMine(ctx context.Context, userID int64) ([]*models.PermissionRequest, error) {
	return orm.Objects[models.PermissionRequest](ctx).
		Filter("user_id", userID).OrderBy("-id").All()
}

func (PermissionRequestService) ListPending(ctx context.Context) ([]*models.PermissionRequest, error) {
	return orm.Objects[models.PermissionRequest](ctx).
		Filter("status", "pending").OrderBy("-id").All()
}

func (PermissionRequestService) Review(ctx context.Context, id, reviewerID int64, approve bool, note string) (*models.PermissionRequest, error) {
	var result *models.PermissionRequest
	err := orm.WithTx(ctx, func(txCtx context.Context, _ *orm.Tx) error {
		pr, err := orm.GetByID[models.PermissionRequest](txCtx, id)
		if err != nil {
			return err
		}
		if pr.Status != "pending" {
			return fmt.Errorf("already reviewed")
		}
		now := time.Now()
		status := "rejected"
		attStatus := "rejected"
		if approve {
			status = "approved"
			attStatus = "permitted"
		}
		result, err = orm.UpdateByID[models.PermissionRequest](txCtx, id, map[string]any{
			"status": status, "reviewed_by_id": reviewerID, "review_note": note, "reviewed_at": now,
		})
		if err != nil {
			return err
		}
		att, err := orm.Objects[models.Attendance](txCtx).
			Filter("event_id", pr.EventID).Filter("user_id", pr.UserID).First()
		if err == sql.ErrNoRows {
			now2 := time.Now()
			_, err = orm.Create(txCtx, &models.Attendance{
				EventID: pr.EventID, UserID: pr.UserID, Status: attStatus, CheckedInAt: &now2,
			})
			return err
		}
		if err != nil {
			return err
		}
		_, err = orm.UpdateByID[models.Attendance](txCtx, att.ID, map[string]any{"status": attStatus})
		return err
	})
	return result, err
}

type ViolationService struct{}

func (ViolationService) List(ctx context.Context, userID int64) ([]*models.Violation, error) {
	qs := orm.Objects[models.Violation](ctx)
	if userID > 0 {
		qs = qs.Filter("user_id", userID)
	}
	return qs.OrderBy("-issued_date").All()
}

func (ViolationService) Create(ctx context.Context, v *models.Violation) (*models.Violation, error) {
	return orm.Create(ctx, v)
}

func (ViolationService) Delete(ctx context.Context, id int64) error {
	_, err := orm.DeleteByID[models.Violation](ctx, id)
	return err
}

type RecruitmentService struct{}

func (RecruitmentService) List(ctx context.Context) ([]*models.Recruitment, error) {
	return orm.Objects[models.Recruitment](ctx).OrderBy("-id").All()
}

func (RecruitmentService) Create(ctx context.Context, r *models.Recruitment) (*models.Recruitment, error) {
	return orm.Create(ctx, r)
}

func (RecruitmentService) Update(ctx context.Context, id int64, values map[string]any) (*models.Recruitment, error) {
	return orm.UpdateByID[models.Recruitment](ctx, id, values)
}

func (RecruitmentService) GetBySlug(ctx context.Context, slug string) (*models.Recruitment, error) {
	return orm.Objects[models.Recruitment](ctx).Filter("slug", slug).Filter("status", "open").First()
}

func (RecruitmentService) ListSubmissions(ctx context.Context, recruitmentID int64) ([]*models.RecruitmentSubmission, error) {
	return orm.Objects[models.RecruitmentSubmission](ctx).
		Filter("recruitment_id", recruitmentID).OrderBy("-submitted_at").All()
}

func (RecruitmentService) SubmitPublic(ctx context.Context, slug string, sub *models.RecruitmentSubmission) (*models.RecruitmentSubmission, error) {
	rec, err := RecruitmentService{}.GetBySlug(ctx, slug)
	if err != nil {
		return nil, fmt.Errorf("recruitment not open")
	}
	sub.RecruitmentID = rec.ID
	sub.SubmittedAt = time.Now()
	sub.Status = "submitted"
	return orm.Create(ctx, sub)
}

type LetterService struct{}

func (LetterService) ListCategories(ctx context.Context) ([]*models.LetterCategory, error) {
	return orm.Objects[models.LetterCategory](ctx).OrderBy("code").All()
}

func (LetterService) CreateCategory(ctx context.Context, c *models.LetterCategory) (*models.LetterCategory, error) {
	if c.StartNumber <= 0 {
		c.StartNumber = 1
	}
	if c.NumberFormatTemplate == "" {
		c.NumberFormatTemplate = "{number:3}/{code}/{month_roman}/{year}"
	}
	if c.CurrentNumber < 0 {
		c.CurrentNumber = 0
	}
	return orm.Create(ctx, c)
}

func (LetterService) List(ctx context.Context, letterType string, categoryID int64) ([]*models.Letter, error) {
	qs := orm.Objects[models.Letter](ctx)
	if letterType != "" {
		qs = qs.Filter("type", letterType)
	}
	if categoryID > 0 {
		qs = qs.Filter("category_id", categoryID)
	}
	return qs.OrderBy("-id").All()
}

func (LetterService) CreateOutgoing(ctx context.Context, letter *models.Letter, templateID int64, createdBy int64) (*models.Letter, error) {
	var created *models.Letter
	err := orm.WithTx(ctx, func(txCtx context.Context, _ *orm.Tx) error {
		catID := letter.CategoryID
		if templateID > 0 {
			tmpl, err := orm.GetByID[models.LetterTemplate](txCtx, templateID)
			if err != nil {
				return err
			}
			catID = tmpl.CategoryID
			letter.CategoryID = catID
		}
		cat, err := orm.Objects[models.LetterCategory](txCtx).
			Filter("id", catID).ForUpdate().First()
		if err != nil {
			return err
		}
		nextNum := cat.CurrentNumber + 1
		if nextNum < cat.StartNumber {
			nextNum = cat.StartNumber
		}
		if len(letter.VariableValues) == 0 {
			letter.VariableValues = models.JSONField("{}")
		}
		var vals map[string]string
		_ = json.Unmarshal(letter.VariableValues.Raw(), &vals)
		if vals == nil {
			vals = map[string]string{}
		}
		segments := SegmentsFromVariableValues(vals)
		if letter.LetterCode == "" {
			code, err := FormatLetterNumber(cat.NumberFormatTemplate, nextNum, cat.Code, letter.LetterDate, segments, false)
			if err != nil {
				return err
			}
			letter.LetterCode = code
		}
		letter.Type = "outgoing"
		letter.CreatedByID = createdBy
		if letter.Subject != "" {
			vals["PERIHAL"] = letter.Subject
			vals["SUBJECT"] = letter.Subject
		}
		if letter.Recipient == "" {
			for _, key := range []string{"TUJUAN_INSTANSI", "PENERIMA", "RECIPIENT", "KEPADA", "TUJUAN"} {
				if v := strings.TrimSpace(vals[key]); v != "" {
					letter.Recipient = v
					break
				}
			}
		}
		if b, err := json.Marshal(vals); err == nil {
			letter.VariableValues = models.JSONField(b)
		}

		// Merge template docx if available.
		if templateID > 0 {
			tmpl, _ := orm.GetByID[models.LetterTemplate](txCtx, templateID)
			if tmpl != nil && tmpl.TemplateURL != "" {
				docx, err := storageutil.ReadURL(txCtx, tmpl.TemplateURL)
				if err == nil {
					repl := map[string]string{
						"{NOMOR_SURAT}": letter.LetterCode,
						"{NOMOR}":       letter.LetterCode,
						"{LETTER_CODE}": letter.LetterCode,
					}
					if letter.Subject != "" {
						repl["{PERIHAL}"] = letter.Subject
						repl["{SUBJECT}"] = letter.Subject
					}
					for k, v := range vals {
						key := k
						if !strings.HasPrefix(key, "{") {
							key = "{" + strings.ToUpper(key) + "}"
						}
						repl[key] = v
					}
					merged, err := letterutil.MergeDocx(docx, repl)
					if err == nil {
						key := storageutil.Key("letters/generated", fmt.Sprintf("letter-%d.docx", time.Now().Unix()))
						url, upErr := storageutil.Upload(txCtx, key, merged, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
						if upErr == nil {
							letter.DocumentURL = url
						}
					}
				}
			}
		}

		created, err = orm.Create(txCtx, letter)
		if err != nil {
			return err
		}
		_, err = orm.UpdateByID[models.LetterCategory](txCtx, cat.ID, map[string]any{"current_number": nextNum})
		return err
	})
	return created, err
}

func (LetterService) CreateIncoming(ctx context.Context, letter *models.Letter, createdBy int64) (*models.Letter, error) {
	if letter.CategoryID == 0 {
		cat, err := orm.Objects[models.LetterCategory](ctx).Filter("code", "SM-IN").First()
		if err == nil {
			letter.CategoryID = cat.ID
		}
	}
	letter.Type = "incoming"
	letter.CreatedByID = createdBy
	if len(letter.VariableValues) == 0 {
		letter.VariableValues = models.JSONField("{}")
	}
	if letter.AttachmentURL != "" && letter.LetterCode == "" {
		data, err := storageutil.ReadURL(ctx, letter.AttachmentURL)
		if err == nil {
			text, _, err := letterutil.ExtractText(ctx, data, letter.AttachmentURL)
			if err == nil {
				if code, ok := letterutil.DetectLetterCode(text); ok {
					letter.LetterCode = code
				}
			}
		}
	}
	return orm.Create(ctx, letter)
}

type AnnouncementService struct{}

func (AnnouncementService) ListForUser(ctx context.Context, userID int64) ([]*models.Announcement, error) {
	u, err := orm.GetByID[models.User](ctx, userID)
	if err != nil {
		return nil, err
	}
	all, err := orm.Objects[models.Announcement](ctx).OrderBy("-publish_date").All()
	if err != nil {
		return nil, err
	}
	var filtered []*models.Announcement
	for _, a := range all {
		if a.TargetType == "all" {
			filtered = append(filtered, a)
			continue
		}
		if a.TargetDivisionID != nil && *a.TargetDivisionID == u.DivisionID {
			filtered = append(filtered, a)
		}
	}
	return filtered, nil
}

func (AnnouncementService) Create(ctx context.Context, a *models.Announcement) (*models.Announcement, error) {
	return orm.Create(ctx, a)
}

func (AnnouncementService) Update(ctx context.Context, id int64, values map[string]any) (*models.Announcement, error) {
	return orm.UpdateByID[models.Announcement](ctx, id, values)
}

func (AnnouncementService) Delete(ctx context.Context, id int64) error {
	_, err := orm.DeleteByID[models.Announcement](ctx, id)
	return err
}

func (AnnouncementService) GetAttachments(ctx context.Context, announcementID int64) ([]*models.AnnouncementAttachment, error) {
	return orm.Objects[models.AnnouncementAttachment](ctx).
		Filter("announcement_id", announcementID).All()
}

type FinanceService struct{}

func (FinanceService) ListCategories(ctx context.Context) ([]*models.FinanceCategory, error) {
	return orm.Objects[models.FinanceCategory](ctx).OrderBy("name").All()
}

func (FinanceService) CreateCategory(ctx context.Context, c *models.FinanceCategory) (*models.FinanceCategory, error) {
	return orm.Create(ctx, c)
}

func (FinanceService) UpdateCategory(ctx context.Context, id int64, values map[string]any) (*models.FinanceCategory, error) {
	return orm.UpdateByID[models.FinanceCategory](ctx, id, values)
}

func (FinanceService) DeleteCategory(ctx context.Context, id int64) error {
	_, err := orm.DeleteByID[models.FinanceCategory](ctx, id)
	return err
}

func (FinanceService) ListTransactions(ctx context.Context) ([]*models.FinanceTransaction, error) {
	return orm.Objects[models.FinanceTransaction](ctx).OrderBy("-transaction_date").All()
}

func (FinanceService) ListTransactionsWithCategories(ctx context.Context) (map[string]any, error) {
	txs, err := orm.Objects[models.FinanceTransaction](ctx).OrderBy("-transaction_date").All()
	if err != nil {
		return nil, err
	}
	cats, err := orm.Objects[models.FinanceCategory](ctx).OrderBy("name").All()
	if err != nil {
		return nil, err
	}
	return map[string]any{"items": txs, "categories": cats}, nil
}

func (FinanceService) CreateTransaction(ctx context.Context, t *models.FinanceTransaction) (*models.FinanceTransaction, error) {
	return orm.Create(ctx, t)
}

func (FinanceService) UpdateTransaction(ctx context.Context, id int64, values map[string]any) (*models.FinanceTransaction, error) {
	return orm.UpdateByID[models.FinanceTransaction](ctx, id, values)
}

func (FinanceService) DeleteTransaction(ctx context.Context, id int64) error {
	_, err := orm.DeleteByID[models.FinanceTransaction](ctx, id)
	return err
}

func (FinanceService) Summary(ctx context.Context) (map[string]float64, error) {
	txs, err := FinanceService{}.ListTransactions(ctx)
	if err != nil {
		return nil, err
	}
	cats, err := FinanceService{}.ListCategories(ctx)
	if err != nil {
		return nil, err
	}
	catType := map[int64]string{}
	for _, c := range cats {
		catType[c.ID] = c.Type
	}
	income, expense := 0.0, 0.0
	for _, t := range txs {
		if catType[t.CategoryID] == "income" {
			income += t.Amount
		} else {
			expense += t.Amount
		}
	}
	return map[string]float64{"income": income, "expense": expense, "balance": income - expense}, nil
}

func (FinanceService) Dashboard(ctx context.Context) (map[string]any, error) {
	summary, err := FinanceService{}.Summary(ctx)
	if err != nil {
		return nil, err
	}
	txs, _ := FinanceService{}.ListTransactions(ctx)
	if len(txs) > 10 {
		txs = txs[:10]
	}
	return map[string]any{"summary": summary, "recent": txs}, nil
}

type ProfileService struct{}

func (ProfileService) Get(ctx context.Context, userID int64) (map[string]any, error) {
	u, err := orm.GetByID[models.User](ctx, userID)
	if err != nil {
		return nil, err
	}
	return userPayload(ctx, u), nil
}

func (ProfileService) Update(ctx context.Context, userID int64, values map[string]any) (*models.User, error) {
	delete(values, "password_hash")
	delete(values, "role_id")
	delete(values, "status")
	return orm.UpdateByID[models.User](ctx, userID, values)
}

func (ProfileService) ChangePassword(ctx context.Context, userID int64, oldPwd, newPwd string) error {
	u, err := orm.GetByID[models.User](ctx, userID)
	if err != nil {
		return err
	}
	if !auth.CheckPassword(u.PasswordHash, oldPwd) {
		return fmt.Errorf("incorrect old password")
	}
	return UserService{}.ChangePassword(ctx, userID, newPwd)
}

type ViolationTypeService struct{}

func (ViolationTypeService) List(ctx context.Context) ([]*models.ViolationType, error) {
	return orm.Objects[models.ViolationType](ctx).OrderBy("name").All()
}

func (ViolationTypeService) Create(ctx context.Context, v *models.ViolationType) (*models.ViolationType, error) {
	return orm.Create(ctx, v)
}

func (ViolationTypeService) Update(ctx context.Context, id int64, values map[string]any) (*models.ViolationType, error) {
	return orm.UpdateByID[models.ViolationType](ctx, id, values)
}

func (ViolationTypeService) Delete(ctx context.Context, id int64) error {
	_, err := orm.DeleteByID[models.ViolationType](ctx, id)
	return err
}

func (LetterService) ListTemplates(ctx context.Context) ([]*models.LetterTemplate, error) {
	return orm.Objects[models.LetterTemplate](ctx).OrderBy("name").All()
}

func (LetterService) CreateTemplate(ctx context.Context, t *models.LetterTemplate) (*models.LetterTemplate, error) {
	return orm.Create(ctx, t)
}

func (LetterService) UpdateTemplate(ctx context.Context, id int64, values map[string]any) (*models.LetterTemplate, error) {
	return orm.UpdateByID[models.LetterTemplate](ctx, id, values)
}

func (LetterService) DeleteTemplate(ctx context.Context, id int64) error {
	_, err := orm.DeleteByID[models.LetterTemplate](ctx, id)
	return err
}

func (LetterService) UpdateCategory(ctx context.Context, id int64, values map[string]any) (*models.LetterCategory, error) {
	return orm.UpdateByID[models.LetterCategory](ctx, id, values)
}

func (LetterService) DeleteCategory(ctx context.Context, id int64) error {
	count, _ := orm.Objects[models.Letter](ctx).Filter("category_id", id).Count()
	if count > 0 {
		return fmt.Errorf("kategori masih digunakan oleh %d surat", count)
	}
	_, err := orm.DeleteByID[models.LetterCategory](ctx, id)
	return err
}

func (LetterService) Delete(ctx context.Context, id int64) error {
	_, err := orm.DeleteByID[models.Letter](ctx, id)
	return err
}

func (LetterService) Update(ctx context.Context, id int64, values map[string]any) (*models.Letter, error) {
	return orm.UpdateByID[models.Letter](ctx, id, values)
}

func (LetterService) Get(ctx context.Context, id int64) (*models.Letter, error) {
	return orm.GetByID[models.Letter](ctx, id)
}

func (LetterService) GetTemplate(ctx context.Context, id int64) (*models.LetterTemplate, error) {
	return orm.GetByID[models.LetterTemplate](ctx, id)
}

func (LetterService) GetCategory(ctx context.Context, id int64) (*models.LetterCategory, error) {
	return orm.GetByID[models.LetterCategory](ctx, id)
}

func (LetterService) PreviewNextNumber(ctx context.Context, categoryID int64) (string, error) {
	return LetterService{}.PreviewNumber(ctx, categoryID, time.Now(), nil)
}

func (LetterService) PreviewNumber(ctx context.Context, categoryID int64, date time.Time, segments map[string]string) (string, error) {
	cat, err := orm.GetByID[models.LetterCategory](ctx, categoryID)
	if err != nil {
		return "", err
	}
	nextNum := cat.CurrentNumber + 1
	if nextNum < cat.StartNumber {
		nextNum = cat.StartNumber
	}
	return FormatLetterNumber(cat.NumberFormatTemplate, nextNum, cat.Code, date, segments, true)
}

func (LetterService) BulkDelete(ctx context.Context, ids []int64) int {
	svc := LetterService{}
	deleted := 0
	for _, id := range ids {
		if err := svc.Delete(ctx, id); err == nil {
			deleted++
		}
	}
	return deleted
}

type StorageService struct{}

func (StorageService) ListFolders(ctx context.Context) ([]*models.StorageFolder, error) {
	return orm.Objects[models.StorageFolder](ctx).OrderBy("name").All()
}

func (StorageService) CreateFolder(ctx context.Context, f *models.StorageFolder) (*models.StorageFolder, error) {
	return orm.Create(ctx, f)
}

func (StorageService) DeleteFolder(ctx context.Context, id int64) error {
	children, err := orm.Objects[models.StorageFolder](ctx).Filter("parent_id", id).Count()
	if err != nil {
		return err
	}
	if children > 0 {
		return fmt.Errorf("folder masih berisi subfolder")
	}
	fileCount, err := orm.Objects[models.StorageFile](ctx).Filter("folder_id", id).Count()
	if err != nil {
		return err
	}
	if fileCount > 0 {
		return fmt.Errorf("folder masih berisi %d file", fileCount)
	}
	_, err = orm.DeleteByID[models.StorageFolder](ctx, id)
	return err
}

func (StorageService) ListFiles(ctx context.Context, folderID *int64) ([]*models.StorageFile, error) {
	qs := orm.Objects[models.StorageFile](ctx)
	if folderID != nil {
		qs = qs.Filter("folder_id", *folderID)
	}
	return qs.OrderBy("name").All()
}

func (StorageService) CreateFile(ctx context.Context, f *models.StorageFile) (*models.StorageFile, error) {
	return orm.Create(ctx, f)
}

func (StorageService) DeleteFile(ctx context.Context, id int64) error {
	_, err := orm.DeleteByID[models.StorageFile](ctx, id)
	return err
}

type ActivityLogService struct{}

func (ActivityLogService) List(ctx context.Context, userID int64, resourceType string) ([]map[string]any, error) {
	qs := orm.Objects[models.ActivityLog](ctx)
	if userID > 0 {
		qs = qs.Filter("user_id", userID)
	}
	if resourceType != "" {
		qs = qs.Filter("resource_type", resourceType)
	}
	logs, err := qs.OrderBy("-created_at").Limit(200).All()
	if err != nil {
		return nil, err
	}
	userCache := map[int64]string{}
	out := make([]map[string]any, 0, len(logs))
	for _, l := range logs {
		uname := ""
		if uid, ok := userCache[l.UserID]; ok {
			uname = uid
		} else if u, err := orm.GetByID[models.User](ctx, l.UserID); err == nil {
			uname = u.FullName
			if uname == "" {
				uname = u.Username
			}
			userCache[l.UserID] = uname
		}
		out = append(out, map[string]any{
			"id":            l.ID,
			"user_id":       l.UserID,
			"user_name":     uname,
			"action":        l.Action,
			"resource_type": l.ResourceType,
			"resource_id":   l.ResourceID,
			"description":   l.Description,
			"ip_address":    l.IPAddress,
			"created_at":    l.CreatedAt,
		})
	}
	return out, nil
}

func LogActivity(ctx context.Context, userID int64, action, resourceType string, resourceID int64, description string, ip string) {
	orm.Create(ctx, &models.ActivityLog{
		UserID:       userID,
		Action:       action,
		ResourceType: resourceType,
		ResourceID:   resourceID,
		Description:  description,
		IPAddress:    ip,
	})
}
