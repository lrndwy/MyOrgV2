package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"backend/internal/storageutil"
	"github.com/lrndwy/gokil/config"
)

// Regresi: URL "/storage/<key>" dulu digerbangi provider == "local" sehingga
// semua URL lama (era provider local) mati 404 setelah pindah ke s3.
func TestStorageStaticHandlerServesLocalFiles(t *testing.T) {
	root := t.TempDir()
	if err := os.MkdirAll(filepath.Join(root, "avatars", "2026", "09"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "avatars", "2026", "09", "a.jpg"), []byte("jpegbytes"), 0o644); err != nil {
		t.Fatal(err)
	}

	srv := newStorageServer(t, root)
	defer srv.Close()

	if code := getStatus(t, srv.URL+"/storage/avatars/2026/09/a.jpg"); code != http.StatusOK {
		t.Fatalf("file era local = %d, mau 200", code)
	}
	// Berkas hilang diteruskan ke router (di produksi router yang menjawab 404
	// dengan envelope JSON), bukan 404 FileServer.
	if code := getStatus(t, srv.URL+"/storage/avatars/2026/09/hilang.jpg"); code != http.StatusTeapot {
		t.Fatalf("file tidak ada = %d, mau diteruskan ke router", code)
	}
	// Route API tidak boleh dibajak handler statis.
	for _, p := range []string{"/storage/files", "/storage/folders", "/storage/files/7"} {
		if code := getStatus(t, srv.URL+p); code != http.StatusTeapot {
			t.Fatalf("%s = %d, mau diteruskan ke router", p, code)
		}
	}
	// Traversal tidak boleh keluar dari root: tidak dilayani handler statis.
	if code := getStatus(t, srv.URL+"/storage/../../etc/passwd"); code == http.StatusOK {
		t.Fatal("path traversal berhasil, harus ditolak")
	}
	// POST bukan permintaan berkas.
	if code := postStatus(t, srv.URL+"/storage/avatars/2026/09/a.jpg"); code != http.StatusTeapot {
		t.Fatalf("POST = %d, mau diteruskan ke router", code)
	}
}

// Objek provider aktif harus bisa disajikan lewat origin aplikasi — ini yang
// menghilangkan CORS/mixed content karena browser tidak lagi menembak S3
// langsung.
func TestStorageStaticHandlerFallsBackToProvider(t *testing.T) {
	// Dir provider sengaja BEDA dari localPath handler, supaya jalur disk
	// pasti meleset dan fallback provider yang dipakai.
	providerDir := t.TempDir()
	if err := os.MkdirAll(filepath.Join(providerDir, "letters"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(providerDir, "letters", "1.docx"), []byte("docx-bytes"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := storageutil.Init(config.StorageSettings{Provider: "local", LocalPath: providerDir}); err != nil {
		t.Fatalf("init storage: %v", err)
	}
	if storageutil.Provider() == nil {
		t.Fatal("provider tidak terpasang")
	}

	emptyRoot := t.TempDir()
	srv := newStorageServer(t, emptyRoot)
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/storage/letters/1.docx")
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("objek provider = %d, mau 200", resp.StatusCode)
	}
	body, err := os.ReadFile(filepath.Join(providerDir, "letters", "1.docx"))
	if err != nil {
		t.Fatal(err)
	}
	buf := make([]byte, len(body))
	if _, readErr := resp.Body.Read(buf); string(buf) != string(body) {
		t.Fatalf("isi objek provider tidak cocok: %q (read: %v)", buf, readErr)
	}
	if ct := resp.Header.Get("Content-Type"); ct == "" {
		t.Fatal("Content-Type kosong")
	}

	// HEAD juga harus jalan tanpa body.
	head, err := http.Head(srv.URL + "/storage/letters/1.docx")
	if err != nil {
		t.Fatal(err)
	}
	defer head.Body.Close()
	if head.StatusCode != http.StatusOK {
		t.Fatalf("HEAD = %d, mau 200", head.StatusCode)
	}

	// Key yang tidak ada di provider diteruskan ke router.
	if code := getStatus(t, srv.URL+"/storage/letters/tidak-ada.docx"); code != http.StatusTeapot {
		t.Fatalf("key tidak ada = %d, mau diteruskan ke router", code)
	}
}

func newStorageServer(t *testing.T, localPath string) *httptest.Server {
	t.Helper()
	api := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusTeapot) // penanda: request sampai ke router
	})
	return httptest.NewServer(storageStaticHandler(localPath)(api))
}

func getStatus(t *testing.T, url string) int {
	t.Helper()
	resp, err := http.Get(url)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	return resp.StatusCode
}

func postStatus(t *testing.T, url string) int {
	t.Helper()
	resp, err := http.Post(url, "text/plain", nil)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	return resp.StatusCode
}
