package http

import (
	"bytes"
	"encoding/json"
	"errors"
)

var errBodyNotObject = errors.New("the request body must be a JSON object")

func decodeBodyObject(raw []byte) (map[string]json.RawMessage, error) {
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) == 0 {
		return map[string]json.RawMessage{}, nil
	}
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(trimmed, &fields); err != nil {
		return nil, err
	}
	if fields == nil {
		return nil, errBodyNotObject
	}
	return fields, nil
}
