package approvals

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"strings"
)

func decodeObject(text string) (map[string]any, bool) {
	dec := json.NewDecoder(strings.NewReader(text))
	dec.UseNumber()
	var value any
	if dec.Decode(&value) != nil {
		return nil, false
	}
	if _, err := dec.Token(); !errors.Is(err, io.EOF) {
		return nil, false
	}
	object, isObject := value.(map[string]any)
	return object, isObject
}

func encodeObject(object map[string]any) (string, error) {
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	if err := enc.Encode(object); err != nil {
		return "", err
	}
	return strings.TrimRight(buf.String(), "\n"), nil
}

func mergePatch(target, patch map[string]any) {
	for key, value := range patch {
		if value == nil {
			delete(target, key)
			continue
		}
		nested, isObject := value.(map[string]any)
		if !isObject {
			target[key] = value
			continue
		}
		existing, _ := target[key].(map[string]any)
		if existing == nil {
			existing = map[string]any{}
		}
		mergePatch(existing, nested)
		target[key] = existing
	}
}
