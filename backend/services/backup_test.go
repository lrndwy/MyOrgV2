package services

import (
	"context"
	"encoding/json"
	"os"
	"strings"
	"testing"

	"github.com/lrndwy/gokil/orm"
)

func TestTruncateBackupTablesSQL(t *testing.T) {
	sql := truncateBackupTablesSQL()
	if !strings.HasPrefix(sql, "TRUNCATE ") {
		t.Fatalf("expected TRUNCATE prefix, got %q", sql)
	}
	if !strings.HasSuffix(sql, " CASCADE") {
		t.Fatalf("expected CASCADE suffix, got %q", sql)
	}
	if !strings.Contains(sql, `"user"`) {
		t.Fatalf("user table must be quoted, got %q", sql)
	}
	if strings.Contains(sql, "db_version") || strings.Contains(sql, "gokil_db_versions") {
		t.Fatalf("must not truncate migration tracking tables, got %q", sql)
	}
	for _, tbl := range backupTables {
		quoted := quoteIdent(tbl.Table)
		if !strings.Contains(sql, quoted) {
			t.Fatalf("missing table %s in %q", quoted, sql)
		}
	}
}

func TestRowInt64(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name string
		row  map[string]any
		want int64
		ok   bool
	}{
		{"float64", map[string]any{"id": float64(7)}, 7, true},
		{"int64", map[string]any{"id": int64(3)}, 3, true},
		{"string", map[string]any{"id": "12"}, 12, true},
		{"json.Number", map[string]any{"id": json.Number("4")}, 4, true},
		{"zero", map[string]any{"id": float64(0)}, 0, false},
		{"nil", map[string]any{"id": nil}, 0, false},
		{"missing", map[string]any{}, 0, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, ok := rowInt64(tc.row, "id")
			if ok != tc.ok || got != tc.want {
				t.Fatalf("rowInt64 = (%d, %v), want (%d, %v)", got, ok, tc.want, tc.ok)
			}
		})
	}
}

func TestShouldSkipActivityLog(t *testing.T) {
	t.Parallel()
	users := collectRowIDs([]map[string]any{
		{"id": float64(1)},
		{"id": "2"},
	})
	if len(users) != 2 {
		t.Fatalf("collectRowIDs = %d, want 2", len(users))
	}

	cases := []struct {
		name string
		row  map[string]any
		skip bool
	}{
		{"user ada", map[string]any{"user_id": float64(1)}, false},
		{"user string ada", map[string]any{"user_id": "2"}, false},
		{"user yatim", map[string]any{"user_id": float64(99)}, true},
		{"user_id 0", map[string]any{"user_id": float64(0)}, true},
		{"user_id null", map[string]any{"user_id": nil}, false},
		{"tanpa user_id", map[string]any{"id": float64(1)}, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := shouldSkipActivityLog(tc.row, users); got != tc.skip {
				t.Fatalf("shouldSkipActivityLog = %v, want %v", got, tc.skip)
			}
		})
	}
}

func TestRestoreJSONPermissionCodeConflict(t *testing.T) {
	if os.Getenv("BACKUP_RESTORE_INTEGRATION") != "1" {
		t.Skip("set BACKUP_RESTORE_INTEGRATION=1 and GOKIL_DB_DSN to run (wipes backup tables)")
	}
	dsn := os.Getenv("GOKIL_DB_DSN")
	if dsn == "" {
		t.Skip("GOKIL_DB_DSN is empty")
	}

	db, err := orm.Connect("postgres", dsn, 2, 1)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer db.Close()
	ctx := orm.WithDB(context.Background(), db)

	if _, err := db.ExecContext(ctx,
		`INSERT INTO "permission" (id, code, module, description) VALUES (1, 'settings.manage', 'settings', 'seed')`); err != nil {
		t.Fatalf("seed conflicting permission: %v", err)
	}

	payload := map[string]json.RawMessage{
		"permissions": json.RawMessage(`[
			{"id": 5, "code": "settings.manage", "module": "settings", "description": "from backup"}
		]`),
	}
	stats, err := BackupService{}.RestoreJSON(ctx, payload)
	if err != nil {
		t.Fatalf("RestoreJSON: %v", err)
	}
	if stats["permissions"] != 1 {
		t.Fatalf("stats permissions = %d, want 1", stats["permissions"])
	}

	var id int64
	var code, desc string
	if err := db.QueryRowContext(ctx,
		`SELECT id, code, description FROM "permission" WHERE code = 'settings.manage'`).
		Scan(&id, &code, &desc); err != nil {
		t.Fatalf("query restored permission: %v", err)
	}
	if id != 5 {
		t.Fatalf("id = %d, want 5 (seed id=1 must be replaced)", id)
	}
	if desc != "from backup" {
		t.Fatalf("description = %q, want from backup", desc)
	}

	var n int
	if err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM "permission"`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Fatalf("permission count = %d, want 1", n)
	}
}

func TestRestoreJSONOrphanActivityLogs(t *testing.T) {
	if os.Getenv("BACKUP_RESTORE_INTEGRATION") != "1" {
		t.Skip("set BACKUP_RESTORE_INTEGRATION=1 and GOKIL_DB_DSN to run (wipes backup tables)")
	}
	dsn := os.Getenv("GOKIL_DB_DSN")
	if dsn == "" {
		t.Skip("GOKIL_DB_DSN is empty")
	}

	db, err := orm.Connect("postgres", dsn, 2, 1)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer db.Close()
	ctx := orm.WithDB(context.Background(), db)

	payload := map[string]json.RawMessage{
		"roles": json.RawMessage(`[
			{"id": 1, "name": "Admin", "description": "", "is_system": true}
		]`),
		"divisions": json.RawMessage(`[
			{"id": 1, "name": "Umum", "description": ""}
		]`),
		"users": json.RawMessage(`[
			{"id": 1, "username": "admin", "email": "admin@example.com", "password_hash": "x",
			 "full_name": "Admin", "hometown": "", "phone": "", "avatar_url": "",
			 "division_id": 1, "role_id": 1, "status": "active"}
		]`),
		"activity_logs": json.RawMessage(`[
			{"id": 10, "user_id": 1, "action": "login", "resource_type": "auth", "resource_id": 1,
			 "description": "masuk", "ip_address": ""},
			{"id": 11, "user_id": 99, "action": "delete", "resource_type": "user", "resource_id": 99,
			 "description": "user sudah dihapus", "ip_address": ""}
		]`),
	}
	stats, err := BackupService{}.RestoreJSON(ctx, payload)
	if err != nil {
		t.Fatalf("RestoreJSON: %v", err)
	}
	if stats["users"] != 1 {
		t.Fatalf("stats users = %d, want 1", stats["users"])
	}
	if stats["activity_logs"] != 1 {
		t.Fatalf("stats activity_logs = %d, want 1 (orphan user_id=99 skipped)", stats["activity_logs"])
	}

	var n int
	if err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM activity_log`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 1 {
		t.Fatalf("activity_log count = %d, want 1", n)
	}
	var userID int64
	if err := db.QueryRowContext(ctx, `SELECT user_id FROM activity_log WHERE id = 10`).Scan(&userID); err != nil {
		t.Fatal(err)
	}
	if userID != 1 {
		t.Fatalf("kept log user_id = %d, want 1", userID)
	}
}

// TestRestoreJSONMerge memverifikasi: baris lokal yang tidak ada di ZIP
// dipertahankan, baris cocok di-update (fill-empty atau updated_at ZIP lebih
// baru), baris baru di-insert, natural key dipakai saat id tak ketemu, dan
// baris gagal dilewati tanpa membatalkan transaksi.
func TestRestoreJSONMerge(t *testing.T) {
	if os.Getenv("BACKUP_RESTORE_INTEGRATION") != "1" {
		t.Skip("set BACKUP_RESTORE_INTEGRATION=1 and GOKIL_DB_DSN to run (wipes backup tables)")
	}
	dsn := os.Getenv("GOKIL_DB_DSN")
	if dsn == "" {
		t.Skip("GOKIL_DB_DSN is empty")
	}

	db, err := orm.Connect("postgres", dsn, 2, 1)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer db.Close()
	ctx := orm.WithDB(context.Background(), db)

	if _, err := db.ExecContext(ctx, truncateBackupTablesSQL()); err != nil {
		t.Fatalf("truncate: %v", err)
	}

	local := []string{
		`INSERT INTO "permission" (id, code, module, description) VALUES (1, 'a.manage', 'a', '')`,
		`INSERT INTO "permission" (id, code, module, description) VALUES (99, 'local.only', 'l', 'lokal')`,
		`INSERT INTO "role" (id, name, description, is_system) VALUES (1, 'Admin', '', true)`,
		`INSERT INTO "division" (id, name, description) VALUES (1, 'Umum', 'divisi lokal')`,
		`INSERT INTO "user" (id, username, email, password_hash, full_name, hometown, division_id, role_id, status, created_at, updated_at)
		 VALUES (1, 'admin', 'admin@example.com', 'hash', '', 'Jakarta', 1, 1, 'active', '2020-01-01T00:00:00Z', '2020-01-01T00:00:00Z')`,
	}
	for _, q := range local {
		if _, err := db.ExecContext(ctx, q); err != nil {
			t.Fatalf("seed local: %v", err)
		}
	}

	payload := map[string]json.RawMessage{
		"permissions": json.RawMessage(`[
			{"id": 7, "code": "a.manage", "module": "a", "description": "via natural key"},
			{"id": 4, "description": "tanpa code"},
			{"id": 3, "code": "new.perm", "module": "n", "description": "baru"},
			{"id": 8, "code": "after.skip", "module": "n", "description": ""}
		]`),
		"roles": json.RawMessage(`[
			{"id": 1, "name": "Admin", "description": "dari zip", "is_system": true}
		]`),
		"users": json.RawMessage(`[
			{"id": 1, "username": "admin", "email": "admin@example.com", "password_hash": "zip",
			 "full_name": "Admin Baru", "hometown": "Bandung", "phone": "", "avatar_url": "",
			 "division_id": 1, "role_id": 1, "status": "active",
			 "updated_at": "2030-01-01T00:00:00Z"}
		]`),
		"activity_logs": json.RawMessage(`[
			{"id": 5, "user_id": 999, "action": "x", "resource_type": "user", "resource_id": 999, "description": "", "ip_address": ""},
			{"id": 6, "user_id": 1, "action": "login", "resource_type": "auth", "resource_id": 1, "description": "ok", "ip_address": ""}
		]`),
	}

	stats, skipped, err := BackupService{}.RestoreJSONMerge(ctx, payload)
	if err != nil {
		t.Fatalf("RestoreJSONMerge: %v", err)
	}
	if stats["permissions"] != 3 {
		t.Fatalf("stats permissions = %d, want 3 (1 update + 2 insert)", stats["permissions"])
	}
	if skipped["permissions"] != 1 {
		t.Fatalf("skipped permissions = %d, want 1 (baris tanpa code)", skipped["permissions"])
	}
	if stats["users"] != 1 || stats["roles"] != 1 || stats["activity_logs"] != 1 {
		t.Fatalf("stats users/roles/logs = %d/%d/%d, want 1/1/1",
			stats["users"], stats["roles"], stats["activity_logs"])
	}
	if skipped["activity_logs"] != 1 {
		t.Fatalf("skipped activity_logs = %d, want 1 (user_id=999)", skipped["activity_logs"])
	}

	var n int
	if err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM "permission"`).Scan(&n); err != nil {
		t.Fatal(err)
	}
	if n != 4 {
		t.Fatalf("permission count = %d, want 4 (2 lokal + 2 insert, id 7 tidak ikut)", n)
	}
	var module, desc string
	if err := db.QueryRowContext(ctx,
		`SELECT module, description FROM "permission" WHERE id = 1`).Scan(&module, &desc); err != nil {
		t.Fatalf("query natural-key match: %v", err)
	}
	if desc != "via natural key" {
		t.Fatalf("permission id=1 description = %q, want terisi dari ZIP via code", desc)
	}
	if module != "a" {
		t.Fatalf("permission id=1 module = %q, want tetap 'a' (tidak ditimpa nilai non-kosong)", module)
	}
	var kept int
	if err := db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM "permission" WHERE code = 'local.only'`).Scan(&kept); err != nil {
		t.Fatal(err)
	}
	if kept != 1 {
		t.Fatalf("permission lokal 'local.only' count = %d, want 1 (baris lokal dipertahankan)", kept)
	}

	if err := db.QueryRowContext(ctx,
		`SELECT description FROM "role" WHERE id = 1`).Scan(&desc); err != nil {
		t.Fatal(err)
	}
	if desc != "dari zip" {
		t.Fatalf("role description = %q, want 'dari zip' (kolom lokal kosong diisi)", desc)
	}

	var fullName, hometown string
	if err := db.QueryRowContext(ctx,
		`SELECT full_name, hometown FROM "user" WHERE id = 1`).Scan(&fullName, &hometown); err != nil {
		t.Fatal(err)
	}
	if fullName != "Admin Baru" || hometown != "Bandung" {
		t.Fatalf("user = %q/%q, want 'Admin Baru'/'Bandung' (updated_at ZIP lebih baru → timpa semua)", fullName, hometown)
	}

	var newID int64
	if err := db.QueryRowContext(ctx,
		`INSERT INTO "permission" (code, module, description) VALUES ('seq.test', 's', '') RETURNING id`).Scan(&newID); err != nil {
		t.Fatalf("insert setelah merge: %v", err)
	}
	if newID != 100 {
		t.Fatalf("sequence id = %d, want 100 (MAX(id)+1 setelah id 99)", newID)
	}

	// ZIP parsial tanpa tabel "users": log untuk user lokal yang ada harus tetap
	// masuk (regresi: pengecekan user_id memakai DB, bukan daftar user di ZIP).
	stats2, skipped2, err := BackupService{}.RestoreJSONMerge(ctx, map[string]json.RawMessage{
		"activity_logs": json.RawMessage(`[
			{"id": 902, "user_id": 1, "action": "smoke", "resource_type": "backup", "resource_id": 0, "description": "", "ip_address": ""},
			{"id": 903, "user_id": 999, "action": "smoke", "resource_type": "backup", "resource_id": 0, "description": "", "ip_address": ""}
		]`),
	})
	if err != nil {
		t.Fatalf("RestoreJSONMerge (ZIP parsial): %v", err)
	}
	if stats2["activity_logs"] != 1 || skipped2["activity_logs"] != 1 {
		t.Fatalf("partial zip logs written/skipped = %d/%d, want 1/1",
			stats2["activity_logs"], skipped2["activity_logs"])
	}
}
