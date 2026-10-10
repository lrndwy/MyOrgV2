package response

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"backend/internal/storageutil"
)

// Body JSON keluar dengan kolom file sebagai URL publik provider aktif,
// dirakit dari key yang tersimpan di DB.
func TestExpandJSON(t *testing.T) {
	t.Setenv("GOKIL_STORAGE_BASE_URL", "http://192.168.18.102:9000/himatris")

	cases := []struct {
		name string
		in   string
		want string
	}{
		{
			name: "key jadi URL publik",
			in:   `{"id":1,"avatar_url":"avatars/2026/10/x.png","full_name":"A"}`,
			want: `{"avatar_url":"http://192.168.18.102:9000/himatris/avatars/2026/10/x.png","full_name":"A","id":1}`,
		},
		{
			name: "kolom url tanpa suffix ikut dirakit",
			in:   `{"url":"storage/2026/10/y.pdf"}`,
			want: `{"url":"http://192.168.18.102:9000/himatris/storage/2026/10/y.pdf"}`,
		},
		{
			name: "nested & array",
			in:   `{"data":[{"banner_url":"events/banners/a.jpg"}]}`,
			want: `{"data":[{"banner_url":"http://192.168.18.102:9000/himatris/events/banners/a.jpg"}]}`,
		},
		{
			name: "URL absolut lama dibiarkan",
			in:   `{"avatar_url":"https://s3.teknostudio.id/myorg/avatars/x.png"}`,
			want: `{"avatar_url":"https://s3.teknostudio.id/myorg/avatars/x.png"}`,
		},
		{
			name: "data URL dibiarkan",
			in:   `{"avatar_url":"data:image/png;base64,AAAA"}`,
			want: `{"avatar_url":"data:image/png;base64,AAAA"}`,
		},
		{
			name: "kolom kosong dibiarkan",
			in:   `{"avatar_url":""}`,
			want: `{"avatar_url":""}`,
		},
		{
			name: "kolom non-file tidak disentuh",
			in:   `{"document_url_note":"avatars/x.png","email":"a@b.c"}`,
			want: `{"document_url_note":"avatars/x.png","email":"a@b.c"}`,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := string(expandJSON([]byte(tc.in)))
			if strings.TrimSpace(got) != tc.want {
				t.Fatalf("expandJSON = %s, mau %s", got, tc.want)
			}
		})
	}
}

// Angka besar harus tetap utuh (tanpa UseNumber, decode ke float64 merusak
// id int64 > 2^53 dan jumlah uang).
func TestExpandJSONKeepsNumberPrecision(t *testing.T) {
	in := `{"id":9007199254740993,"amount":12345678901234.56,"avatar_url":"avatars/x.png"}`
	var out map[string]any
	if err := json.Unmarshal(expandJSON([]byte(in)), &out); err != nil {
		t.Fatal(err)
	}
	if got := string(expandJSON([]byte(in))); !strings.Contains(got, "9007199254740993") ||
		!strings.Contains(got, "12345678901234.56") {
		t.Fatalf("presisi angka hilang: %s", got)
	}
}

func TestExpandJSONPassthrough(t *testing.T) {
	for _, in := range []string{"not json", "", `{"avatar_url":"avatars/x.png"} `[0:0]} {
		if got := string(expandJSON([]byte(in))); got != in {
			t.Fatalf("expandJSON(%q) = %q, mau apa adanya", in, got)
		}
	}
}

func TestNormalizeJSON(t *testing.T) {
	t.Setenv("GOKIL_STORAGE_BASE_URL", "http://192.168.18.102:9000/himatris")

	cases := []struct {
		name        string
		in          string
		want        string
		wantChanged bool
	}{
		{
			name:        "URL absolut jadi key",
			in:          `{"avatar_url":"http://192.168.18.102:9000/himatris/avatars/x.png"}`,
			want:        `{"avatar_url":"avatars/x.png"}`,
			wantChanged: true,
		},
		{
			name:        "URL era local jadi key",
			in:          `{"banner_url":"/storage/events/banners/a.jpg"}`,
			want:        `{"banner_url":"events/banners/a.jpg"}`,
			wantChanged: true,
		},
		{
			name:        "bucket era lama jadi key",
			in:          `{"file_url":"https://s3.teknostudio.id/myorg/storage/y.pdf"}`,
			want:        `{"file_url":"storage/y.pdf"}`,
			wantChanged: true,
		},
		{
			name:        "sudah key: body tidak diubah",
			in:          `{"avatar_url":"avatars/x.png","full_name":"A"}`,
			want:        `{"avatar_url":"avatars/x.png","full_name":"A"}`,
			wantChanged: false,
		},
		{
			name:        "tanpa kolom file: body tidak diubah",
			in:          `{"full_name":"A"}`,
			want:        `{"full_name":"A"}`,
			wantChanged: false,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			out, changed := normalizeJSON([]byte(tc.in))
			if changed != tc.wantChanged {
				t.Fatalf("changed = %v, mau %v", changed, tc.wantChanged)
			}
			if changed && string(out) != tc.want {
				t.Fatalf("normalizeJSON = %s, mau %s", out, tc.want)
			}
			if !changed && string(out) != tc.in {
				t.Fatalf("body diubah tanpa perlu: %s", out)
			}
		})
	}
}

// Middleware hanya menyentuh JSON; body non-JSON (multipart, ZIP) dan response
// non-JSON harus dilewatkan tanpa buffer.
func TestMiddlewareGating(t *testing.T) {
	t.Setenv("GOKIL_STORAGE_BASE_URL", "http://host/bucket")

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if ct := r.Header.Get("Content-Type"); ct != "" {
			w.Header().Set("Content-Type", ct)
		}
		b, _ := json.Marshal(map[string]string{"avatar_url": "avatars/x.png"})
		_, _ = w.Write(b)
	})

	t.Run("response JSON dirakit", func(t *testing.T) {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/users/1", nil)
		req.Header.Set("Content-Type", "application/json")
		ExpandStorageURLs(handler).ServeHTTP(rec, req)
		if !strings.Contains(rec.Body.String(), "http://host/bucket/avatars/x.png") {
			t.Fatalf("body = %s", rec.Body.String())
		}
	})

	t.Run("response non-JSON dilewatkan", func(t *testing.T) {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/backup", nil)
		req.Header.Set("Content-Type", "application/zip")
		ExpandStorageURLs(handler).ServeHTTP(rec, req)
		if strings.Contains(rec.Body.String(), "http://host/bucket") {
			t.Fatalf("ZIP ikut diubah: %s", rec.Body.String())
		}
	})

	t.Run("request JSON dinormalkan", func(t *testing.T) {
		var got string
		inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var body map[string]any
			_ = json.NewDecoder(r.Body).Decode(&body)
			got, _ = body["avatar_url"].(string)
		})
		req := httptest.NewRequest(http.MethodPut, "/events/1",
			strings.NewReader(`{"avatar_url":"http://host/bucket/avatars/x.png"}`))
		req.Header.Set("Content-Type", "application/json")
		NormalizeStorageInputs(inner).ServeHTTP(httptest.NewRecorder(), req)
		if got != "avatars/x.png" {
			t.Fatalf("avatar_url diteruskan = %q", got)
		}
	})

	t.Run("request multipart tidak disentuh", func(t *testing.T) {
		var got string
		inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			b, _ := io.ReadAll(r.Body)
			got = string(b)
		})
		raw := `{"avatar_url":"http://host/bucket/avatars/x.png"}`
		req := httptest.NewRequest(http.MethodPost, "/events", strings.NewReader(raw))
		req.Header.Set("Content-Type", "multipart/form-data; boundary=x")
		NormalizeStorageInputs(inner).ServeHTTP(httptest.NewRecorder(), req)
		if got != raw {
			t.Fatalf("body multipart berubah: %q", got)
		}
	})
}

// IsKey/KeyFromStored adalah dasar pemisahan key vs URL; kalau salah, semua
// nilai baru malah dirakit dua kali.
func TestKeyClassification(t *testing.T) {
	if !storageutil.IsKey("avatars/2026/10/x.png") {
		t.Fatal("key harus dikenali")
	}
	for _, notKey := range []string{
		"http://host/bucket/avatars/x.png",
		"/storage/avatars/x.png",
		"data:image/png;base64,AAAA",
		"",
	} {
		if storageutil.IsKey(notKey) {
			t.Fatalf("%q bukan key", notKey)
		}
	}
	if got := storageutil.KeyFromStored("/storage/avatars/x.png"); got != "avatars/x.png" {
		t.Fatalf("KeyFromStored = %q", got)
	}
	if got := storageutil.KeyFromStored("https://s3.example.com/bucket/avatars/x.png"); got != "avatars/x.png" {
		t.Fatalf("KeyFromStored = %q", got)
	}
	if got := storageutil.KeyFromStored("data:image/png;base64,AAAA"); got != "data:image/png;base64,AAAA" {
		t.Fatalf("data URL harus dibiarkan: %q", got)
	}
}
