package services

import (
	"context"
	"encoding/json"
	"fmt"

	"backend/models"

	"github.com/lrndwy/gokil/orm"
)

type BackupService struct{}

func (BackupService) RestoreJSON(ctx context.Context, payload map[string]json.RawMessage) (map[string]int, error) {
	order := []struct {
		key string
		apply func(context.Context, json.RawMessage) (int, error)
	}{
		{"permissions", restorePermissions},
		{"roles", restoreRoles},
		{"role_permissions", restoreRolePermissions},
		{"divisions", restoreDivisions},
		{"letter_categories", restoreLetterCategories},
		{"organization_settings", restoreOrganizationSettings},
		{"users", restoreUsers},
		{"events", restoreEvents},
		{"letter_templates", restoreLetterTemplates},
		{"letters", restoreLetters},
		{"announcements", restoreAnnouncements},
		{"finance_categories", restoreFinanceCategories},
		{"finance_transactions", restoreFinanceTransactions},
		{"violation_types", restoreViolationTypes},
		{"storage_folders", restoreStorageFolders},
		{"storage_files", restoreStorageFiles},
	}

	stats := map[string]int{}
	for _, step := range order {
		raw, ok := payload[step.key]
		if !ok || len(raw) == 0 || string(raw) == "null" {
			continue
		}
		n, err := step.apply(ctx, raw)
		if err != nil {
			return stats, fmt.Errorf("%s: %w", step.key, err)
		}
		stats[step.key] = n
	}
	return stats, nil
}

func upsertByID[T any](ctx context.Context, id int64, item *T) error {
	if id <= 0 {
		_, err := orm.Create(ctx, item)
		return err
	}
	if _, err := orm.GetByID[T](ctx, id); err != nil {
		_, err = orm.Create(ctx, item)
		return err
	}
	raw, err := json.Marshal(item)
	if err != nil {
		return err
	}
	var values map[string]any
	if err := json.Unmarshal(raw, &values); err != nil {
		return err
	}
	delete(values, "id")
	delete(values, "created_at")
	delete(values, "updated_at")
	_, err = orm.UpdateByID[T](ctx, id, values)
	return err
}

func restorePermissions(ctx context.Context, raw json.RawMessage) (int, error) {
	var items []*models.Permission
	if err := json.Unmarshal(raw, &items); err != nil {
		return 0, err
	}
	for _, item := range items {
		if err := upsertByID(ctx, item.ID, item); err != nil {
			return 0, err
		}
	}
	return len(items), nil
}

func restoreRoles(ctx context.Context, raw json.RawMessage) (int, error) {
	var items []*models.Role
	if err := json.Unmarshal(raw, &items); err != nil {
		return 0, err
	}
	for _, item := range items {
		if err := upsertByID(ctx, item.ID, item); err != nil {
			return 0, err
		}
	}
	return len(items), nil
}

func restoreRolePermissions(ctx context.Context, raw json.RawMessage) (int, error) {
	var items []*models.RolePermission
	if err := json.Unmarshal(raw, &items); err != nil {
		return 0, err
	}
	for _, item := range items {
		if err := upsertByID(ctx, item.ID, item); err != nil {
			return 0, err
		}
	}
	return len(items), nil
}

func restoreDivisions(ctx context.Context, raw json.RawMessage) (int, error) {
	var items []*models.Division
	if err := json.Unmarshal(raw, &items); err != nil {
		return 0, err
	}
	for _, item := range items {
		if err := upsertByID(ctx, item.ID, item); err != nil {
			return 0, err
		}
	}
	return len(items), nil
}

func restoreLetterCategories(ctx context.Context, raw json.RawMessage) (int, error) {
	var items []*models.LetterCategory
	if err := json.Unmarshal(raw, &items); err != nil {
		return 0, err
	}
	for _, item := range items {
		if err := upsertByID(ctx, item.ID, item); err != nil {
			return 0, err
		}
	}
	return len(items), nil
}

func restoreOrganizationSettings(ctx context.Context, raw json.RawMessage) (int, error) {
	var items []*models.OrganizationSettings
	if err := json.Unmarshal(raw, &items); err != nil {
		return 0, err
	}
	for _, item := range items {
		if err := upsertByID(ctx, item.ID, item); err != nil {
			return 0, err
		}
	}
	return len(items), nil
}

func restoreUsers(ctx context.Context, raw json.RawMessage) (int, error) {
	var items []*models.User
	if err := json.Unmarshal(raw, &items); err != nil {
		return 0, err
	}
	for _, item := range items {
		if err := upsertByID(ctx, item.ID, item); err != nil {
			return 0, err
		}
	}
	return len(items), nil
}

func restoreEvents(ctx context.Context, raw json.RawMessage) (int, error) {
	var items []*models.Event
	if err := json.Unmarshal(raw, &items); err != nil {
		return 0, err
	}
	for _, item := range items {
		if err := upsertByID(ctx, item.ID, item); err != nil {
			return 0, err
		}
	}
	return len(items), nil
}

func restoreLetterTemplates(ctx context.Context, raw json.RawMessage) (int, error) {
	var items []*models.LetterTemplate
	if err := json.Unmarshal(raw, &items); err != nil {
		return 0, err
	}
	for _, item := range items {
		if err := upsertByID(ctx, item.ID, item); err != nil {
			return 0, err
		}
	}
	return len(items), nil
}

func restoreLetters(ctx context.Context, raw json.RawMessage) (int, error) {
	var items []*models.Letter
	if err := json.Unmarshal(raw, &items); err != nil {
		return 0, err
	}
	for _, item := range items {
		if err := upsertByID(ctx, item.ID, item); err != nil {
			return 0, err
		}
	}
	return len(items), nil
}

func restoreAnnouncements(ctx context.Context, raw json.RawMessage) (int, error) {
	var items []*models.Announcement
	if err := json.Unmarshal(raw, &items); err != nil {
		return 0, err
	}
	for _, item := range items {
		if err := upsertByID(ctx, item.ID, item); err != nil {
			return 0, err
		}
	}
	return len(items), nil
}

func restoreFinanceCategories(ctx context.Context, raw json.RawMessage) (int, error) {
	var items []*models.FinanceCategory
	if err := json.Unmarshal(raw, &items); err != nil {
		return 0, err
	}
	for _, item := range items {
		if err := upsertByID(ctx, item.ID, item); err != nil {
			return 0, err
		}
	}
	return len(items), nil
}

func restoreFinanceTransactions(ctx context.Context, raw json.RawMessage) (int, error) {
	var items []*models.FinanceTransaction
	if err := json.Unmarshal(raw, &items); err != nil {
		return 0, err
	}
	for _, item := range items {
		if err := upsertByID(ctx, item.ID, item); err != nil {
			return 0, err
		}
	}
	return len(items), nil
}

func restoreViolationTypes(ctx context.Context, raw json.RawMessage) (int, error) {
	var items []*models.ViolationType
	if err := json.Unmarshal(raw, &items); err != nil {
		return 0, err
	}
	for _, item := range items {
		if err := upsertByID(ctx, item.ID, item); err != nil {
			return 0, err
		}
	}
	return len(items), nil
}

func restoreStorageFolders(ctx context.Context, raw json.RawMessage) (int, error) {
	var items []*models.StorageFolder
	if err := json.Unmarshal(raw, &items); err != nil {
		return 0, err
	}
	for _, item := range items {
		if err := upsertByID(ctx, item.ID, item); err != nil {
			return 0, err
		}
	}
	return len(items), nil
}

func restoreStorageFiles(ctx context.Context, raw json.RawMessage) (int, error) {
	var items []*models.StorageFile
	if err := json.Unmarshal(raw, &items); err != nil {
		return 0, err
	}
	for _, item := range items {
		if err := upsertByID(ctx, item.ID, item); err != nil {
			return 0, err
		}
	}
	return len(items), nil
}
