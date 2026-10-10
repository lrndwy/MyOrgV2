// Package response menyesuaikan body JSON yang keluar dari API.
package response

import (
	"bytes"
	"encoding/json"
	"mime"
	"net/http"
	"strings"

	"backend/internal/storageutil"
)

// ExpandStorageURLs mengubah nilai kolom file storage ("url" / "*_url") di
// body JSON dari key menjadi URL publik provider aktif.
//
// Database hanya menyimpan key (lihat internal/storageutil/path.go), jadi URL
// dirakit di satu tempat saat response keluar, bukan di tiap handler. Response
// non-JSON (ZIP backup, gambar dari /storage/*, unduhan docx) dilewatkan
// langsung tanpa di-buffer.
func ExpandStorageURLs(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ew := &expandingWriter{ResponseWriter: w}
		next.ServeHTTP(ew, r)
		ew.flush()
	})
}

type expandingWriter struct {
	http.ResponseWriter
	buf       bytes.Buffer
	status    int
	buffering bool
	decided   bool
}

func (w *expandingWriter) decide() {
	w.decided = true
	w.buffering = isJSON(w.Header().Get("Content-Type"))
}

func (w *expandingWriter) WriteHeader(code int) {
	if w.decided {
		return
	}
	w.decide()
	if !w.buffering {
		w.ResponseWriter.WriteHeader(code)
		return
	}
	w.status = code
}

func (w *expandingWriter) Write(b []byte) (int, error) {
	if !w.decided {
		w.decide()
	}
	if !w.buffering {
		return w.ResponseWriter.Write(b)
	}
	return w.buf.Write(b)
}

func (w *expandingWriter) flush() {
	if !w.decided || !w.buffering {
		return
	}
	w.Header().Del("Content-Length")
	if w.status != 0 {
		w.ResponseWriter.WriteHeader(w.status)
	}
	_, _ = w.ResponseWriter.Write(expandJSON(w.buf.Bytes()))
}

func isJSON(contentType string) bool {
	if contentType == "" {
		return false
	}
	if mt, _, err := mime.ParseMediaType(contentType); err == nil {
		contentType = mt
	}
	return contentType == "application/json" || strings.HasSuffix(contentType, "+json")
}

// expandJSON mengembalikan body apa adanya kalau bukan JSON valid atau tidak
// ada key storage yang perlu dirakit.
func expandJSON(body []byte) []byte {
	dec := json.NewDecoder(bytes.NewReader(body))
	dec.UseNumber() // jaga presisi int64/float64 saat decode-encode ulang
	var v any
	if err := dec.Decode(&v); err != nil {
		return body
	}
	if !expandValue(v) {
		return body
	}
	out, err := json.Marshal(v)
	if err != nil {
		return body
	}
	return append(out, '\n')
}

func expandValue(v any) bool {
	changed := false
	switch t := v.(type) {
	case map[string]any:
		for k, val := range t {
			if storageutil.IsURLField(k) {
				if s, ok := val.(string); ok && storageutil.IsKey(s) {
					t[k] = storageutil.PublicURL(s)
					changed = true
					continue
				}
			}
			if expandValue(val) {
				changed = true
			}
		}
	case []any:
		for _, item := range t {
			if expandValue(item) {
				changed = true
			}
		}
	}
	return changed
}
