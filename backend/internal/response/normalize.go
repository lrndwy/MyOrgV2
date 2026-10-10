package response

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"strconv"

	"backend/internal/storageutil"
)

// maxNormalizeBody membatasi body JSON yang dinormalkan; di atas itu request
// dilewatkan apa adanya.
const maxNormalizeBody = 8 << 20

// NormalizeStorageInputs menormalkan kolom file storage ("url" / "*_url") di
// body JSON permintaan menjadi key storage.
//
// Klien sering mengirim balik URL absolut yang baru diterimanya dari response
// (form edit memuat ulang record lalu menyimpan apa adanya). Tanpa normalisasi
// ini URL tersebut ikut tersimpan ke DB dan mengikat data ke domain lama —
// padahal DB seharusnya hanya menyimpan key (internal/storageutil/path.go).
//
// Body yang tidak memuat kolom file dilewatkan tanpa diubah; body non-JSON
// (multipart upload, dsb.) tidak disentuh sama sekali.
func NormalizeStorageInputs(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Body == nil || !isJSON(r.Header.Get("Content-Type")) || r.ContentLength == 0 ||
			r.ContentLength > maxNormalizeBody {
			next.ServeHTTP(w, r)
			return
		}

		body, err := io.ReadAll(io.LimitReader(r.Body, maxNormalizeBody+1))
		if err != nil {
			r.Body = io.NopCloser(bytes.NewReader(body))
			next.ServeHTTP(w, r)
			return
		}
		if len(body) > maxNormalizeBody {
			// Terlalu besar untuk diproses: kembalikan utuh ke handler.
			r.Body = io.NopCloser(io.MultiReader(bytes.NewReader(body), r.Body))
			next.ServeHTTP(w, r)
			return
		}
		_ = r.Body.Close()

		out, changed := normalizeJSON(body)
		r.Body = io.NopCloser(bytes.NewReader(out))
		if changed {
			r.ContentLength = int64(len(out))
			r.Header.Set("Content-Length", strconv.Itoa(len(out)))
		}
		next.ServeHTTP(w, r)
	})
}

// normalizeJSON mengembalikan body apa adanya bila tidak ada kolom file yang
// perlu dinormalkan, sehingga request biasa tidak di-decode ulang.
func normalizeJSON(body []byte) ([]byte, bool) {
	dec := json.NewDecoder(bytes.NewReader(body))
	var v any
	if err := dec.Decode(&v); err != nil {
		return body, false
	}
	if !normalizeValue(v) {
		return body, false
	}
	out, err := json.Marshal(v)
	if err != nil {
		return body, false
	}
	return out, true
}

func normalizeValue(v any) bool {
	changed := false
	switch t := v.(type) {
	case map[string]any:
		for k, val := range t {
			if storageutil.IsURLField(k) {
				if s, ok := val.(string); ok {
					if next := storageutil.KeyFromStored(s); next != s {
						t[k] = next
						changed = true
						continue
					}
				}
			}
			if normalizeValue(val) {
				changed = true
			}
		}
	case []any:
		for _, item := range t {
			if normalizeValue(item) {
				changed = true
			}
		}
	}
	return changed
}
