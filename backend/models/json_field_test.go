package models

import "testing"

func TestJSONFieldScanNull(t *testing.T) {
	var j JSONField
	if err := j.Scan(nil); err != nil {
		t.Fatal(err)
	}
	if string(j) != "{}" {
		t.Fatalf("got %q want {}", string(j))
	}
}

func TestJSONFieldScanBytes(t *testing.T) {
	var j JSONField
	if err := j.Scan([]byte(`{"a":"b"}`)); err != nil {
		t.Fatal(err)
	}
	if string(j.Raw()) != `{"a":"b"}` {
		t.Fatalf("unexpected %q", j.Raw())
	}
}
