package services

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"regexp"
	"sort"
	"strings"

	"github.com/lrndwy/gokil/orm"
)

type BackupService struct{}

// backupTables memetakan key JSON di data.json ke nama tabel Postgres,
// terurut aman terhadap foreign key (parent lebih dulu).
var backupTables = []struct {
	Key   string
	Table string
}{
	{"permissions", "permission"},
	{"roles", "role"},
	{"role_permissions", "role_permission"},
	{"divisions", "division"},
	{"organization_settings", "organization_settings"},
	{"users", "user"},
	{"events", "event"},
	{"attendances", "attendance"},
	{"permission_requests", "permission_request"},
	{"violation_types", "violation_type"},
	{"violations", "violation"},
	{"recruitments", "recruitment"},
	{"recruitment_target_divisions", "recruitment_target_division"},
	{"recruitment_custom_fields", "recruitment_custom_field"},
	{"recruitment_submissions", "recruitment_submission"},
	{"letter_categories", "letter_category"},
	{"letter_templates", "letter_template"},
	{"letters", "letter"},
	{"announcements", "announcement"},
	{"announcement_attachments", "announcement_attachment"},
	{"finance_categories", "finance_category"},
	{"wallets", "wallet"},
	{"finance_transactions", "finance_transaction"},
	{"push_subscriptions", "push_subscription"},
	{"storage_folders", "storage_folder"},
	{"storage_files", "storage_file"},
	{"activity_logs", "activity_log"},
}

var identRe = regexp.MustCompile(`^[a-z_][a-z0-9_]*$`)

func quoteIdent(name string) string {
	return `"` + name + `"`
}

// ExportJSON membaca seluruh isi tabel via SELECT * sehingga semua kolom
// (termasuk password_hash yang di-hide dari JSON model) ikut ter-backup.
func (BackupService) ExportJSON(ctx context.Context) (map[string]any, error) {
	db := orm.DBFromContext(ctx)
	if db == nil {
		return nil, fmt.Errorf("no database in context")
	}
	payload := map[string]any{}
	for _, t := range backupTables {
		rows, err := db.QueryContext(ctx, fmt.Sprintf("SELECT * FROM %s ORDER BY id", quoteIdent(t.Table)))
		if err != nil {
			return nil, fmt.Errorf("%s: %w", t.Table, err)
		}
		cols, err := rows.Columns()
		if err != nil {
			rows.Close()
			return nil, fmt.Errorf("%s: %w", t.Table, err)
		}
		items := []map[string]any{}
		for rows.Next() {
			values := make([]any, len(cols))
			ptrs := make([]any, len(cols))
			for i := range values {
				ptrs[i] = &values[i]
			}
			if err := rows.Scan(ptrs...); err != nil {
				rows.Close()
				return nil, fmt.Errorf("%s: %w", t.Table, err)
			}
			row := map[string]any{}
			for i, col := range cols {
				switch v := values[i].(type) {
				case []byte:
					row[col] = string(v)
				default:
					row[col] = v
				}
			}
			items = append(items, row)
		}
		if err := rows.Err(); err != nil {
			rows.Close()
			return nil, fmt.Errorf("%s: %w", t.Table, err)
		}
		rows.Close()
		payload[t.Key] = items
	}
	return payload, nil
}

// CollectFileRefs memindai payload export dan mengembalikan pasangan
// key storage → URL untuk setiap kolom URL file (avatar, banner, selfie,
// lampiran, dsb.), apa pun provider storage-nya (lokal maupun S3/MinIO).
func (BackupService) CollectFileRefs(payload map[string]any) map[string]string {
	refs := map[string]string{}
	for _, tableData := range payload {
		rows, ok := tableData.([]map[string]any)
		if !ok {
			continue
		}
		for _, row := range rows {
			for col, val := range row {
				if col != "url" && !strings.HasSuffix(col, "_url") {
					continue
				}
				s, ok := val.(string)
				if !ok || s == "" || strings.HasPrefix(s, "data:") {
					continue
				}
				if key := StorageKeyFromURL(s); key != "" {
					refs[key] = s
				}
			}
		}
	}
	return refs
}

// StorageKeyFromURL menurunkan key storage dari URL yang tersimpan di DB.
// Format URL: "<base_url>/<key>" (local/S3 dengan base URL), "/storage/<key>"
// (local tanpa base URL), atau "https://<bucket>.s3.amazonaws.com/<key>".
func StorageKeyFromURL(url string) string {
	if base := strings.TrimSuffix(os.Getenv("GOKIL_STORAGE_BASE_URL"), "/"); base != "" {
		if strings.HasPrefix(url, base+"/") {
			return sanitizeStorageKey(strings.TrimPrefix(url, base+"/"))
		}
	}
	if strings.HasPrefix(url, "/storage/") {
		return sanitizeStorageKey(strings.TrimPrefix(url, "/storage/"))
	}
	if strings.HasPrefix(url, "http://") || strings.HasPrefix(url, "https://") {
		rest := url[strings.Index(url, "://")+3:]
		if slash := strings.Index(rest, "/"); slash >= 0 {
			path := rest[slash+1:]
			// Buang segmen bucket bila URL berbentuk <host>/<bucket>/<key>.
			if bucket := os.Getenv("GOKIL_STORAGE_BUCKET"); bucket != "" {
				path = strings.TrimPrefix(path, bucket+"/")
			}
			return sanitizeStorageKey(path)
		}
	}
	return ""
}

func sanitizeStorageKey(key string) string {
	key = strings.TrimPrefix(key, "/")
	if key == "" || strings.Contains(key, "..") {
		return ""
	}
	if i := strings.IndexAny(key, "?#"); i >= 0 {
		key = key[:i]
	}
	return key
}

// RestoreJSON meng-upsert setiap baris dengan ID eksplisit (ON CONFLICT (id)
// DO UPDATE) dalam satu transaksi, lalu menyinkronkan sequence tiap tabel
// agar insert berikutnya tidak bentrok dengan ID hasil restore.
func (BackupService) RestoreJSON(ctx context.Context, payload map[string]json.RawMessage) (map[string]int, error) {
	stats := map[string]int{}
	err := orm.WithTx(ctx, func(txCtx context.Context, tx *orm.Tx) error {
		for _, t := range backupTables {
			raw, ok := payload[t.Key]
			if !ok || len(raw) == 0 || string(raw) == "null" {
				continue
			}
			var items []map[string]any
			if err := json.Unmarshal(raw, &items); err != nil {
				return fmt.Errorf("%s: %w", t.Key, err)
			}
			for _, row := range items {
				if err := upsertRow(txCtx, tx, t.Table, row); err != nil {
					return fmt.Errorf("%s: %w", t.Key, err)
				}
			}
			if len(items) > 0 {
				if err := syncSequence(txCtx, tx, t.Table); err != nil {
					return fmt.Errorf("%s: %w", t.Key, err)
				}
			}
			stats[t.Key] = len(items)
		}
		return nil
	})
	if err != nil {
		return stats, err
	}
	return stats, nil
}

func upsertRow(ctx context.Context, tx *orm.Tx, table string, row map[string]any) error {
	if _, ok := row["id"]; !ok {
		return fmt.Errorf("row tanpa kolom id")
	}
	// Backup lama (berbasis JSON model) tidak menyertakan password_hash.
	if table == "user" {
		if _, ok := row["password_hash"]; !ok {
			row["password_hash"] = ""
		}
	}
	cols := make([]string, 0, len(row))
	for col := range row {
		if !identRe.MatchString(col) {
			return fmt.Errorf("kolom tidak valid: %q", col)
		}
		cols = append(cols, col)
	}
	sort.Strings(cols)

	colNames := make([]string, len(cols))
	placeholders := make([]string, len(cols))
	args := make([]any, len(cols))
	updates := []string{}
	for i, col := range cols {
		colNames[i] = quoteIdent(col)
		placeholders[i] = fmt.Sprintf("$%d", i+1)
		args[i] = normalizeSQLValue(row[col])
		if col != "id" {
			updates = append(updates, fmt.Sprintf("%s = EXCLUDED.%s", quoteIdent(col), quoteIdent(col)))
		}
	}

	var query string
	if len(updates) == 0 {
		query = fmt.Sprintf("INSERT INTO %s (%s) VALUES (%s) ON CONFLICT (id) DO NOTHING",
			quoteIdent(table), joinComma(colNames), joinComma(placeholders))
	} else {
		query = fmt.Sprintf("INSERT INTO %s (%s) VALUES (%s) ON CONFLICT (id) DO UPDATE SET %s",
			quoteIdent(table), joinComma(colNames), joinComma(placeholders), joinComma(updates))
	}
	_, err := tx.ExecContext(ctx, query, args...)
	return err
}

// normalizeSQLValue menyiapkan nilai hasil json.Unmarshal agar bisa dikirim
// sebagai parameter SQL (objek/array JSON diserialisasi kembali ke string).
func normalizeSQLValue(v any) any {
	switch val := v.(type) {
	case map[string]any, []any:
		raw, err := json.Marshal(val)
		if err != nil {
			return nil
		}
		return string(raw)
	default:
		return v
	}
}

func syncSequence(ctx context.Context, tx *orm.Tx, table string) error {
	var maxID *int64
	if err := tx.QueryRowContext(ctx,
		fmt.Sprintf("SELECT MAX(id) FROM %s", quoteIdent(table))).Scan(&maxID); err != nil {
		return err
	}
	if maxID == nil || *maxID <= 0 {
		return nil
	}
	_, err := tx.ExecContext(ctx,
		"SELECT setval(pg_get_serial_sequence($1, 'id'), $2, true)",
		quoteIdent(table), *maxID)
	return err
}

func joinComma(parts []string) string {
	out := ""
	for i, p := range parts {
		if i > 0 {
			out += ", "
		}
		out += p
	}
	return out
}
