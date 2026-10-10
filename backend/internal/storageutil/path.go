package storageutil

import (
	"os"
	"strings"
)

// Database hanya menyimpan KEY storage ("events/banners/2026/10/123-x.jpg"),
// bukan URL. URL publik dirakit ulang saat response keluar lewat PublicURL,
// memakai base URL provider yang aktif (GOKIL_STORAGE_BASE_URL) — jadi pindah
// domain, port, atau nama bucket tidak merusak data lama.

// PublicURL merakit URL publik sebuah key memakai provider aktif.
func PublicURL(key string) string {
	if key == "" {
		return ""
	}
	if p := Provider(); p != nil {
		if u, err := p.URL(key); err == nil && u != "" {
			return u
		}
	}
	if base := strings.TrimSuffix(os.Getenv("GOKIL_STORAGE_BASE_URL"), "/"); base != "" {
		return base + "/" + key
	}
	return key
}

// IsKey melaporkan apakah v sudah berupa key storage. URL absolut, path
// "/storage/<key>" era provider local, dan data URL semuanya mengandung ":"
// atau diawali "/", sementara key tidak pernah keduanya (storageutil.Key
// menyaring nama file jadi [A-Za-z0-9._-]).
func IsKey(v string) bool {
	return v != "" && !strings.Contains(v, ":") && !strings.HasPrefix(v, "/")
}

// IsURLField melaporkan apakah nama kolom/field menyimpan file storage.
func IsURLField(name string) bool {
	return name == "url" || strings.HasSuffix(name, "_url")
}

// KeyFromStored menormalkan nilai yang tersimpan di DB (atau dikirim klien)
// menjadi key storage:
//
//	"avatars/2026/10/x.png"                  -> apa adanya (sudah key)
//	"/storage/avatars/2026/10/x.png"         -> "avatars/2026/10/x.png"
//	"http://host/bucket/avatars/.../x.png"   -> "avatars/.../x.png"
//	"data:image/png;base64,..."              -> apa adanya (bukan file storage)
func KeyFromStored(v string) string {
	if v == "" || strings.HasPrefix(v, "data:") || IsKey(v) {
		return v
	}
	if keys := KeyCandidates(v); len(keys) > 0 {
		return keys[0]
	}
	return v
}

// KeyCandidates menurunkan kandidat key storage dari nilai lama yang tersimpan
// di DB, paling mungkin lebih dulu.
//
// Format yang ditangani:
//
//	"<key>"                     -> key (format baru: DB menyimpan key)
//	"<base_url>/<key>"          -> key (base URL provider aktif)
//	"/storage/<key>"            -> key (provider local tanpa base URL)
//	"<host>/<bucket>/<key>"     -> key (endpoint path-style: bucket = segmen
//	                               pertama path, apa pun namanya — nama bucket
//	                               bisa berubah antar era, mis. myorg -> himatris)
//	"https://<bucket>.s3.<...>/<key>" -> key (virtual-host AWS, tanpa segmen bucket)
//
// Kandidat kedua (path tanpa segmen pertama) disertakan supaya pemanggil bisa
// memverifikasi keberadaan file alih-alih menebak.
func KeyCandidates(v string) []string {
	if v == "" || strings.HasPrefix(v, "data:") {
		return nil
	}
	if IsKey(v) {
		return []string{v}
	}
	if strings.HasPrefix(v, "/storage/") {
		if key := sanitizeKey(strings.TrimPrefix(v, "/storage/")); key != "" {
			return []string{key}
		}
		return nil
	}
	if !strings.HasPrefix(v, "http://") && !strings.HasPrefix(v, "https://") {
		return nil
	}

	rest := v[strings.Index(v, "://")+3:]
	slash := strings.Index(rest, "/")
	if slash < 0 {
		return nil
	}
	host := rest[:slash]
	path := sanitizeKey(rest[slash+1:])
	if path == "" {
		return nil
	}

	// Base URL provider aktif: kandidat paling akurat.
	if base := strings.TrimSuffix(os.Getenv("GOKIL_STORAGE_BASE_URL"), "/"); base != "" {
		if strings.HasPrefix(v, base+"/") {
			return []string{sanitizeKey(strings.TrimPrefix(v, base+"/"))}
		}
	}

	// Virtual-host AWS: path sudah berupa key, tidak ada segmen bucket.
	if strings.Contains(host, ".s3.") || strings.HasSuffix(host, ".s3.amazonaws.com") {
		return []string{path}
	}

	// Path-style: segmen pertama adalah bucket.
	out := []string{path}
	if i := strings.Index(path, "/"); i >= 0 {
		if trimmed := sanitizeKey(path[i+1:]); trimmed != "" {
			// Bucket aktif lebih dipercaya kalau namanya cocok.
			if bucket := os.Getenv("GOKIL_STORAGE_BUCKET"); bucket != "" && strings.HasPrefix(path, bucket+"/") {
				return []string{trimmed, path}
			}
			out = []string{trimmed, path}
		}
	}
	return out
}

func sanitizeKey(key string) string {
	key = strings.TrimPrefix(key, "/")
	if key == "" || strings.Contains(key, "..") {
		return ""
	}
	if i := strings.IndexAny(key, "?#"); i >= 0 {
		key = key[:i]
	}
	return key
}
