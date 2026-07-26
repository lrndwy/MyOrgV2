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
	{"finance.wallets.manage", "finance", "Manage finance wallets"},
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

// SyncMissingPermissions menambahkan permission code baru dan memberikannya ke
// semua role admin-like (is_system atau bernama "Admin"). Permission turunan
// (mis. finance.wallets.manage) juga diberikan ke role yang sudah memegang
// permission induknya, supaya role kustom tidak diam-diam kehilangan akses
// fitur baru.
func SyncMissingPermissions(ctx context.Context) error {
	permByCode := map[string]*models.Permission{}
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
		permByCode[def.Code] = p
	}

	roles, err := orm.Objects[models.Role](ctx).All()
	if err != nil {
		return err
	}
	for _, role := range roles {
		if !role.IsSystem && role.Name != "Admin" {
			continue
		}
		for _, p := range permByCode {
			if err := grantIfMissing(ctx, role.ID, p.ID); err != nil {
				return err
			}
		}
	}

	// Permission baru yang merupakan perluasan dari permission lama:
	// role yang punya source otomatis mendapat target.
	derived := map[string]string{
		"finance.categories.manage": "finance.wallets.manage",
	}
	for sourceCode, targetCode := range derived {
		source, okS := permByCode[sourceCode]
		target, okT := permByCode[targetCode]
		if !okS || !okT {
			continue
		}
		holders, err := orm.Objects[models.RolePermission](ctx).
			Filter("permission_id", source.ID).All()
		if err != nil {
			return err
		}
		for _, rp := range holders {
			if err := grantIfMissing(ctx, rp.RoleID, target.ID); err != nil {
				return err
			}
		}
	}
	return nil
}

func grantIfMissing(ctx context.Context, roleID, permissionID int64) error {
	count, _ := orm.Objects[models.RolePermission](ctx).
		Filter("role_id", roleID).Filter("permission_id", permissionID).Count()
	if count > 0 {
		return nil
	}
	_, err := orm.Create(ctx, &models.RolePermission{
		RoleID: roleID, PermissionID: permissionID,
	})
	return err
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
