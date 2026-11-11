package http

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"
)

func TestGroups_BodyOfTheWrongShapeIsRefusedWithoutTheServersTypeNames(t *testing.T) {
	w := newStepRunWalk(t, nil)
	groups := "/instances/" + w.instance + "/actor/groups"

	cases := []struct {
		name string
		body map[string]any
		want string
	}{
		{"a number for the name", map[string]any{"name": 42}, "name must be text"},
		{"an object for the name", map[string]any{"name": map[string]any{"a": 1}}, "name must be text"},
		{"a field the route does not take", map[string]any{"name": "Kertváros körzet", "colour": "red"}, "colour"},
	}
	for _, c := range cases {
		rec := w.call(t, "POST", groups, c.body, w.owner)
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("%s: %d %s, want 400", c.name, rec.Code, rec.Body.String())
		}
		var reply struct {
			Error string `json:"error"`
		}
		if err := json.Unmarshal(rec.Body.Bytes(), &reply); err != nil {
			t.Fatalf("%s: %v", c.name, err)
		}
		for _, leak := range []string{"models.", "Go struct", "Go value", "json:", "mwanachama"} {
			if strings.Contains(reply.Error, leak) {
				t.Fatalf("%s: the reply %q names the server's internals (%q)", c.name, reply.Error, leak)
			}
		}
		if !strings.Contains(reply.Error, c.want) {
			t.Fatalf("%s: the reply %q does not say %q", c.name, reply.Error, c.want)
		}
	}
}
