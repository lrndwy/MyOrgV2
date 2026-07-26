package seed

import (
	"context"
	"fmt"
	"os"

	"backend/internal/auth"
	"backend/models"

	"github.com/lrndwy/gokil/orm"
)

var permissionDefs = []struct {
	Code        string
	Module      string
	Description string
}{
	{"settings.manage", "settings", "Manage organization settings"},
	{"users.view", "users", "View users"},
	{"users.create", "users", "Create users"},
	{"users.edit", "users", "Edit users"},
	{"users.delete", "users", "Delete users"},
	{"users.import", "users", "Import users"},
	{"roles.view", "roles", "View roles"},
	{"roles.create", "roles", "Create roles"},
	{"roles.edit", "roles", "Edit roles"},
	{"roles.delete", "roles", "Delete roles"},
	{"events.view", "events", "View events"},
	{"events.view_all", "events", "View all division events"},
	{"events.create", "events", "Create events"},
	{"events.edit", "events", "Edit events"},
	{"events.delete", "events", "Delete events"},
	{"attendance.submit", "attendance", "Submit attendance"},
	{"attendance.approve", "attendance", "Approve permission requests"},
	{"divisions.view", "divisions", "View divisions"},
	{"divisions.create", "divisions", "Create divisions"},
	{"divisions.edit", "divisions", "Edit divisions"},
	{"divisions.delete", "divisions", "Delete divisions"},
	{"permission.submit", "permission", "Submit permission requests"},
	{"violations.view", "violations", "View violations"},
	{"violations.manage", "violations", "Manage violations"},
	{"recruitment.manage", "recruitment", "Manage recruitments"},
	{"letters.view", "letters", "View letters"},
	{"letters.manage", "letters", "Manage letters"},
	{"announcement.create", "announcement", "Create announcements"},
	{"finance.view", "finance", "View finance"},
	{"finance.create", "finance", "Create finance transactions"},
	{"finance.edit", "finance", "Edit finance transactions"},
	{"finance.delete", "finance", "Delete finance transactions"},
	{"finance.categories.manage", "finance", "Manage finance categories"},
	{"storage.view", "storage", "View storage"},
	{"storage.upload", "storage", "Upload files"},
	{"storage.delete", "storage", "Delete files"},
	{"storage.manage", "storage", "Manage storage folders"},
	{"backup.manage", "backup", "Backup and restore system data"},
	{"view.activity", "activity", "View activity logs"},
}

func SeedIfEmpty(ctx context.Context) error {
	count, err := orm.Objects[models.User](ctx).Count()
	if err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	return seedAll(ctx)
}

func seedAll(ctx context.Context) error {
	permIDs := map[string]int64{}
	for _, def := range permissionDefs {
		p, err := orm.Create(ctx, &models.Permission{
			Code:        def.Code,
			Module:      def.Module,
			Description: def.Description,
		})
		if err != nil {
			return fmt.Errorf("seed permission %s: %w", def.Code, err)
		}
		permIDs[def.Code] = p.ID
	}

	adminRole, err := orm.Create(ctx, &models.Role{
		Name:        "Admin",
		Description: "System administrator",
		IsSystem:    true,
	})
	if err != nil {
		return err
	}

	bendaharaRole, err := orm.Create(ctx, &models.Role{
		Name:        "Bendahara",
		Description: "Finance officer",
		IsSystem:    false,
	})
	if err != nil {
		return err
	}

	for _, pid := range permIDs {
		if _, err := orm.Create(ctx, &models.RolePermission{
			RoleID:       adminRole.ID,
			PermissionID: pid,
		}); err != nil {
			return err
		}
	}

	for code, pid := range permIDs {
		if len(code) >= 8 && code[:8] == "finance." {
			if _, err := orm.Create(ctx, &models.RolePermission{
				RoleID:       bendaharaRole.ID,
				PermissionID: pid,
			}); err != nil {
				return err
			}
		}
	}

	div, err := orm.Create(ctx, &models.Division{
		Name:        "Umum",
		Description: "Divisi umum",
	})
	if err != nil {
		return err
	}

	password := os.Getenv("ADMIN_PASSWORD")
	if password == "" {
		password = "admin123"
	}
	hash, err := auth.HashPassword(password)
	if err != nil {
		return err
	}

	if _, err := orm.Create(ctx, &models.User{
		Username:     "admin",
		Email:        "admin@myorg.local",
		PasswordHash: hash,
		FullName:     "Administrator",
		DivisionID:   div.ID,
		RoleID:       adminRole.ID,
		Status:       "active",
	}); err != nil {
		return err
	}

	if _, err := orm.Create(ctx, &models.OrganizationSettings{
		WebName:                      "MyOrg",
		Theme:                        "system",
		AllowSelfRegister:            false,
		AllowCrossDivisionEventsView: false,
	}); err != nil {
		return err
	}

	for _, cat := range []models.LetterCategory{
		{Name: "Undangan", Code: "UND", StartNumber: 1, CurrentNumber: 0, NumberFormatTemplate: "{number:3}/{code}/{month_roman}/{year}"},
		{Name: "Surat Keputusan", Code: "SK", StartNumber: 1, CurrentNumber: 0, NumberFormatTemplate: "{number:3}/{code}/{month_roman}/{year}"},
		{Name: "Surat Masuk", Code: "SM-IN", StartNumber: 1, CurrentNumber: 0, NumberFormatTemplate: "{code}/{number:3}/{year}"},
	} {
		if _, err := orm.Create(ctx, &cat); err != nil {
			return err
		}
	}

	for _, vt := range []models.ViolationType{
		{Name: "Terlambat", Description: "Keterlambatan kegiatan", SPLevel: "SP1"},
		{Name: "Tidak Hadir", Description: "Tidak hadir tanpa keterangan", SPLevel: "SP2"},
	} {
		if _, err := orm.Create(ctx, &vt); err != nil {
			return err
		}
	}

	return nil
}

// SyncMissingPermissions adds new permission codes and grants them to Admin role.
func SyncMissingPermissions(ctx context.Context) error {
	adminRole, err := orm.Objects[models.Role](ctx).Filter("name", "Admin").First()
	if err != nil {
		return nil
	}
	for _, def := range permissionDefs {
		p, err := orm.Objects[models.Permission](ctx).Filter("code", def.Code).First()
		if err != nil {
			p, err = orm.Create(ctx, &models.Permission{
				Code: def.Code, Module: def.Module, Description: def.Description,
			})
			if err != nil {
				return err
			}
		}
		count, _ := orm.Objects[models.RolePermission](ctx).
			Filter("role_id", adminRole.ID).Filter("permission_id", p.ID).Count()
		if count == 0 {
			if _, err := orm.Create(ctx, &models.RolePermission{
				RoleID: adminRole.ID, PermissionID: p.ID,
			}); err != nil {
				return err
			}
		}
	}
	return nil
}


// SyncMissingSeedData ensures default reference data exists on existing databases.
func SyncMissingSeedData(ctx context.Context) error {
	count, _ := orm.Objects[models.LetterCategory](ctx).Filter("code", "SM-IN").Count()
	if count == 0 {
		if _, err := orm.Create(ctx, &models.LetterCategory{
			Name: "Surat Masuk", Code: "SM-IN", StartNumber: 1, CurrentNumber: 0,
			NumberFormatTemplate: "{code}/{number:3}/{year}",
		}); err != nil {
			return err
		}
	}
	vtCount, _ := orm.Objects[models.ViolationType](ctx).Count()
	if vtCount == 0 {
		for _, vt := range []models.ViolationType{
			{Name: "Terlambat", Description: "Keterlambatan kegiatan", SPLevel: "SP1"},
			{Name: "Tidak Hadir", Description: "Tidak hadir tanpa keterangan", SPLevel: "SP2"},
		} {
			if _, err := orm.Create(ctx, &vt); err != nil {
				return err
			}
		}
	}
	return nil
}
