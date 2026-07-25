package storageutil

import (
	"bytes"
	"context"
	"encoding/base64"
	"fmt"
	"io"
	"mime"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/lrndwy/gokil/config"
	"github.com/lrndwy/gokil/storage"
)

var (
	once     sync.Once
	provider storage.Provider
	initErr  error
)

func Init(settings config.StorageSettings) error {
	once.Do(func() {
		provider, initErr = storage.New(settings)
	})
	return initErr
}

func Provider() storage.Provider {
	return provider
}

func Upload(ctx context.Context, key string, data []byte, contentType string) (string, error) {
	if provider == nil {
		return "", fmt.Errorf("storage not initialized")
	}
	if contentType == "" {
		contentType = mime.TypeByExtension(filepath.Ext(key))
		if contentType == "" {
			contentType = "application/octet-stream"
		}
	}
	if err := provider.Upload(ctx, key, bytes.NewReader(data), int64(len(data)), contentType); err != nil {
		return "", err
	}
	return provider.URL(key)
}

func UploadReader(ctx context.Context, key string, r io.Reader, size int64, contentType string) (string, error) {
	if provider == nil {
		return "", fmt.Errorf("storage not initialized")
	}
	if err := provider.Upload(ctx, key, r, size, contentType); err != nil {
		return "", err
	}
	return provider.URL(key)
}

func Key(prefix, filename string) string {
	now := time.Now()
	safe := strings.Map(func(r rune) rune {
		if r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' || r == '.' || r == '-' || r == '_' {
			return r
		}
		return '_'
	}, filename)
	return fmt.Sprintf("%s/%04d/%02d/%d-%s", prefix, now.Year(), now.Month(), now.Unix(), safe)
}

func DecodeDataURL(dataURL string) ([]byte, string, error) {
	if !strings.HasPrefix(dataURL, "data:") {
		return nil, "", fmt.Errorf("invalid data URL")
	}
	parts := strings.SplitN(dataURL, ",", 2)
	if len(parts) != 2 {
		return nil, "", fmt.Errorf("invalid data URL")
	}
	meta := parts[0]
	payload := parts[1]
	contentType := "application/octet-stream"
	if idx := strings.Index(meta, ":"); idx >= 0 {
		rest := meta[idx+1:]
		if semi := strings.Index(rest, ";"); semi >= 0 {
			contentType = rest[:semi]
		} else {
			contentType = rest
		}
	}
	var data []byte
	var err error
	if strings.HasSuffix(meta, ";base64") {
		data, err = base64.StdEncoding.DecodeString(payload)
	} else {
		data = []byte(payload)
	}
	return data, contentType, err
}
