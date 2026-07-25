package services

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"
)

var placeholderRE = regexp.MustCompile(`\{([^}]+)\}`)

var systemNumberPlaceholders = map[string]struct{}{
	"number":      {},
	"code":        {},
	"month_roman": {},
	"year":        {},
	"nomor":       {},
	"nomor_surat": {},
	"letter_code": {},
}

func isSystemNumberPlaceholder(name string) bool {
	base := strings.ToLower(strings.SplitN(name, ":", 2)[0])
	_, ok := systemNumberPlaceholders[base]
	return ok
}

// ExtractCustomPlaceholders returns non-system placeholder names from a number format template.
func ExtractCustomPlaceholders(tmpl string) []string {
	seen := map[string]struct{}{}
	var out []string
	for _, m := range placeholderRE.FindAllStringSubmatch(tmpl, -1) {
		if len(m) < 2 {
			continue
		}
		name := m[1]
		if isSystemNumberPlaceholder(name) {
			continue
		}
		key := strings.ToLower(strings.SplitN(name, ":", 2)[0])
		if _, dup := seen[key]; dup {
			continue
		}
		seen[key] = struct{}{}
		out = append(out, key)
	}
	return out
}

func lookupSegment(extras map[string]string, name string) string {
	if extras == nil {
		return ""
	}
	if v, ok := extras[name]; ok {
		return strings.TrimSpace(v)
	}
	lower := strings.ToLower(name)
	if v, ok := extras[lower]; ok {
		return strings.TrimSpace(v)
	}
	base := strings.ToLower(strings.SplitN(name, ":", 2)[0])
	if v, ok := extras[base]; ok {
		return strings.TrimSpace(v)
	}
	return ""
}

// ValidateNumberSegments ensures all custom placeholders in the template have values.
func ValidateNumberSegments(tmpl string, extras map[string]string) error {
	for _, key := range ExtractCustomPlaceholders(tmpl) {
		if lookupSegment(extras, key) == "" {
			return fmt.Errorf("segmen nomor surat {%s} wajib diisi", key)
		}
	}
	return nil
}

// FormatLetterNumber renders a letter number from template, system fields, and custom segments.
// When allowMissing is true, empty custom segments render as [name] (for preview).
func FormatLetterNumber(tmpl string, num int, code string, date time.Time, extras map[string]string, allowMissing bool) (string, error) {
	months := []string{"", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"}
	if !allowMissing {
		if err := ValidateNumberSegments(tmpl, extras); err != nil {
			return "", err
		}
	}

	out := placeholderRE.ReplaceAllStringFunc(tmpl, func(match string) string {
		inner := match[1 : len(match)-1]
		parts := strings.SplitN(inner, ":", 2)
		key := strings.ToLower(parts[0])

		switch key {
		case "number", "nomor", "nomor_surat":
			pad := 3
			if len(parts) == 2 {
				pad, _ = strconv.Atoi(parts[1])
			}
			if pad > 0 {
				return fmt.Sprintf("%0*d", pad, num)
			}
			return fmt.Sprintf("%d", num)
		case "code", "letter_code":
			return code
		case "month_roman":
			if int(date.Month()) >= 0 && int(date.Month()) < len(months) {
				return months[date.Month()]
			}
			return ""
		case "year":
			return fmt.Sprintf("%d", date.Year())
		default:
			val := lookupSegment(extras, inner)
			if val != "" {
				return val
			}
			if allowMissing {
				return "[" + parts[0] + "]"
			}
			return ""
		}
	})
	return out, nil
}

func formatLetterNumber(tmpl string, num int, code string, date time.Time) string {
	out, err := FormatLetterNumber(tmpl, num, code, date, nil, true)
	if err != nil {
		return out
	}
	return out
}

// SegmentsFromVariableValues normalizes variable_values map for number formatting.
func SegmentsFromVariableValues(vals map[string]string) map[string]string {
	if len(vals) == 0 {
		return map[string]string{}
	}
	out := make(map[string]string, len(vals))
	for k, v := range vals {
		key := strings.ToLower(strings.TrimSpace(k))
		if key == "" {
			continue
		}
		out[key] = strings.TrimSpace(v)
	}
	return out
}
