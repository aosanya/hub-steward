package http

import (
	"encoding/json"
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

func TestGroups_OwnerCannotDoCreateOrRenameOntoTheDecomposedTwinOfAGroupName(t *testing.T) {
	w := newStepRunWalk(t, nil)
	groups := "/instances/" + w.instance + "/actor/groups"

	composed := "Kertváros Újhegy"
	decomposed := "Kertva\u0301ros U\u0301jhegy"
	if rec := w.call(t, "POST", groups, map[string]any{"name": composed}, w.owner); rec.Code != http.StatusCreated {
		t.Fatalf("owner creates the composed group: %d %s", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "POST", groups, map[string]any{"name": decomposed}, w.owner); rec.Code != http.StatusConflict {
		t.Fatalf("owner naming a second group with decomposed letters: %d %s, want 409", rec.Code, rec.Body.String())
	}
	rec := w.call(t, "POST", groups, map[string]any{"name": "Malomsor körzet"}, w.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("owner creates another group: %d %s", rec.Code, rec.Body.String())
	}
	var created struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &created); err != nil || created.ID == "" {
		t.Fatalf("read the new group: %v %s", err, rec.Body.String())
	}
	rename := w.call(t, "PATCH", groups+"/"+created.ID, map[string]any{"name": decomposed}, w.owner)
	if rename.Code != http.StatusConflict {
		t.Fatalf("owner renaming onto the decomposed twin: %d %s, want 409", rename.Code, rename.Body.String())
	}
}
