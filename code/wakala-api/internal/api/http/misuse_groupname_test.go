package http

import (
	"net/http"
	"testing"
)

func TestGroups_OwnerCannotDoCreateTwoGroupsWithTheSameName(t *testing.T) {
	w := newStepRunWalk(t, nil)
	groups := "/instances/" + w.instance + "/actor/groups"

	if rec := w.call(t, "POST", groups, map[string]any{"name": "Kertváros körzet"}, w.owner); rec.Code != http.StatusCreated {
		t.Fatalf("owner creates the first group: %d %s", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "POST", groups, map[string]any{"name": "Malomsor körzet"}, w.owner); rec.Code != http.StatusCreated {
		t.Fatalf("owner creates a group with another name: %d %s", rec.Code, rec.Body.String())
	}
	for _, name := range []string{"Kertváros körzet", "kertváros körzet", " Kertváros körzet", "Kertváros  körzet"} {
		rec := w.call(t, "POST", groups, map[string]any{"name": name}, w.owner)
		if rec.Code != http.StatusConflict {
			t.Fatalf("owner naming a second group %q: %d %s, want 409", name, rec.Code, rec.Body.String())
		}
	}
}
