package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

// Regresi: URL relatif "/storage/<key>" dari era provider `local` masih ada di
// DB, jadi handler ini harus tetap melayaninya apa pun provider yang aktif.
// Sebelumnya handler digerbangi provider == "local" sehingga semua URL lama
// mati 404 setelah pindah ke s3.
func TestStorageStaticHandler(t *testing.T) {
	root := t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, "avatars", "2026", "09"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "avatars", "2026", "09", "a.jpg"), []byte("jpegbytes"), 0o644); err != nil {
		t.Fatal(err)
	}

	api := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusTeapot) // penanda: request sampai ke router
	})
	srv := httptest.NewServer(storageStaticHandler(root)(api))
	defer srv.Close()

	get := func(path string) int {
		req, err := http.NewRequest(http.MethodGet, srv.URL+path, nil)
		if err != nil {
			t.Fatal(err)
		}
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer resp.Body.Close()
		return resp.StatusCode
	}

	if code := get("/storage/avatars/2026/09/a.jpg"); code != http.StatusOK {
		t.Fatalf("file era local = %d, mau 200", code)
	}
	if code := get("/storage/avatars/2026/09/hilang.jpg"); code != http.StatusNotFound {
		t.Fatalf("file tidak ada = %d, mau 404", code)
	}
	// Route API tidak boleh dibajak handler statis.
	if code := get("/storage/files"); code != http.StatusTeapot {
		t.Fatalf("/storage/files = %d, mau diteruskan ke router", code)
	}
	if code := get("/storage/folders"); code != http.StatusTeapot {
		t.Fatalf("/storage/folders = %d, mau diteruskan ke router", code)
	}
	if code := get("/storage/files/7"); code != http.StatusTeapot {
		t.Fatalf("/storage/files/7 = %d, mau diteruskan ke router", code)
	}
	// Traversal tidak boleh keluar dari root.
	if code := get("/storage/../../etc/passwd"); code == http.StatusOK {
		t.Fatal("path traversal berhasil, harus 404")
	}
}
