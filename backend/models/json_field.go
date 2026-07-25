package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
)

// JSONField stores JSON columns and maps SQL NULL to "{}" on read.
type JSONField json.RawMessage

func (j *JSONField) Scan(value any) error {
	if value == nil {
		*j = JSONField("{}")
		return nil
	}
	switch v := value.(type) {
	case []byte:
		if len(v) == 0 {
			*j = JSONField("{}")
			return nil
		}
		*j = JSONField(v)
	case string:
		if v == "" {
			*j = JSONField("{}")
			return nil
		}
		*j = JSONField(v)
	default:
		return fmt.Errorf("JSONField: unsupported type %T", value)
	}
	return nil
}

func (j JSONField) Value() (driver.Value, error) {
	if len(j) == 0 {
		return []byte("{}"), nil
	}
	return []byte(j), nil
}

func (j JSONField) MarshalJSON() ([]byte, error) {
	if len(j) == 0 {
		return []byte("{}"), nil
	}
	return json.RawMessage(j).MarshalJSON()
}

func (j *JSONField) UnmarshalJSON(data []byte) error {
	if j == nil {
		return fmt.Errorf("JSONField: UnmarshalJSON on nil pointer")
	}
	if len(data) == 0 {
		*j = JSONField("{}")
		return nil
	}
	*j = JSONField(data)
	return nil
}

func (j JSONField) Raw() json.RawMessage {
	if len(j) == 0 {
		return json.RawMessage("{}")
	}
	return json.RawMessage(j)
}
