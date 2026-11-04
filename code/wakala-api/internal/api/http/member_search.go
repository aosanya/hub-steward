package http

import (
	"encoding/json"
	"net/http"
	"strings"
)

const listActors = "actor.actor.list"

var memberSearchFields = []string{"display_name", "first_name", "last_name", "code", "public_code"}

func withMemberSearch(action string, serve http.HandlerFunc) http.HandlerFunc {
	if action != listActors {
		return serve
	}
	return func(w http.ResponseWriter, r *http.Request) {
		rewrittenBy(memberSearchRewrite(action, r), serve)(w, r)
	}
}

func memberSearchRewrite(action string, r *http.Request) rowRewrite {
	if action != listActors {
		return nil
	}
	needle := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("q")))
	if needle == "" {
		return nil
	}
	return func(_ *http.Request, rows []map[string]json.RawMessage) ([]map[string]json.RawMessage, error) {
		kept := make([]map[string]json.RawMessage, 0, len(rows))
		for _, row := range rows {
			if memberMatches(row, needle) {
				kept = append(kept, row)
			}
		}
		return kept, nil
	}
}

func memberMatches(row map[string]json.RawMessage, needle string) bool {
	for _, field := range memberSearchFields {
		var value string
		if json.Unmarshal(row[field], &value) == nil && strings.Contains(strings.ToLower(value), needle) {
			return true
		}
	}
	return false
}
