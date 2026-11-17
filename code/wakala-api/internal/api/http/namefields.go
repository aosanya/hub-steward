package http

import (
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"unicode/utf8"
)

const maxNameRunes = 200

type nameField struct {
	path  *regexp.Regexp
	field string
}

var nameFields = []nameField{
	{regexp.MustCompile(`^/instances/[^/]+/actor/groups$`), "name"},
	{regexp.MustCompile(`^/instances/[^/]+/actor/actors$`), "display_name"},
	{regexp.MustCompile(`^/instances/[^/]+/actor/hierarchies$`), "name"},
	{regexp.MustCompile(`^/instances/[^/]+/forms/forms$`), "title"},
	{regexp.MustCompile(`^/instances/[^/]+/voting/polls$`), "question"},
	{regexp.MustCompile(`^/instances/[^/]+/taskmanager/backlogs$`), "name"},
	{regexp.MustCompile(`^/instances/[^/]+/taskmanager/projects$`), "name"},
	{regexp.MustCompile(`^/instances/[^/]+/taskmanager/tasks$`), "title"},
}

func checkNameFields(method, path string, raw []byte) error {
	if method != http.MethodPost {
		return nil
	}
	for _, nf := range nameFields {
		if !nf.path.MatchString(path) {
			continue
		}
		var body map[string]json.RawMessage
		if json.Unmarshal(raw, &body) != nil {
			return nil
		}
		var text string
		if json.Unmarshal(body[nf.field], &text) != nil {
			return nil
		}
		if text != "" && strings.TrimSpace(text) == "" {
			return fmt.Errorf("%s must not be only spaces", nf.field)
		}
		if utf8.RuneCountInString(text) > maxNameRunes {
			return fmt.Errorf("%s may be at most %d characters", nf.field, maxNameRunes)
		}
		return nil
	}
	return nil
}
