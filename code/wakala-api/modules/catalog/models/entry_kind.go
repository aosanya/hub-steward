package models

import (
	"encoding/json"
	"errors"
)

type KindField struct {
	Name     string `json:"name"`
	Type     string `json:"type"`
	Required bool   `json:"required,omitempty"`
}

type EntryKind struct {
	Name   string      `json:"name"`
	Fields []KindField `json:"fields"`
}

var ErrKindsMalformed = errors.New("kinds setting is malformed")

var kindFieldTypes = map[string]bool{"string": true, "number": true, "boolean": true, "object": true, "array": true}

func ParseEntryKinds(value any) ([]EntryKind, error) {
	raw, err := json.Marshal(value)
	if err != nil {
		return nil, ErrKindsMalformed
	}
	var kinds []EntryKind
	if string(raw) == "null" {
		return nil, nil
	}
	if err := json.Unmarshal(raw, &kinds); err != nil {
		return nil, ErrKindsMalformed
	}
	seen := map[string]bool{}
	for _, k := range kinds {
		if k.Name == "" || seen[k.Name] {
			return nil, ErrKindsMalformed
		}
		seen[k.Name] = true
		fields := map[string]bool{}
		for _, f := range k.Fields {
			if f.Name == "" || f.Name == "kind" || fields[f.Name] || !kindFieldTypes[f.Type] {
				return nil, ErrKindsMalformed
			}
			fields[f.Name] = true
		}
	}
	return kinds, nil
}

func (k EntryKind) Fits(doc map[string]any) bool {
	for _, f := range k.Fields {
		v, present := doc[f.Name]
		if !present || v == nil {
			if f.Required {
				return false
			}
			continue
		}
		if !fieldTypeHolds(f.Type, v) {
			return false
		}
	}
	return true
}

func fieldTypeHolds(t string, v any) bool {
	switch t {
	case "string":
		_, ok := v.(string)
		return ok
	case "number":
		_, ok := v.(float64)
		return ok
	case "boolean":
		_, ok := v.(bool)
		return ok
	case "object":
		_, ok := v.(map[string]any)
		return ok
	case "array":
		_, ok := v.([]any)
		return ok
	}
	return false
}
