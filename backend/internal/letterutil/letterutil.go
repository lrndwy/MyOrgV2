package letterutil

import (
	"archive/zip"
	"bytes"
	"context"
	"fmt"
	"io"
	"path/filepath"
	"regexp"
	"strings"

	"backend/internal/ocrclient"
)

var letterCodePatterns = []*regexp.Regexp{
	regexp.MustCompile(`(?i)(?:nomor|no\.?)\s*[:.]?\s*([0-9]+[/\-][A-Za-z0-9./\-]+)`),
	regexp.MustCompile(`([0-9]{1,4}[/\-][A-Za-z]{2,10}[/\-][0-9]{4})`),
	regexp.MustCompile(`([0-9]+[/\-][A-Za-z0-9./\-]{3,})`),
}

var placeholderRe = regexp.MustCompile(`\{[A-Z0-9_]+\}`)

func ExtractText(ctx context.Context, data []byte, filename string) (string, string, error) {
	ext := strings.ToLower(filepath.Ext(filename))
	switch ext {
	case ".docx":
		text, err := extractDocxText(data)
		return text, "docx", err
	case ".txt":
		return string(data), "txt", nil
	case ".pdf", ".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tif", ".tiff":
		text, method, err := ocrclient.ExtractText(ctx, data, filename)
		if err != nil {
			return "", "", err
		}
		return text, method, nil
	default:
		return scanPrintable(data), "fallback", nil
	}
}

func extractDocxText(data []byte) (string, error) {
	zr, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return "", err
	}
	var buf strings.Builder
	for _, f := range zr.File {
		if f.Name != "word/document.xml" {
			continue
		}
		rc, err := f.Open()
		if err != nil {
			return "", err
		}
		raw, err := io.ReadAll(rc)
		rc.Close()
		if err != nil {
			return "", err
		}
		buf.WriteString(stripXML(string(raw)))
		break
	}
	return strings.TrimSpace(buf.String()), nil
}

func stripXML(s string) string {
	s = regexp.MustCompile(`<w:tab[^>]*/>`).ReplaceAllString(s, "\t")
	s = regexp.MustCompile(`<w:br[^>]*/>`).ReplaceAllString(s, "\n")
	s = regexp.MustCompile(`<[^>]+>`).ReplaceAllString(s, "")
	s = strings.ReplaceAll(s, "&amp;", "&")
	s = strings.ReplaceAll(s, "&lt;", "<")
	s = strings.ReplaceAll(s, "&gt;", ">")
	return s
}

func scanPrintable(data []byte) string {
	var b strings.Builder
	for _, c := range string(data) {
		if c >= 32 && c < 127 || c == '\n' || c == '\r' || c == '\t' {
			b.WriteRune(c)
		}
	}
	return strings.TrimSpace(b.String())
}

func DetectLetterCode(text string) (string, bool) {
	text = strings.TrimSpace(text)
	if text == "" {
		return "", false
	}
	for _, re := range letterCodePatterns {
		if m := re.FindStringSubmatch(text); len(m) > 1 {
			return strings.TrimSpace(m[1]), true
		}
	}
	return "", false
}

func ListPlaceholders(docx []byte) ([]string, error) {
	xml, err := readDocxXML(docx)
	if err != nil {
		return nil, err
	}
	seen := map[string]struct{}{}
	var out []string
	for _, m := range placeholderRe.FindAllString(xml, -1) {
		if _, ok := seen[m]; ok {
			continue
		}
		seen[m] = struct{}{}
		out = append(out, m)
	}
	return out, nil
}

func MergeDocx(docx []byte, values map[string]string) ([]byte, error) {
	zr, err := zip.NewReader(bytes.NewReader(docx), int64(len(docx)))
	if err != nil {
		return nil, err
	}
	buf := &bytes.Buffer{}
	zw := zip.NewWriter(buf)
	for _, f := range zr.File {
		rc, err := f.Open()
		if err != nil {
			return nil, err
		}
		content, err := io.ReadAll(rc)
		rc.Close()
		if err != nil {
			return nil, err
		}
		if f.Name == "word/document.xml" || strings.HasPrefix(f.Name, "word/header") || strings.HasPrefix(f.Name, "word/footer") {
			s := string(content)
			for k, v := range values {
				s = strings.ReplaceAll(s, k, escapeXML(v))
				plain := strings.Trim(k, "{}")
				s = strings.ReplaceAll(s, "{"+plain+"}", escapeXML(v))
			}
			content = []byte(s)
		}
		w, err := zw.Create(f.Name)
		if err != nil {
			return nil, err
		}
		if _, err := w.Write(content); err != nil {
			return nil, err
		}
	}
	if err := zw.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func readDocxXML(docx []byte) (string, error) {
	zr, err := zip.NewReader(bytes.NewReader(docx), int64(len(docx)))
	if err != nil {
		return "", err
	}
	for _, f := range zr.File {
		if f.Name == "word/document.xml" {
			rc, err := f.Open()
			if err != nil {
				return "", err
			}
			raw, err := io.ReadAll(rc)
			rc.Close()
			if err != nil {
				return "", err
			}
			return string(raw), nil
		}
	}
	return "", fmt.Errorf("document.xml not found")
}

func escapeXML(s string) string {
	s = strings.ReplaceAll(s, "&", "&amp;")
	s = strings.ReplaceAll(s, "<", "&lt;")
	s = strings.ReplaceAll(s, ">", "&gt;")
	return s
}
