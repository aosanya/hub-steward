package mwanachamacatalog

import (
	"encoding/json"
	"regexp"
)

var slugPattern = regexp.MustCompile(`^[a-z0-9]+(-[a-z0-9]+)*$`)

func isSlug(s string) bool { return slugPattern.MatchString(s) }

func isJSONObject(s string) bool {
	var v any
	if err := json.Unmarshal([]byte(s), &v); err != nil {
		return false
	}
	_, ok := v.(map[string]any)
	return ok
}

var patterns = map[string]func(string) bool{
	"slug":        isSlug,
	"json_object": isJSONObject,
}
