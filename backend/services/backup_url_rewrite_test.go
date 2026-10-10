package services

import (
	"encoding/json"
	"testing"

	"backend/internal/storageutil"
)

// Kolom file di DB hanya berisi KEY storage; URL dirakit saat response
// (storageutil.PublicURL). NormalizeStoragePaths dipakai di dua sisi backup:
// export (data.json keluar sebagai path saja) dan restore (ZIP lama berisi URL
// absolut tetap masuk sebagai key).
func TestNormalizeStoragePaths(t *testing.T) {
	t.Parallel()

	known := map[string]struct {
	}{
		"avatars/2026/10/x.png":  {},
		"storage/2026/10/y.jpeg": {},
	}
	resolve := KnownKeyResolver(known)

	avatarOf := func(t *testing.T, p map[string]json.RawMessage) string {
		t.Helper()
		var items []map[string]any
		if err := json.Unmarshal(p["users"], &items); err != nil {
			t.Fatalf("unmarshal hasil: %v", err)
		}
		s, _ := items[0]["avatar_url"].(string)
		return s
	}

	cases := []struct {
		name string
		val  string
		want string
	}{
		{
			// base lama + nama bucket lama (myorg), sekarang himatris
			name: "base dan bucket era lama",
			val:  "https://s3.teknostudio.id/myorg/avatars/2026/10/x.png",
			want: "avatars/2026/10/x.png",
		},
		{
			// URL relatif provider local — selalu dinormalkan
			name: "relatif era local",
			val:  "/storage/avatars/2026/10/x.png",
			want: "avatars/2026/10/x.png",
		},
		{
			// key-nya sendiri berawalan "storage/" (prefix upload admin)
			name: "key berawalan storage",
			val:  "http://192.168.18.102:9000/himatris/storage/2026/10/y.jpeg",
			want: "storage/2026/10/y.jpeg",
		},
		{
			name: "sudah key (idempoten)",
			val:  "avatars/2026/10/x.png",
			want: "avatars/2026/10/x.png",
		},
		{
			// key tidak ada di ZIP -> bukan file milik storage kita
			name: "URL eksternal tidak disentuh",
			val:  "https://cdn.example.com/gambar/lain.png",
			want: "https://cdn.example.com/gambar/lain.png",
		},
		{
			// Disengaja: path-nya persis key yang ada di ZIP, jadi dianggap
			// file storage kita (lihat catatan tradeoff di NormalizeStoragePaths).
			name: "mirror dengan path key kita ikut dinormalkan",
			val:  "https://cdn.example.com/avatars/2026/10/x.png",
			want: "avatars/2026/10/x.png",
		},
		{
			name: "data URL tidak disentuh",
			val:  "data:image/png;base64,AAAA",
			want: "data:image/png;base64,AAAA",
		},
		{
			name: "path traversal ditolak",
			val:  "/storage/../../etc/passwd",
			want: "/storage/../../etc/passwd",
		},
		{
			name: "URL asing tidak disentuh",
			val:  "https://contoh.id/halaman",
			want: "https://contoh.id/halaman",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			row := `[{"id":1,"username":"admin","email":"a@b.c","avatar_url":"` + tc.val + `"}]`
			p := map[string]json.RawMessage{"users": json.RawMessage(row)}

			n, err := NormalizeStoragePaths(p, resolve)
			if err != nil {
				t.Fatalf("normalize: %v", err)
			}
			if got := avatarOf(t, p); got != tc.want {
				t.Fatalf("avatar_url = %q, mau %q", got, tc.want)
			}
			wantN := 0
			if tc.want != tc.val {
				wantN = 1
			}
			if n != wantN {
				t.Fatalf("changed = %d, mau %d", n, wantN)
			}

			// Kolom non-URL tidak boleh ikut berubah.
			var items []map[string]any
			if err := json.Unmarshal(p["users"], &items); err != nil {
				t.Fatal(err)
			}
			if items[0]["email"] != "a@b.c" || items[0]["username"] != "admin" {
				t.Fatalf("kolom non-URL berubah: %v", items[0])
			}
		})
	}
}

// Semua kolom berakhiran _url (bukan hanya "url") harus ikut dinormalkan, dan
// tabel null tidak menggagalkan apa pun.
func TestNormalizeStoragePathsCoversEveryURLColumn(t *testing.T) {
	t.Parallel()

	p := map[string]json.RawMessage{
		"letters": json.RawMessage(`[{"id":1,"title":"Surat","file_url":"/storage/letters/1.docx"}]`),
		"events":  json.RawMessage(`null`),
	}

	n, err := NormalizeStoragePaths(p, KnownKeyResolver(nil))
	if err != nil {
		t.Fatalf("normalize: %v", err)
	}
	if n != 1 {
		t.Fatalf("changed = %d, mau 1", n)
	}

	var items []map[string]any
	if err := json.Unmarshal(p["letters"], &items); err != nil {
		t.Fatal(err)
	}
	if items[0]["file_url"] != "letters/1.docx" {
		t.Fatalf("file_url = %v", items[0]["file_url"])
	}
	if items[0]["title"] != "Surat" {
		t.Fatalf("kolom non-URL berubah: %v", items[0]["title"])
	}
}

// ZIP tanpa file storage (knownKeys kosong) tetap boleh menormalkan bentuk
// "/storage/<key>" — bentuk itu hanya mungkin dari provider local.
func TestNormalizeStoragePathsWithoutKnownKeys(t *testing.T) {
	t.Parallel()

	p := map[string]json.RawMessage{"users": json.RawMessage(`[{"avatar_url":"/storage/a.png"}]`)}
	n, err := NormalizeStoragePaths(p, KnownKeyResolver(nil))
	if err != nil {
		t.Fatalf("normalize: %v", err)
	}
	if n != 1 {
		t.Fatalf("changed = %d, mau 1", n)
	}

	var items []map[string]any
	if err := json.Unmarshal(p["users"], &items); err != nil {
		t.Fatal(err)
	}
	if items[0]["avatar_url"] != "a.png" {
		t.Fatalf("avatar_url = %v", items[0]["avatar_url"])
	}
}

func TestMatchKnownStorageKey(t *testing.T) {
	t.Parallel()

	known := map[string]struct {
	}{
		"avatars/2026/10/x.png": {},
	}
	cases := []struct {
		val     string
		wantKey string
		wantOK  bool
	}{
		{"/storage/avatars/2026/10/x.png", "avatars/2026/10/x.png", true},
		{"https://s3.teknostudio.id/myorg/avatars/2026/10/x.png", "avatars/2026/10/x.png", true},
		{"https://s3.teknostudio.id/avatars/2026/10/x.png", "avatars/2026/10/x.png", true},
		{"https://cdn.example.com/gambar/lain.png", "", false},
		{"/storage/", "", false},
		{"", "", false},
		// key yang tidak ada di ZIP: bukan file milik backup ini.
		{"https://cdn.example.com/avatars/2026/10/lain.png", "", false},
	}
	for _, tc := range cases {
		key, ok := matchKnownStorageKey(tc.val, known)
		if ok != tc.wantOK || key != tc.wantKey {
			t.Fatalf("matchKnownStorageKey(%q) = (%q,%v), mau (%q,%v)", tc.val, key, ok, tc.wantKey, tc.wantOK)
		}
	}
}

// Regresi bug kedua: bucket sempat bernama "myorg" lalu "himatris". Ekstraksi
// key lama hanya melepas segmen bucket kalau namanya sama dengan bucket aktif,
// jadi URL era lama menghasilkan key salah ("myorg/avatars/...") dan file-nya
// tidak ditemukan saat backup.
func TestKeyCandidates(t *testing.T) {
	t.Setenv("GOKIL_STORAGE_BASE_URL", "http://192.168.18.102:9000/himatris")
	t.Setenv("GOKIL_STORAGE_BUCKET", "himatris")

	cases := []struct {
		name string
		val  string
		want []string
	}{
		{
			name: "sudah key",
			val:  "avatars/2026/10/x.png",
			want: []string{"avatars/2026/10/x.png"},
		},
		{
			name: "base aktif",
			val:  "http://192.168.18.102:9000/himatris/avatars/2026/10/x.png",
			want: []string{"avatars/2026/10/x.png"},
		},
		{
			// inilah kasus produksi: bucket lama "myorg"
			name: "bucket era lama",
			val:  "https://s3.teknostudio.id/myorg/avatars/2026/10/x.png",
			want: []string{"avatars/2026/10/x.png", "myorg/avatars/2026/10/x.png"},
		},
		{
			name: "relatif era local",
			val:  "/storage/avatars/2026/10/x.png",
			want: []string{"avatars/2026/10/x.png"},
		},
		{
			name: "virtual host AWS tanpa segmen bucket",
			val:  "https://myorg.s3.amazonaws.com/avatars/2026/10/x.png",
			want: []string{"avatars/2026/10/x.png"},
		},
		{
			name: "key berawalan storage",
			val:  "http://192.168.18.102:9000/himatris/storage/2026/10/y.jpeg",
			want: []string{"storage/2026/10/y.jpeg"},
		},
		{
			name: "traversal ditolak",
			val:  "/storage/../../etc/passwd",
			want: nil,
		},
		{
			name: "bukan URL storage",
			val:  "https://contoh.id/halaman",
			want: []string{"halaman"},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := storageutil.KeyCandidates(tc.val)
			if len(got) != len(tc.want) {
				t.Fatalf("candidates(%q) = %v, mau %v", tc.val, got, tc.want)
			}
			for i := range got {
				if got[i] != tc.want[i] {
					t.Fatalf("candidates(%q) = %v, mau %v", tc.val, got, tc.want)
				}
			}
		})
	}
}

func TestCollectFileRefsFindsLegacyBucketURLs(t *testing.T) {
	t.Setenv("GOKIL_STORAGE_BASE_URL", "http://192.168.18.102:9000/himatris")
	t.Setenv("GOKIL_STORAGE_BUCKET", "himatris")

	payload := map[string]any{
		"users": []map[string]any{
			{"id": 1, "avatar_url": "https://s3.teknostudio.id/myorg/avatars/2026/10/x.png"},
			{"id": 2, "avatar_url": "data:image/png;base64,AAAA"},
			{"id": 3, "avatar_url": ""},
		},
		"events": []map[string]any{
			{"id": 1, "banner_url": "https://s3.teknostudio.id/myorg/avatars/2026/10/x.png"},
		},
	}

	refs := CollectFileRefs(payload)
	if len(refs) != 1 {
		t.Fatalf("refs = %d (%v), mau 1 (duplikat & non-file disaring)", len(refs), refs)
	}
	if refs[0].Keys[0] != "avatars/2026/10/x.png" {
		t.Fatalf("kandidat utama = %q, mau tanpa segmen bucket", refs[0].Keys[0])
	}
	if refs[0].Value != "https://s3.teknostudio.id/myorg/avatars/2026/10/x.png" {
		t.Fatalf("nilai asli = %q", refs[0].Value)
	}
}
