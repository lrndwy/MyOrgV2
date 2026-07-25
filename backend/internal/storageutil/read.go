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

// ReadURL loads file bytes from a storage URL returned by Upload.
func ReadURL(ctx context.Context, url string) ([]byte, error) {
	if url == "" {
		return nil, fmt.Errorf("empty url")
	}
	if strings.HasPrefix(url, "http://") || strings.HasPrefix(url, "https://") {
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
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
	if strings.HasPrefix(url, "/storage/") {
		root := os.Getenv("GOKIL_STORAGE_LOCAL_PATH")
		if root == "" {
			root = "storage"
		}
		rel := strings.TrimPrefix(url, "/storage/")
		path := filepath.Join(root, filepath.FromSlash(rel))
		return os.ReadFile(path)
	}
	return nil, fmt.Errorf("unsupported url: %s", url)
}
