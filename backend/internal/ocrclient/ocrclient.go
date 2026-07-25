package ocrclient

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type extractResponse struct {
	Text   string `json:"text"`
	Method string `json:"method"`
	Pages  int    `json:"pages"`
}

// BaseURL returns OCR service URL from OCR_SERVICE_URL env.
func BaseURL() string {
	if u := os.Getenv("OCR_SERVICE_URL"); u != "" {
		return strings.TrimRight(u, "/")
	}
	return "http://localhost:8090"
}

func needsOCR(filename string) bool {
	ext := strings.ToLower(filepath.Ext(filename))
	switch ext {
	case ".pdf", ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tif", ".tiff":
		return true
	default:
		return false
	}
}

// ExtractText sends PDF/image bytes to the OCR microservice.
func ExtractText(ctx context.Context, data []byte, filename string) (string, string, error) {
	if !needsOCR(filename) {
		return "", "", fmt.Errorf("ocr: unsupported file type for %q", filename)
	}

	var body bytes.Buffer
	w := multipart.NewWriter(&body)
	part, err := w.CreateFormFile("file", filepath.Base(filename))
	if err != nil {
		return "", "", err
	}
	if _, err := part.Write(data); err != nil {
		return "", "", err
	}
	if err := w.Close(); err != nil {
		return "", "", err
	}

	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		BaseURL()+"/extract",
		&body,
	)
	if err != nil {
		return "", "", err
	}
	req.Header.Set("Content-Type", w.FormDataContentType())

	client := &http.Client{Timeout: 3 * time.Minute}
	resp, err := client.Do(req)
	if err != nil {
		return "", "", fmt.Errorf("ocr service unreachable: %w", err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", "", err
	}
	if resp.StatusCode >= 400 {
		return "", "", fmt.Errorf("ocr service error (%d): %s", resp.StatusCode, strings.TrimSpace(string(raw)))
	}

	var out extractResponse
	if err := json.Unmarshal(raw, &out); err != nil {
		return "", "", fmt.Errorf("ocr invalid response: %w", err)
	}
	return strings.TrimSpace(out.Text), out.Method, nil
}
