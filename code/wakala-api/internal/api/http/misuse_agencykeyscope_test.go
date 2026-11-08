package http

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func bearerPost(t *testing.T, w stepRunWalk, path, token string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest("POST", path, strings.NewReader(`{"name":"second key"}`))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	w.handler.ServeHTTP(rec, req)
	return rec
}

func mintedKey(t *testing.T, w stepRunWalk, instance string, as *http.Cookie, name string) (int, string) {
	t.Helper()
	rec := w.call(t, "POST", "/instances/"+instance+"/api-keys", map[string]any{"name": name}, as)
	if rec.Code != http.StatusCreated {
		return rec.Code, ""
	}
	token, _ := decodeObject(t, rec)["token"].(string)
	return rec.Code, token
}

func TestAgencyAPIKey_OtherAgencyKeyCannotDoReadThisAgency(t *testing.T) {
	w := apiKeyWalk(t)
	other := w.cookieFor(t, "operator-of-water-board")
	otherInstance := decodeObject(t, w.call(t, "POST", "/instances", map[string]any{"name": "Water board"}, other))["id"].(string)

	code, foreignToken := mintedKey(t, w, otherInstance, other, "water bot")
	if code != http.StatusCreated {
		t.Fatalf("other operator minting a key for their own agency: %d, want 201", code)
	}
	code, ownToken := mintedKey(t, w, w.instance, w.owner, "intake bot")
	if code != http.StatusCreated {
		t.Fatalf("owner minting a key: %d, want 201", code)
	}

	path := "/instances/" + w.instance
	if rec := w.bearerCall(t, "GET", path, foreignToken); rec.Code < 400 {
		t.Fatalf("other agency's key reading this agency: %d %s, want refused", rec.Code, rec.Body.String())
	}
	if rec := w.bearerCall(t, "GET", path+"/roles", foreignToken); rec.Code < 400 {
		t.Fatalf("other agency's key listing this agency's roles: %d %s, want refused", rec.Code, rec.Body.String())
	}
	if rec := w.bearerCall(t, "GET", path, ownToken); rec.Code != http.StatusOK {
		t.Fatalf("this agency's own key reading it: %d %s, want 200", rec.Code, rec.Body.String())
	}
}

func TestAgencyAPIKey_AgentMemberAndKeyCannotDoMintAnotherKey(t *testing.T) {
	w := apiKeyWalk(t)
	path := "/instances/" + w.instance

	agent := w.cookieFor(t, "agent-intake")
	if rec := w.call(t, "POST", path+"/agents", map[string]any{"user_id": "agent-intake"}, w.owner); rec.Code != http.StatusCreated {
		t.Fatalf("owner adds agent: %d %s", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "POST", path+"/api-keys", map[string]any{"name": "agent's own"}, agent); rec.Code != http.StatusForbidden {
		t.Fatalf("agent member minting an agency key: %d %s, want 403", rec.Code, rec.Body.String())
	}

	code, token := mintedKey(t, w, w.instance, w.owner, "intake bot")
	if code != http.StatusCreated {
		t.Fatalf("owner minting a key: %d, want 201", code)
	}
	if rec := bearerPost(t, w, path+"/api-keys", token); rec.Code != http.StatusUnauthorized {
		t.Fatalf("agency key minting another agency key: %d %s, want 401", rec.Code, rec.Body.String())
	}
	if rec := bearerPost(t, w, "/auth/api-keys", token); rec.Code != http.StatusUnauthorized {
		t.Fatalf("agency key minting a personal key: %d %s, want 401", rec.Code, rec.Body.String())
	}
}
