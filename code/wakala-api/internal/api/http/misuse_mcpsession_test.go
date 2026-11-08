package http

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"wakalaserver/internal/accounts"
)

func callMCPSession(h http.HandlerFunc, subject, sessionID string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/mcp", nil)
	if sessionID != "" {
		req.Header.Set(mcpSessionHeader, sessionID)
	}
	req = req.WithContext(accounts.WithID(req.Context(), subject))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestMCPSession_StrangerCannotReuseAnotherCallersSession(t *testing.T) {
	owners := newSessionOwners()
	reached := false
	guarded := bindMCPSessions(owners, func(w http.ResponseWriter, r *http.Request) {
		reached = true
		w.WriteHeader(http.StatusOK)
	})

	const session = "SESSIONONE"
	owners.claim(session, "opener-account")

	reached = false
	if rec := callMCPSession(guarded, "intruder-account", session); rec.Code != http.StatusForbidden {
		t.Fatalf("other caller on a bound session: %d %s, want 403", rec.Code, rec.Body.String())
	}
	if reached {
		t.Fatalf("other caller reached the handler on a bound session")
	}

	reached = false
	if rec := callMCPSession(guarded, "opener-account", session); rec.Code != http.StatusOK {
		t.Fatalf("opener on its own session: %d %s, want 200", rec.Code, rec.Body.String())
	}
	if !reached {
		t.Fatalf("opener did not reach the handler on its own session")
	}
}
