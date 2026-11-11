package http

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestPublicFormDoor_StrangerCannotDeclareAGroupTheAgencyDoesNotHave(t *testing.T) {
	w := newStepRunWalk(t, nil)
	forms := "/instances/" + w.instance + "/forms"
	door := forms + "/public-links/declare-group-key"
	closes := time.Now().Add(48 * time.Hour).UTC().Format(time.RFC3339)
	rec := w.call(t, "POST", forms+"/forms", map[string]any{"title": "Street survey", "audience": "public", "closes_at": closes}, w.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create form: %d %s", rec.Code, rec.Body.String())
	}
	formID, _ := decodeObject(t, rec)["id"].(string)
	if rec := w.call(t, "POST", forms+"/forms/"+formID+"/publish", map[string]any{"candidate_link_key": "declare-group-key"}, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("publish form: %d %s", rec.Code, rec.Body.String())
	}
	ward := w.call(t, "POST", "/instances/"+w.instance+"/actor/groups", map[string]any{"name": "Kertváros"}, w.owner)
	if ward.Code != http.StatusCreated {
		t.Fatalf("create ward: %d %s", ward.Code, ward.Body.String())
	}
	wardID, _ := decodeObject(t, ward)["id"].(string)

	otherOperator := w.cookieFor(t, "operator-of-water-board")
	otherInstance := w.call(t, "POST", "/instances", map[string]any{"name": "Water board"}, otherOperator)
	if otherInstance.Code != http.StatusCreated {
		t.Fatalf("create other agency: %d %s", otherInstance.Code, otherInstance.Body.String())
	}
	otherInstanceID, _ := decodeObject(t, otherInstance)["id"].(string)
	foreign := w.call(t, "POST", "/instances/"+otherInstanceID+"/actor/groups", map[string]any{"name": "Pumping station"}, otherOperator)
	if foreign.Code != http.StatusCreated {
		t.Fatalf("create other agency's group: %d %s", foreign.Code, foreign.Body.String())
	}
	foreignID, _ := decodeObject(t, foreign)["id"].(string)

	post := func(path string, body map[string]any) *httptest.ResponseRecorder {
		raw, _ := json.Marshal(body)
		req := httptest.NewRequest(http.MethodPost, path, bytes.NewReader(raw))
		req.Header.Set("Content-Type", "application/json")
		out := httptest.NewRecorder()
		w.handler.ServeHTTP(out, req)
		return out
	}
	registered := post(door+"/respondents", map[string]any{})
	if registered.Code != http.StatusOK {
		t.Fatalf("stranger registering: %d %s", registered.Code, registered.Body.String())
	}
	respondent := decodeObject(t, registered)
	declare := func(group, text string) *httptest.ResponseRecorder {
		return post(door+"/declarations", map[string]any{
			"respondent_id": respondent["id"], "public_key": respondent["public_key"],
			"declared_chapter_id": group, "declared_text": text,
		})
	}

	if got := declare("", "Mill Street"); got.Code != http.StatusCreated {
		t.Fatalf("declaration in words: %d %s, want 201", got.Code, got.Body.String())
	}
	if got := declare(wardID, ""); got.Code != http.StatusCreated {
		t.Fatalf("declaring this agency's ward: %d %s, want 201", got.Code, got.Body.String())
	}
	for name, group := range map[string]string{
		"another agency's group": foreignID,
		"a made-up id":           "F-made-up-ward",
		"a zeroed id":            "00000000-0000-0000-0000-0000000000aa",
	} {
		if got := declare(group, ""); got.Code != http.StatusBadRequest {
			t.Fatalf("stranger declaring %s: %d %s, want 400", name, got.Code, got.Body.String())
		}
	}
}
