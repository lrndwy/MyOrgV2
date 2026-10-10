package services

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"backend/internal/storageutil"
	"backend/internal/timeutil"

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

func truncateBackupTablesSQL() string {
	names := make([]string, len(backupTables))
	for i, t := range backupTables {
		names[i] = quoteIdent(t.Table)
	}
	return "TRUNCATE " + joinComma(names) + " CASCADE"
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

// FileRef merujuk satu file storage yang dirujuk kolom file di database.
// Keys = kandidat key, paling mungkin lebih dulu (nilai lama bisa berupa URL
// dari era base URL/bucket yang berbeda).
type FileRef struct {
	Value string
	Keys  []string
}

// CollectFileRefs memindai payload export dan mengembalikan setiap kolom file
// (avatar, banner, selfie, lampiran, dsb.), apa pun provider storage-nya
// (lokal maupun S3/MinIO). Terurut supaya hasil backup deterministik.
func CollectFileRefs(payload map[string]any) []FileRef {
	seen := map[string]bool{}
	refs := []FileRef{}
	for _, tableData := range payload {
		rows, ok := tableData.([]map[string]any)
		if !ok {
			continue
		}
		for _, row := range rows {
			for col, val := range row {
				if !storageutil.IsURLField(col) {
					continue
				}
				s, ok := val.(string)
				if !ok || s == "" || seen[s] {
					continue
				}
				keys := storageutil.KeyCandidates(s)
				if len(keys) == 0 {
					continue
				}
				seen[s] = true
				refs = append(refs, FileRef{Value: s, Keys: keys})
			}
		}
	}
	sort.Slice(refs, func(i, j int) bool { return refs[i].Value < refs[j].Value })
	return refs
}

// NormalizeStoragePaths menulis ulang kolom file di payload backup menjadi
// key storage saja, sehingga ZIP tidak lagi membawa base URL deployment mana
// pun: domain/IP/port/bucket dirakit ulang saat response (storageutil.PublicURL).
//
// resolve = fungsi yang memutuskan nilai lama mana yang memang milik sistem
// ini (lihat KnownKeyResolver). Nilai yang tidak dikenali dibiarkan utuh, jadi
// tautan luar tidak ikut diubah. Nilai yang sudah berupa key tidak disentuh.
//
// Dijalankan di dua sisi:
//   - export: payload yang ditulis ke data.json (backup dari era lama pun
//     keluar sebagai path saja)
//   - restore: payload dari ZIP, sebelum ditulis ke DB — jadi ZIP lama
//     (berisi URL absolut) tetap masuk sebagai key.
func NormalizeStoragePaths(payload map[string]json.RawMessage, resolve func(string) (string, bool)) (int, error) {
	if len(payload) == 0 {
		return 0, nil
	}
	changed := 0
	for key, raw := range payload {
		if len(raw) == 0 || string(raw) == "null" {
			continue
		}
		var items []map[string]any
		if err := json.Unmarshal(raw, &items); err != nil {
			return changed, fmt.Errorf("%s: %w", key, err)
		}
		rowChanged := false
		for _, row := range items {
			for col, val := range row {
				if !storageutil.IsURLField(col) {
					continue
				}
				s, ok := val.(string)
				if !ok || s == "" || storageutil.IsKey(s) {
					continue
				}
				storageKey, ok := resolve(s)
				if !ok || storageKey == s {
					continue
				}
				row[col] = storageKey
				changed++
				rowChanged = true
			}
		}
		if rowChanged {
			raw, err := json.Marshal(items)
			if err != nil {
				return changed, fmt.Errorf("%s: %w", key, err)
			}
			payload[key] = raw
		}
	}
	return changed, nil
}

// KnownKeyResolver memutuskan nilai lama (URL absolut atau "/storage/<key>")
// yang key-nya benar-benar ada di dalam ZIP. Dipakai sebagai resolve untuk
// NormalizeStoragePaths di sisi restore.
func KnownKeyResolver(knownKeys map[string]struct{}) func(string) (string, bool) {
	return func(value string) (string, bool) {
		return matchKnownStorageKey(value, knownKeys)
	}
}

// matchKnownStorageKey mengembalikan key storage dari nilai lama (URL absolut
// atau "/storage/<key>") bila key itu memang ada di knownKeys.
//
// Path absolut dicoba apa adanya lalu tanpa segmen pertama, karena nama bucket
// ikut masuk ke path pada endpoint path-style dan nama itu bisa berbeda antar
// era (mis. "myorg" -> "himatris").
func matchKnownStorageKey(value string, knownKeys map[string]struct{}) (string, bool) {
	for _, candidate := range storageutil.KeyCandidates(value) {
		if _, ok := knownKeys[candidate]; ok {
			return candidate, true
		}
	}
	if strings.HasPrefix(value, "/storage/") {
		// Bentuk ini hanya mungkin dari provider local; key-nya tidak pernah
		// ambigu walau tidak ada di ZIP.
		if keys := storageutil.KeyCandidates(value); len(keys) > 0 {
			return keys[0], true
		}
	}
	return "", false
}

// RestoreJSON mengganti seluruh isi tabel backup dengan data ZIP (TRUNCATE
// lalu INSERT) dalam satu transaksi, lalu menyinkronkan sequence tiap tabel
// agar insert berikutnya tidak bentrok dengan ID hasil restore.
func (BackupService) RestoreJSON(ctx context.Context, payload map[string]json.RawMessage) (map[string]int, error) {
	stats := map[string]int{}
	err := orm.WithTx(ctx, func(txCtx context.Context, tx *orm.Tx) error {
		if _, err := tx.ExecContext(txCtx, truncateBackupTablesSQL()); err != nil {
			return fmt.Errorf("truncate: %w", err)
		}
		userIDs := map[int64]struct{}{}
		for _, t := range backupTables {
			raw, ok := payload[t.Key]
			if !ok || len(raw) == 0 || string(raw) == "null" {
				continue
			}
			var items []map[string]any
			if err := json.Unmarshal(raw, &items); err != nil {
				return fmt.Errorf("%s: %w", t.Key, err)
			}
			if t.Table == "user" {
				userIDs = collectRowIDs(items)
			}
			inserted := 0
			for _, row := range items {
				if t.Table == "activity_log" && shouldSkipActivityLog(row, userIDs) {
					continue
				}
				if err := insertRow(txCtx, tx, t.Table, row); err != nil {
					return fmt.Errorf("%s: %w", t.Key, err)
				}
				inserted++
			}
			if inserted > 0 {
				if err := syncSequence(txCtx, tx, t.Table); err != nil {
					return fmt.Errorf("%s: %w", t.Key, err)
				}
			}
			stats[t.Key] = inserted
		}
		return nil
	})
	if err != nil {
		return stats, err
	}
	return stats, nil
}

// RestoreMode menentukan perilaku restore.
type RestoreMode string

const (
	// RestoreReplace mengosongkan tabel backup lalu mengisi ulang dari ZIP.
	RestoreReplace RestoreMode = "replace"
	// RestoreMerge menimpa baris yang cocok, mempertahankan baris lokal lain,
	// dan melewati baris yang gagal alih-alih membatalkan seluruh restore.
	RestoreMerge RestoreMode = "merge"
)

// ParseRestoreMode memetakan input pengguna; apa pun selain "merge" → replace.
func ParseRestoreMode(s string) RestoreMode {
	if RestoreMode(strings.TrimSpace(s)) == RestoreMerge {
		return RestoreMerge
	}
	return RestoreReplace
}

// naturalKeys adalah kolom unik per tabel untuk fallback pencocokan saat id
// ZIP tidak ada di DB lokal (restore dari instance lain). Urutan = prioritas;
// tiap entri boleh berupa UNIQUE komposit.
var naturalKeys = map[string][][]string{
	"role":              {{"name"}},
	"permission":        {{"code"}},
	"role_permission":   {{"role_id", "permission_id"}},
	"user":              {{"username"}, {"email"}},
	"attendance":        {{"event_id", "user_id"}},
	"recruitment":       {{"slug"}},
	"push_subscription": {{"endpoint"}},
}

// RestoreJSONMerge menggabungkan isi ZIP ke database tanpa mengosongkan tabel:
// baris yang cocok (id lebih dulu, lalu natural key unik) di-update, baris baru
// di-insert, baris lokal yang tidak ada di ZIP dibiarkan. Tiap baris dibungkus
// SAVEPOINT sehingga baris yang gagal (FK/unique) dilewati, bukan membatalkan
// seluruh transaksi. Mengembalikan jumlah baris tertulis dan dilewati per key.
//
// ponytail: pencocokan id didahulukan sesuai keputusan produk; ZIP dari
// instance lain yang kebetulan punya id sama bisa menimpa baris berbeda.
func (BackupService) RestoreJSONMerge(ctx context.Context, payload map[string]json.RawMessage) (map[string]int, map[string]int, error) {
	stats := map[string]int{}
	skipped := map[string]int{}
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
			written := 0
			for _, row := range items {
				if t.Table == "activity_log" {
					skip, err := skipActivityLogMerge(txCtx, tx, row)
					if err != nil {
						return fmt.Errorf("%s: %w", t.Key, err)
					}
					if skip {
						skipped[t.Key]++
						continue
					}
				}
				if _, err := tx.ExecContext(txCtx, "SAVEPOINT restore_row"); err != nil {
					return err
				}
				err := mergeRow(txCtx, tx, t.Table, row)
				if err != nil {
					if _, rbErr := tx.ExecContext(txCtx, "ROLLBACK TO SAVEPOINT restore_row"); rbErr != nil {
						return rbErr
					}
					skipped[t.Key]++
					continue
				}
				if _, err := tx.ExecContext(txCtx, "RELEASE SAVEPOINT restore_row"); err != nil {
					return err
				}
				written++
			}
			if written > 0 {
				if err := syncSequence(txCtx, tx, t.Table); err != nil {
					return fmt.Errorf("%s: %w", t.Key, err)
				}
			}
			stats[t.Key] = written
		}
		return nil
	})
	if err != nil {
		return stats, skipped, err
	}
	return stats, skipped, nil
}

// mergeRow menulis satu baris ZIP: update baris lokal yang cocok, atau insert
// baris baru bila belum ada.
func mergeRow(ctx context.Context, tx *orm.Tx, table string, row map[string]any) error {
	local, err := matchLocalRow(ctx, tx, table, row)
	if err != nil {
		return err
	}
	if local != nil {
		return mergeIntoLocal(ctx, tx, table, local, row)
	}
	return insertRow(ctx, tx, table, row)
}

// matchLocalRow mencari baris lokal yang cocok: id sama, atau natural key unik
// yang sama (untuk ZIP dari instance lain).
func matchLocalRow(ctx context.Context, tx *orm.Tx, table string, row map[string]any) (map[string]any, error) {
	if id, ok := rowInt64(row, "id"); ok {
		local, err := selectLocalRow(ctx, tx, table, []string{"id"}, []any{id})
		if err != nil || local != nil {
			return local, err
		}
	}
	for _, key := range naturalKeys[table] {
		args := make([]any, 0, len(key))
		valid := true
		for _, col := range key {
			v, exists := row[col]
			if !exists || isEmptyValue(v) {
				valid = false
				break
			}
			args = append(args, normalizeSQLValue(v))
		}
		if !valid {
			continue
		}
		local, err := selectLocalRow(ctx, tx, table, key, args)
		if err != nil || local != nil {
			return local, err
		}
	}
	return nil, nil
}

// selectLocalRow mengambil satu baris lokal berdasarkan kolom pencocokan.
func selectLocalRow(ctx context.Context, tx *orm.Tx, table string, cols []string, args []any) (map[string]any, error) {
	where := make([]string, len(cols))
	for i, col := range cols {
		if !identRe.MatchString(col) {
			return nil, fmt.Errorf("kolom pencocokan tidak valid: %q", col)
		}
		where[i] = fmt.Sprintf("%s = $%d", quoteIdent(col), i+1)
	}
	query := fmt.Sprintf("SELECT * FROM %s WHERE %s LIMIT 1", quoteIdent(table), joinComma(where))
	rows, err := tx.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	names, err := rows.Columns()
	if err != nil {
		return nil, err
	}
	if !rows.Next() {
		return nil, rows.Err()
	}
	values := make([]any, len(names))
	ptrs := make([]any, len(names))
	for i := range values {
		ptrs[i] = &values[i]
	}
	if err := rows.Scan(ptrs...); err != nil {
		return nil, err
	}
	local := map[string]any{}
	for i, name := range names {
		switch v := values[i].(type) {
		case []byte:
			local[name] = string(v)
		default:
			local[name] = v
		}
	}
	return local, nil
}

// mergeIntoLocal menyatukan baris ZIP ke baris lokal: bila updated_at ZIP lebih
// baru, semua kolom ZIP menimpa lokal; selain itu hanya kolom yang kosong/NULL
// di lokal yang diisi dari ZIP.
func mergeIntoLocal(ctx context.Context, tx *orm.Tx, table string, local, incoming map[string]any) error {
	localID, ok := rowInt64(local, "id")
	if !ok {
		return fmt.Errorf("baris lokal tanpa id")
	}
	zipNewer := timeAfter(incoming["updated_at"], local["updated_at"])
	type colVal struct {
		col string
		val any
	}
	pairs := make([]colVal, 0, len(incoming))
	for col, val := range incoming {
		if col == "id" || !identRe.MatchString(col) {
			continue
		}
		if _, exists := local[col]; !exists {
			continue
		}
		if !zipNewer && (isEmptyValue(val) || !isEmptyValue(local[col])) {
			continue
		}
		pairs = append(pairs, colVal{col, normalizeSQLValue(val)})
	}
	if len(pairs) == 0 {
		return nil
	}
	sort.Slice(pairs, func(i, j int) bool { return pairs[i].col < pairs[j].col })
	set := make([]string, len(pairs))
	args := make([]any, len(pairs)+1)
	for i, p := range pairs {
		set[i] = fmt.Sprintf("%s = $%d", quoteIdent(p.col), i+1)
		args[i] = p.val
	}
	args[len(pairs)] = localID
	query := fmt.Sprintf("UPDATE %s SET %s WHERE id = $%d",
		quoteIdent(table), joinComma(set), len(pairs)+1)
	_, err := tx.ExecContext(ctx, query, args...)
	return err
}

// timeAfter melaporkan apakah a lebih baru dari b; salah satu tidak terbaca
// (nil/format asing) → false, sehingga jalur "isi kolom kosong" yang dipakai.
func timeAfter(a, b any) bool {
	ta, ok := toTime(a)
	if !ok {
		return false
	}
	tb, ok := toTime(b)
	if !ok {
		return false
	}
	return ta.After(tb)
}

// toTime menerima time.Time (hasil scan DB) atau string RFC3339 (hasil JSON).
func toTime(v any) (time.Time, bool) {
	switch t := v.(type) {
	case time.Time:
		return t, true
	case string:
		parsed, err := timeutil.ParseFlexible(t)
		return parsed, err == nil
	case []byte:
		parsed, err := timeutil.ParseFlexible(string(t))
		return parsed, err == nil
	default:
		return time.Time{}, false
	}
}

// isEmptyValue menandai nilai NULL/string kosong. Angka nol dan bool false
// dianggap data (bukan kosong) agar tidak tertimpa tanpa alasan.
func isEmptyValue(v any) bool {
	switch x := v.(type) {
	case nil:
		return true
	case string:
		return x == ""
	case []byte:
		return len(x) == 0
	default:
		return false
	}
}

// collectRowIDs mengambil id dari baris JSON hasil Unmarshal (angka JSON
// menjadi float64; backup lama bisa menyimpan id sebagai string).
func collectRowIDs(items []map[string]any) map[int64]struct{} {
	ids := make(map[int64]struct{}, len(items))
	for _, row := range items {
		if id, ok := rowInt64(row, "id"); ok && id > 0 {
			ids[id] = struct{}{}
		}
	}
	return ids
}

func rowInt64(row map[string]any, key string) (int64, bool) {
	v, ok := row[key]
	if !ok || v == nil {
		return 0, false
	}
	switch n := v.(type) {
	case int64:
		return n, true
	case int:
		return int64(n), true
	case int32:
		return int64(n), true
	case float64:
		if n != n || n < 1 {
			return 0, false
		}
		return int64(n), true
	case json.Number:
		i, err := n.Int64()
		return i, err == nil && i > 0
	case string:
		i, err := strconv.ParseInt(strings.TrimSpace(n), 10, 64)
		return i, err == nil && i > 0
	default:
		return 0, false
	}
}

// shouldSkipActivityLog menolak baris log yang merujuk user yang tidak ada
// di payload restore. Tanpa ini INSERT kena activity_log_user_id_fkey
// (SQLSTATE 23503) — biasanya sisa user yang sudah dihapus: skema lama
// user_id NOT NULL + ON DELETE SET NULL, jadi DELETE user gagal men-null-kan
// log dan/atau tabel dibuat ORM tanpa FK sehingga orphan tertinggal.
func shouldSkipActivityLog(row map[string]any, userIDs map[int64]struct{}) bool {
	v, ok := row["user_id"]
	if !ok || v == nil {
		return false
	}
	uid, parsed := rowInt64(row, "user_id")
	if !parsed || uid <= 0 {
		return true
	}
	_, exists := userIDs[uid]
	return !exists
}

// skipActivityLogMerge menolak log yang user_id-nya tidak ada di database.
// Berbeda dari shouldSkipActivityLog (mode replace yang memakai id dari ZIP),
// mode merge tidak mengosongkan tabel user sehingga user lokal yang tidak ikut
// di ZIP tetap valid sebagai rujukan.
func skipActivityLogMerge(ctx context.Context, tx *orm.Tx, row map[string]any) (bool, error) {
	v, present := row["user_id"]
	if !present || v == nil {
		return false, nil
	}
	uid, ok := rowInt64(row, "user_id")
	if !ok {
		return true, nil
	}
	var exists bool
	if err := tx.QueryRowContext(ctx,
		`SELECT EXISTS(SELECT 1 FROM "user" WHERE id = $1)`, uid).Scan(&exists); err != nil {
		return false, err
	}
	return !exists, nil
}

func insertRow(ctx context.Context, tx *orm.Tx, table string, row map[string]any) error {
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
	for i, col := range cols {
		colNames[i] = quoteIdent(col)
		placeholders[i] = fmt.Sprintf("$%d", i+1)
		args[i] = normalizeSQLValue(row[col])
	}

	query := fmt.Sprintf("INSERT INTO %s (%s) VALUES (%s)",
		quoteIdent(table), joinComma(colNames), joinComma(placeholders))
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
		table, *maxID)
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
