package http

import (
	"net/http"
	"testing"
)

func listedKeys(t *testing.T, w assumedGroupWalk) []map[string]any {
	t.Helper()
	rec := w.call(t, "GET", "/auth/api-keys", nil, w.owner)
	if rec.Code != http.StatusOK {
		t.Fatalf("listing keys: %d %s", rec.Code, rec.Body.String())
	}
	return decodeObjects(t, rec)
}

func TestAgencyAPIKeyGroup_AKeyMadeWithAGroupIsRefusedAndMakesNoKey(t *testing.T) {
	w := newAssumedGroupWalk(t).withKeys(t)
	rec := w.call(t, "POST", w.path("api-keys"), map[string]any{"name": "intake bot", "group_id": w.staffGroup}, w.owner)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("minting a key with a group_id: %d %s, want 400", rec.Code, rec.Body.String())
	}
	if entries := listedKeys(t, w); len(entries) != 0 {
		t.Fatalf("keys after the refusal: %v, want none", entries)
	}
}

func TestAgencyAPIKeyGroup_TheKeyReplyAndTheKeyListCarryNoGroup(t *testing.T) {
	w := newAssumedGroupWalk(t).withKeys(t)
	rec := w.call(t, "POST", w.path("api-keys"), map[string]any{"name": "intake bot"}, w.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("minting a key: %d %s, want 201", rec.Code, rec.Body.String())
	}
	if _, present := decodeObject(t, rec)["group_id"]; present {
		t.Errorf("the create reply carries group_id: %s", rec.Body.String())
	}
	entries := listedKeys(t, w)
	if len(entries) != 1 {
		t.Fatalf("keys listed: %v, want one", entries)
	}
	if _, present := entries[0]["group_id"]; present {
		t.Errorf("the key list carries group_id: %v", entries[0])
	}
}

func TestAgencyAPIKeyGroup_PersonalKeyTakesNoGroup(t *testing.T) {
	w := newAssumedGroupWalk(t).withKeys(t)
	rec := w.call(t, "POST", "/auth/api-keys", map[string]any{"name": "personal", "group_id": w.staffGroup}, w.owner)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("personal key with a group: %d %s, want 400", rec.Code, rec.Body.String())
	}
}
