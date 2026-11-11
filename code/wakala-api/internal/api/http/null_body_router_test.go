package http

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

var nullBodies = map[string]string{
	"null":              "null",
	"null with spaces":  "  null  ",
	"null with newline": "\nnull\n",
}

func (w stepRunWalk) callRaw(t *testing.T, method, path, body string, as *http.Cookie) (code int, panicked bool) {
	t.Helper()
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(as)
	rec := httptest.NewRecorder()
	defer func() {
		if recover() != nil {
			panicked = true
		}
	}()
	w.handler.ServeHTTP(rec, req)
	return rec.Code, false
}

func expectBadRequestNotPanic(t *testing.T, w stepRunWalk, method, path string, as *http.Cookie) {
	t.Helper()
	for label, body := range nullBodies {
		t.Run(label, func(t *testing.T) {
			code, panicked := w.callRaw(t, method, path, body, as)
			if panicked {
				t.Fatalf("a body of %q panicked the handler, the live server would drop the connection", body)
			}
			if code != http.StatusBadRequest {
				t.Fatalf("a body of %q answered %d, want 400", body, code)
			}
		})
	}
}

func TestNullBody_CaseVoteAnswers400NotAPanic(t *testing.T) {
	w := newCatalogVoteWalk(t)
	expectBadRequestNotPanic(t, w.stepRunWalk, "POST", w.tm()+"/cases/"+w.caseID+"/votes", w.people["Volunteer"])
}

func TestNullBody_StandingMessageCreateAnswers400NotAPanic(t *testing.T) {
	r := openCommRoom(t)
	expectBadRequestNotPanic(t, r.walk, "POST", r.room+"/standing", r.walk.owner)
}

func TestNullBody_AIChatAnswers400NotAPanic(t *testing.T) {
	w := newStepRunWalk(t, nil)
	w.deps.AI = NewAIResolver(w.db, w.deps.Registry, []byte("0123456789abcdef0123456789abcdef"))
	w.handler = NewRouter(w.deps)
	expectBadRequestNotPanic(t, w, "POST", "/instances/"+w.instance+"/ai/accounts/acct-1/chat", w.owner)
}
