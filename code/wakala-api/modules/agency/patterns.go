package mwanachamaagency

import "encoding/json"

func isJSONObject(s string) bool {
	var v any
	if err := json.Unmarshal([]byte(s), &v); err != nil {
		return false
	}
	_, ok := v.(map[string]any)
	return ok
}

var patterns = map[string]func(string) bool{
	"json_object": isJSONObject,
}
