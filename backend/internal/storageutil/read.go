package storageutil

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

// ReadStored membaca isi file dari nilai yang tersimpan di DB:
//
//   - key storage -> provider aktif (S3/MinIO lewat GET bertanda tangan)
//   - "/storage/<key>" -> disk volume (era provider `local`)
//   - URL absolut -> GET langsung (era storage sebelum key-only)
func ReadStored(ctx context.Context, v string) ([]byte, error) {
	if v == "" {
		return nil, fmt.Errorf("empty storage value")
	}
	if IsKey(v) {
		p := Provider()
		if p == nil {
			return nil, fmt.Errorf("storage not initialized")
		}
		rc, err := p.Download(ctx, v)
		if err != nil {
			return nil, err
		}
		defer rc.Close()
		return io.ReadAll(rc)
	}
	if strings.HasPrefix(v, "/storage/") {
		root := os.Getenv("GOKIL_STORAGE_LOCAL_PATH")
		if root == "" {
			root = "storage"
		}
		rel := strings.TrimPrefix(v, "/storage/")
		path := filepath.Join(root, filepath.FromSlash(rel))
		return os.ReadFile(path)
	}
	if strings.HasPrefix(v, "http://") || strings.HasPrefix(v, "https://") {
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, v, nil)
		if err != nil {
			return nil, err
		}
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			return nil, err
		}
		defer resp.Body.Close()
		if resp.StatusCode >= 400 {
			return nil, fmt.Errorf("fetch failed: %s", resp.Status)
		}
		return io.ReadAll(resp.Body)
	}
	return nil, fmt.Errorf("unsupported storage value: %s", v)
}
