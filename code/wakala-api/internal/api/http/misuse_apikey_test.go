package http

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"wakalaserver/internal/apikeys"
)

func apiKeyWalk(t *testing.T) stepRunWalk {
	t.Helper()
	w := newStepRunWalk(t, referralPlan(), "Volunteer")
	keys, err := apikeys.NewManager(stepRunDB(t))
	if err != nil {
		t.Fatalf("apikeys.NewManager: %v", err)
	}
	w.deps.APIKeys = keys
	w.handler = NewRouter(w.deps)
	return w
}

func (w stepRunWalk) bearerCall(t *testing.T, method, path, token string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, strings.NewReader(""))
	req.Header.Set("Authorization", "Bearer "+token)
	rec := httptest.NewRecorder()
	w.handler.ServeHTTP(rec, req)
	return rec
}

func TestAgencyAPIKey_OtherAgencyOperatorCannotDoMintListOrRevokeThisAgencysKey(t *testing.T) {
	w := apiKeyWalk(t)
	other := w.cookieFor(t, "operator-of-water-board")
	if rec := w.call(t, "POST", "/instances", map[string]any{"name": "Water board"}, other); rec.Code != http.StatusCreated {
		t.Fatalf("other operator creates own instance: %d %s", rec.Code, rec.Body.String())
	}
	mint := "/instances/" + w.instance + "/api-keys"

	if rec := w.call(t, "POST", mint, map[string]any{"name": "intruder key"}, other); rec.Code < 400 {
		t.Fatalf("other agency operator minting a key here: %d %s, want refused", rec.Code, rec.Body.String())
	}
	minted := w.call(t, "POST", mint, map[string]any{"name": "intake bot"}, w.owner)
	if minted.Code != http.StatusCreated {
		t.Fatalf("owner minting a key: %d %s, want 201", minted.Code, minted.Body.String())
	}
	keyID, _ := decodeObject(t, minted)["id"].(string)
	if keyID == "" {
		t.Fatalf("no key id in %s", minted.Body.String())
	}

	if rec := w.call(t, "GET", "/auth/api-keys", nil, other); rec.Code != http.StatusOK || strings.Contains(rec.Body.String(), keyID) {
		t.Fatalf("other agency operator listing keys: %d %s, want 200 without this agency's key", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "GET", "/auth/api-keys", nil, w.owner); rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), keyID) {
		t.Fatalf("owner listing keys: %d %s, want 200 with the minted key", rec.Code, rec.Body.String())
	}

	revoke := "/auth/api-keys/" + keyID
	if rec := w.call(t, "DELETE", revoke, nil, other); rec.Code < 400 {
		t.Fatalf("other agency operator revoking this agency's key: %d %s, want refused", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "DELETE", revoke, nil, w.owner); rec.Code != http.StatusNoContent {
		t.Fatalf("owner revoking the key: %d %s, want 204", rec.Code, rec.Body.String())
	}
}

func TestAgencyAPIKey_RevokedKeyCannotDoReachTheAgency(t *testing.T) {
	w := apiKeyWalk(t)
	mint := "/instances/" + w.instance + "/api-keys"
	token := func(name string) (string, string) {
		rec := w.call(t, "POST", mint, map[string]any{"name": name}, w.owner)
		if rec.Code != http.StatusCreated {
			t.Fatalf("owner minting %s: %d %s", name, rec.Code, rec.Body.String())
		}
		out := decodeObject(t, rec)
		id, _ := out["id"].(string)
		tok, _ := out["token"].(string)
		return id, tok
	}
	revokedID, revokedToken := token("retired bot")
	_, liveToken := token("intake bot")
	if rec := w.call(t, "DELETE", "/auth/api-keys/"+revokedID, nil, w.owner); rec.Code != http.StatusNoContent {
		t.Fatalf("owner revoking the key: %d %s, want 204", rec.Code, rec.Body.String())
	}

	path := "/instances/" + w.instance
	if rec := w.bearerCall(t, "GET", path, revokedToken); rec.Code != http.StatusUnauthorized {
		t.Fatalf("revoked key reading the agency: %d %s, want 401", rec.Code, rec.Body.String())
	}
	if rec := w.bearerCall(t, "GET", path, liveToken); rec.Code != http.StatusOK {
		t.Fatalf("live key reading the agency: %d %s, want 200", rec.Code, rec.Body.String())
	}
}
