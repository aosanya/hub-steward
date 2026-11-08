package http

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"wakalaserver/internal/agencies"
)

func TestPublicFormDoor_SecondResidentCannotDoClaimATokenAnotherResidentClaimed(t *testing.T) {
	w := newStepRunWalk(t, nil)
	forms := "/instances/" + w.instance + "/forms"
	door := forms + "/public-links/"
	closes := time.Now().Add(48 * time.Hour).UTC().Format(time.RFC3339)
	rec := w.call(t, "POST", forms+"/forms", map[string]any{"title": "Park benches", "audience": "public", "closes_at": closes}, w.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create form: %d %s", rec.Code, rec.Body.String())
	}
	formID, _ := decodeObject(t, rec)["id"].(string)
	if rec := w.call(t, "POST", forms+"/forms/"+formID+"/publish", map[string]any{"candidate_link_key": "park-benches-key"}, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("publish form: %d %s", rec.Code, rec.Body.String())
	}
	ctx := context.Background()
	for _, id := range []string{"resident-first", "resident-second"} {
		if err := w.deps.Registry.AddMember(ctx, w.instance, id, agencies.RoleResident); err != nil {
			t.Fatalf("AddMember %s: %v", id, err)
		}
	}
	first := w.cookieFor(t, "resident-first")
	second := w.cookieFor(t, "resident-second")

	body, _ := json.Marshal(map[string]any{})
	req := httptest.NewRequest("POST", door+"park-benches-key/respondents", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	reg := httptest.NewRecorder()
	w.handler.ServeHTTP(reg, req)
	if reg.Code != http.StatusOK {
		t.Fatalf("stranger registering on the door: %d %s", reg.Code, reg.Body.String())
	}
	token, _ := decodeObject(t, reg)["public_key"].(string)
	if token == "" {
		t.Fatalf("no device token: %s", reg.Body.String())
	}

	if rec := w.call(t, "POST", door+"park-benches-key/respondents/claim", map[string]any{"public_key": token}, first); rec.Code != http.StatusOK {
		t.Fatalf("first resident claiming the device token: %d %s, want 200", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "POST", door+"park-benches-key/respondents/claim", map[string]any{"public_key": token}, second); rec.Code != http.StatusConflict {
		t.Fatalf("second resident claiming a token already claimed: %d %s, want 409", rec.Code, rec.Body.String())
	}
}
