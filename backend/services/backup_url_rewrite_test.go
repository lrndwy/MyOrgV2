package services

import (
	"encoding/json"
	"fmt"
	"testing"
)

// Regresi: restore dulu menyimpan kolom URL apa adanya, sehingga backup dari
// era/deployment storage lain meninggalkan URL mati di database — file-nya
// sudah di-upload ke provider aktif, tapi DB masih menunjuk base lama atau
// "/storage/<key>" era provider local.
func TestRewriteStorageURLs(t *testing.T) {
	t.Parallel()

	const newBase = "http://192.168.18.102:9000/himatris"
	urlFor := func(key string) (string, error) { return newBase + "/" + key, nil }

	known := map[string]struct {
	}{
		"avatars/2026/10/x.png":  {},
		"storage/2026/10/y.jpeg": {},
	}

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
		url  string
		want string
	}{
		{
			// base lama + nama bucket lama (myorg), sekarang himatris
			name: "base dan bucket era lama",
			url:  "https://s3.teknostudio.id/myorg/avatars/2026/10/x.png",
			want: newBase + "/avatars/2026/10/x.png",
		},
		{
			// URL relatif provider local — selalu ditulis ulang
			name: "relatif era local",
			url:  "/storage/avatars/2026/10/x.png",
			want: newBase + "/avatars/2026/10/x.png",
		},
		{
			// key-nya sendiri berawalan "storage/" (prefix upload admin)
			name: "key berawalan storage",
			url:  "http://192.168.18.102:9000/himatris/storage/2026/10/y.jpeg",
			want: newBase + "/storage/2026/10/y.jpeg",
		},
		{
			name: "sudah base aktif (idempoten)",
			url:  newBase + "/avatars/2026/10/x.png",
			want: newBase + "/avatars/2026/10/x.png",
		},
		{
			// key tidak ada di ZIP -> bukan file milik storage kita
			name: "URL eksternal tidak disentuh",
			url:  "https://cdn.example.com/gambar/lain.png",
			want: "https://cdn.example.com/gambar/lain.png",
		},
		{
			// Disengaja: path-nya persis key yang ada di ZIP, jadi dianggap
			// file storage kita (lihat catatan tradeoff di RewriteStorageURLs).
			name: "mirror dengan path key kita ikut dialihkan",
			url:  "https://cdn.example.com/avatars/2026/10/x.png",
			want: newBase + "/avatars/2026/10/x.png",
		},
		{
			name: "data URL tidak disentuh",
			url:  "data:image/png;base64,AAAA",
			want: "data:image/png;base64,AAAA",
		},
		{
			name: "path traversal ditolak",
			url:  "/storage/../../etc/passwd",
			want: "/storage/../../etc/passwd",
		},
		{
			name: "URL asing tidak disentuh",
			url:  "https://contoh.id/halaman",
			want: "https://contoh.id/halaman",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			row := `[{"id":1,"username":"admin","email":"a@b.c","avatar_url":"` + tc.url + `"}]`
			p := map[string]json.RawMessage{"users": json.RawMessage(row)}

			n, err := rewriteStorageURLs(p, known, urlFor)
			if err != nil {
				t.Fatalf("rewrite: %v", err)
			}
			if got := avatarOf(t, p); got != tc.want {
				t.Fatalf("avatar_url = %q, mau %q", got, tc.want)
			}
			wantN := 0
			if tc.want != tc.url {
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

func TestRewriteStorageURLsRewritesEveryURLColumn(t *testing.T) {
	t.Parallel()

	urlFor := func(key string) (string, error) { return "https://s3.example.com/himatris/" + key, nil }
	p := map[string]json.RawMessage{
		"letters": json.RawMessage(`[{"id":1,"title":"Surat","file_url":"/storage/letters/1.docx"}]`),
		"events":  json.RawMessage(`null`),
	}

	n, err := rewriteStorageURLs(p, nil, urlFor)
	if err != nil {
		t.Fatalf("rewrite: %v", err)
	}
	if n != 1 {
		t.Fatalf("changed = %d, mau 1", n)
	}

	var items []map[string]any
	if err := json.Unmarshal(p["letters"], &items); err != nil {
		t.Fatal(err)
	}
	if items[0]["file_url"] != "https://s3.example.com/himatris/letters/1.docx" {
		t.Fatalf("file_url = %v", items[0]["file_url"])
	}
	if items[0]["title"] != "Surat" {
		t.Fatalf("kolom non-URL berubah: %v", items[0]["title"])
	}
}

// Provider belum siap (URL gagal dibangun) tidak boleh menggagalkan restore.
func TestRewriteStorageURLsWithoutProvider(t *testing.T) {
	t.Parallel()

	p := map[string]json.RawMessage{"users": json.RawMessage(`[{"avatar_url":"/storage/a.png"}]`)}
	n, err := rewriteStorageURLs(p, nil, func(string) (string, error) {
		return "", fmt.Errorf("storage not initialized")
	})
	if err != nil {
		t.Fatalf("rewrite: %v", err)
	}
	if n != 0 {
		t.Fatalf("changed = %d, mau 0", n)
	}

	var items []map[string]any
	if err := json.Unmarshal(p["users"], &items); err != nil {
		t.Fatal(err)
	}
	if items[0]["avatar_url"] != "/storage/a.png" {
		t.Fatalf("avatar_url berubah: %v", items[0]["avatar_url"])
	}
}

func TestMatchKnownStorageKey(t *testing.T) {
	t.Parallel()

	known := map[string]struct {
	}{
		"avatars/2026/10/x.png": {},
	}
	cases := []struct {
		url     string
		wantKey string
		wantOK  bool
	}{
		{"/storage/avatars/2026/10/x.png", "avatars/2026/10/x.png", true},
		{"https://s3.teknostudio.id/myorg/avatars/2026/10/x.png", "avatars/2026/10/x.png", true},
		{"https://s3.teknostudio.id/avatars/2026/10/x.png", "avatars/2026/10/x.png", true},
		{"https://cdn.example.com/gambar/lain.png", "", false},
		{"/storage/", "", false},
		{"", "", false},
		{"avatars/2026/10/x.png", "", false},
	}
	for _, tc := range cases {
		key, ok := matchKnownStorageKey(tc.url, known)
		if ok != tc.wantOK || key != tc.wantKey {
			t.Fatalf("matchKnownStorageKey(%q) = (%q,%v), mau (%q,%v)", tc.url, key, ok, tc.wantKey, tc.wantOK)
		}
	}
}

// Regresi bug kedua: bucket sempat bernama "myorg" lalu "himatris". Ekstraksi
// key lama hanya melepas segmen bucket kalau namanya sama dengan bucket aktif,
// jadi URL era lama menghasilkan key salah ("myorg/avatars/...") dan file-nya
// tidak ditemukan saat backup.
func TestStorageKeyCandidates(t *testing.T) {
	t.Setenv("GOKIL_STORAGE_BASE_URL", "http://192.168.18.102:9000/himatris")
	t.Setenv("GOKIL_STORAGE_BUCKET", "himatris")

	cases := []struct {
		name string
		url  string
		want []string
	}{
		{
			name: "base aktif",
			url:  "http://192.168.18.102:9000/himatris/avatars/2026/10/x.png",
			want: []string{"avatars/2026/10/x.png"},
		},
		{
			// inilah kasus produksi: bucket lama "myorg"
			name: "bucket era lama",
			url:  "https://s3.teknostudio.id/myorg/avatars/2026/10/x.png",
			want: []string{"avatars/2026/10/x.png", "myorg/avatars/2026/10/x.png"},
		},
		{
			name: "relatif era local",
			url:  "/storage/avatars/2026/10/x.png",
			want: []string{"avatars/2026/10/x.png"},
		},
		{
			name: "virtual host AWS tanpa segmen bucket",
			url:  "https://myorg.s3.amazonaws.com/avatars/2026/10/x.png",
			want: []string{"avatars/2026/10/x.png"},
		},
		{
			name: "key berawalan storage",
			url:  "http://192.168.18.102:9000/himatris/storage/2026/10/y.jpeg",
			want: []string{"storage/2026/10/y.jpeg"},
		},
		{
			name: "traversal ditolak",
			url:  "/storage/../../etc/passwd",
			want: nil,
		},
		{
			name: "bukan URL storage",
			url:  "https://contoh.id/halaman",
			want: []string{"halaman"},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := StorageKeyCandidates(tc.url)
			if len(got) != len(tc.want) {
				t.Fatalf("candidates(%q) = %v, mau %v", tc.url, got, tc.want)
			}
			for i := range got {
				if got[i] != tc.want[i] {
					t.Fatalf("candidates(%q) = %v, mau %v", tc.url, got, tc.want)
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
}
