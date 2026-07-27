package services

import (
	"strings"
	"testing"
	"time"
)

func TestFormatLetterNumber(t *testing.T) {
	tmpl := "{number}/{code}/{month_roman}/{year}"
	date := time.Date(2026, 7, 25, 0, 0, 0, 0, time.UTC)
	got, err := FormatLetterNumber(tmpl, 5, "UND", date, nil, true)
	if err != nil {
		t.Fatal(err)
	}
	want := "005/UND/VII/2026"
	if got != want {
		t.Fatalf("got %q want %q", got, want)
	}
}

func TestFormatLetterNumberUnpadded(t *testing.T) {
	tmpl := "{number:0}/{code}/{year}"
	date := time.Date(2026, 7, 25, 0, 0, 0, 0, time.UTC)
	got, err := FormatLetterNumber(tmpl, 5, "UND", date, nil, true)
	if err != nil {
		t.Fatal(err)
	}
	if got != "5/UND/2026" {
		t.Fatalf("got %q", got)
	}
}

func TestFormatLetterNumberZeroPadAndSegment(t *testing.T) {
	tmpl := "{number:3}/{code}/{unit}/HIMATRIS/{month_roman}/{year}"
	date := time.Date(2026, 7, 25, 0, 0, 0, 0, time.UTC)
	extras := map[string]string{"unit": "PAN-Stuband"}
	got, err := FormatLetterNumber(tmpl, 1, "SPm-i", date, extras, false)
	if err != nil {
		t.Fatal(err)
	}
	want := "001/SPm-i/PAN-Stuband/HIMATRIS/VII/2026"
	if got != want {
		t.Fatalf("got %q want %q", got, want)
	}
}

func TestFormatLetterNumberMissingSegmentError(t *testing.T) {
	tmpl := "{number:3}/{code}/{unit}/HIMATRIS/{month_roman}/{year}"
	date := time.Date(2026, 7, 25, 0, 0, 0, 0, time.UTC)
	got, err := FormatLetterNumber(tmpl, 1, "SPm-i", date, nil, false)
	if err != nil {
		t.Fatal(err)
	}
	// Missing segment should not error; double separators should collapse
	if got != "001/SPm-i/HIMATRIS/VII/2026" {
		t.Fatalf("got %q want %q", got, "001/SPm-i/HIMATRIS/VII/2026")
	}
}

func TestFormatLetterNumberCollapseDoubleSlash(t *testing.T) {
	tmpl := "{number:3}/{code}{tujuan}/{unit}/HIMATRIS/{month_roman}/{year}"
	date := time.Date(2026, 7, 25, 0, 0, 0, 0, time.UTC)
	got, err := FormatLetterNumber(tmpl, 1, "SPm-i", date, nil, false)
	if err != nil {
		t.Fatal(err)
	}
	if got != "001/SPm-i/HIMATRIS/VII/2026" {
		t.Fatalf("got %q want %q", got, "001/SPm-i/HIMATRIS/VII/2026")
	}
}

func TestFormatLetterNumberPreviewMissingSegment(t *testing.T) {
	tmpl := "{number:3}/{code}/{unit}/HIMATRIS/{month_roman}/{year}"
	date := time.Date(2026, 7, 25, 0, 0, 0, 0, time.UTC)
	got, err := FormatLetterNumber(tmpl, 1, "SPm-i", date, nil, true)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(got, "[unit]") {
		t.Fatalf("expected [unit] placeholder in preview, got %q", got)
	}
}

func TestExtractCustomPlaceholders(t *testing.T) {
	tmpl := "{number:3}/{code}/{unit}/HIMATRIS/{tujuan}/{month_roman}/{year}"
	got := ExtractCustomPlaceholders(tmpl)
	want := []string{"unit", "tujuan"}
	if len(got) != len(want) {
		t.Fatalf("got %v want %v", got, want)
	}
	for i, w := range want {
		if got[i] != w {
			t.Fatalf("got %v want %v", got, want)
		}
	}
}

func TestComputeEventStatus(t *testing.T) {
	start := time.Date(2026, 7, 25, 9, 0, 0, 0, time.Local)
	end := time.Date(2026, 7, 25, 17, 0, 0, 0, time.Local)

	cases := []struct {
		now  time.Time
		want string
	}{
		{time.Date(2026, 7, 24, 23, 59, 0, 0, time.Local), "upcoming"},
		{time.Date(2026, 7, 25, 9, 0, 0, 0, time.Local), "ongoing"},
		{time.Date(2026, 7, 25, 12, 0, 0, 0, time.Local), "ongoing"},
		{time.Date(2026, 7, 25, 17, 0, 0, 0, time.Local), "ongoing"},
		{time.Date(2026, 7, 25, 17, 0, 1, 0, time.Local), "finished"},
	}

	for _, tc := range cases {
		got := computeEventStatus(start, end, tc.now)
		if got != tc.want {
			t.Fatalf("now=%v got %q want %q", tc.now, got, tc.want)
		}
	}
}

func TestFormatLetterNumberLegacyAliases(t *testing.T) {
	tmpl := "{NOMOR_SURAT}-{LETTER_CODE}"
	date := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	got, err := FormatLetterNumber(tmpl, 12, "SK", date, nil, true)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(got, "12") || !strings.Contains(got, "SK") {
		t.Fatalf("unexpected: %q", got)
	}
}
