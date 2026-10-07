package storageutil

import (
	"context"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"

	"github.com/lrndwy/gokil/config"
)

// Regresi: header Accept-Encoding tidak boleh ikut ditandatangani. Kalau ikut
// (perilaku storage.NewS3 bawaan gokil), reverse proxy yang menulis ulang
// header itu — Cloudflare — bikin SigV4 di server tidak cocok dan semua upload
// gagal 403 SignatureDoesNotMatch.
func TestS3UploadDoesNotSignAcceptEncoding(t *testing.T) {
	var gotAuth, gotAcceptEncoding, gotPath string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("Authorization")
		gotAcceptEncoding = r.Header.Get("Accept-Encoding")
		gotPath = r.URL.Path
		w.Header().Set("ETag", `"d41d8cd98f00b204e9800998ecf8427e"`)
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	p, err := newS3(config.StorageSettings{
		Provider:        "s3",
		Bucket:          "myorg",
		Region:          "us-east-1",
		Endpoint:        srv.URL + "/",
		AccessKeyID:     "AKIAEXAMPLE",
		SecretAccessKey: "secretexample",
	})
	if err != nil {
		t.Fatalf("newS3: %v", err)
	}

	if err := p.Upload(context.Background(), "letters/a.txt", strings.NewReader("hi"), 2, "text/plain"); err != nil {
		t.Fatalf("Upload: %v", err)
	}

	signed := gotAuth[strings.Index(gotAuth, "SignedHeaders=")+len("SignedHeaders="):]
	signed = signed[:strings.Index(signed, ",")]
	signedHeaders := strings.Split(signed, ";")
	if !slices.Contains(signedHeaders, "host") {
		t.Fatalf("host tidak ikut ditandatangani: %q", gotAuth)
	}
	if slices.Contains(signedHeaders, "accept-encoding") {
		t.Fatalf("Accept-Encoding ikut ditandatangani (akan gagal di balik Cloudflare): %q", gotAuth)
	}
	if gotAcceptEncoding != "identity" {
		t.Fatalf("Accept-Encoding di wire = %q, mau identity", gotAcceptEncoding)
	}

	// Endpoint bertrailing slash tidak boleh menghasilkan path "//bucket".
	if gotPath != "/myorg/letters/a.txt" {
		t.Fatalf("path = %q", gotPath)
	}
}
