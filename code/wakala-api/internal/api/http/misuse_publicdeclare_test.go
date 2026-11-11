package http

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestPublicFormDoor_StrangerCannotDoDeclareForAnotherDeviceOrAnUnofferedGroup(t *testing.T) {
	w := newStepRunWalk(t, nil)
	forms := "/instances/" + w.instance + "/forms"
	door := forms + "/public-links/"
	closes := time.Now().Add(48 * time.Hour).UTC().Format(time.RFC3339)
	rec := w.call(t, "POST", forms+"/forms", map[string]any{"title": "Market square", "audience": "public", "closes_at": closes}, w.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create form: %d %s", rec.Code, rec.Body.String())
	}
	formID, _ := decodeObject(t, rec)["id"].(string)
	if rec := w.call(t, "POST", forms+"/forms/"+formID+"/publish", map[string]any{"candidate_link_key": "market-square-key"}, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("publish form: %d %s", rec.Code, rec.Body.String())
	}
	group := w.call(t, "POST", "/instances/"+w.instance+"/actor/groups", map[string]any{"name": "North ward"}, w.owner)
	groupID, _ := decodeObject(t, group)["id"].(string)
	anon := func(path string, body map[string]any) *httptest.ResponseRecorder {
		raw, _ := json.Marshal(body)
		req := httptest.NewRequest("POST", path, bytes.NewReader(raw))
		req.Header.Set("Content-Type", "application/json")
		out := httptest.NewRecorder()
		w.handler.ServeHTTP(out, req)
		return out
	}
	victim := anon(door+"market-square-key/respondents", map[string]any{})
	victimID, _ := decodeObject(t, victim)["id"].(string)
	victimKey, _ := decodeObject(t, victim)["public_key"].(string)

	if rec := anon(door+"market-square-key/declarations", map[string]any{"respondent_id": victimID, "public_key": victimKey, "declared_chapter_id": groupID}); rec.Code != http.StatusCreated {
		t.Fatalf("device declaring for itself: %d %s, want 201", rec.Code, rec.Body.String())
	}
	if rec := anon(door+"market-square-key/declarations", map[string]any{"respondent_id": victimID, "declared_chapter_id": groupID}); rec.Code < 400 || rec.Code >= 500 {
		t.Fatalf("second device declaring for another respondent by id only: %d %s, want 4xx", rec.Code, rec.Body.String())
	}
	if rec := anon(door+"market-square-key/declarations", map[string]any{"respondent_id": victimID, "public_key": victimKey, "declared_chapter_id": "made-up-ward"}); rec.Code < 400 || rec.Code >= 500 {
		t.Fatalf("device declaring a group the form does not offer: %d %s, want 4xx", rec.Code, rec.Body.String())
	}
}
