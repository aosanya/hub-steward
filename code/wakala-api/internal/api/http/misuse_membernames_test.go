package http

import (
	"net/http"
	"testing"
)

func TestMemberNames_ResidentCannotDoLookUpAnotherResidentsNameOutsideAGroup(t *testing.T) {
	w, base, _, _ := newGroupWithApplicant(t)
	instance := "/instances/" + w.instance

	rec := w.call(t, "PUT", instance+"/me/name", map[string]any{"display_name": "Pap Irén", "first_name": "Irén", "last_name": "Pap"}, w.people["Liaison"])
	if rec.Code >= 300 {
		t.Fatalf("liaison sets own name: %d %s", rec.Code, rec.Body.String())
	}
	liaisonID, _ := decodeObject(t, w.call(t, "GET", base+"/actors/mine", nil, w.people["Liaison"]))["id"].(string)
	if liaisonID == "" {
		t.Fatal("liaison actor id is empty")
	}
	lookup := instance + "/names?id=" + liaisonID

	rec = w.call(t, "GET", lookup, nil, w.people["Volunteer"])
	if rec.Code != http.StatusOK {
		t.Fatalf("volunteer name lookup: %d %s", rec.Code, rec.Body.String())
	}
	if rows := decodeObjects(t, rec); len(rows) != 0 {
		t.Fatalf("resident outside the group read another resident's name: %v, want none", rows)
	}

	rows := decodeObjects(t, w.call(t, "GET", lookup, nil, w.people["Liaison"]))
	if len(rows) != 1 || rows[0]["display_name"] != "Pap Irén" {
		t.Fatalf("liaison reading own name: %v, want one row", rows)
	}
	rows = decodeObjects(t, w.call(t, "GET", lookup, nil, w.owner))
	if len(rows) != 1 || rows[0]["last_name"] != "Pap" {
		t.Fatalf("owner reading the liaison's name: %v, want one full row", rows)
	}
}
