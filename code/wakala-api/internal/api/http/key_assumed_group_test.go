package http

import (
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"

	"wakalaserver/internal/apikeys"
)

func (w groupRoleWalk) withKeys(t *testing.T) groupRoleWalk {
	t.Helper()
	keys, err := apikeys.NewManager(stepRunDB(t))
	if err != nil {
		t.Fatalf("apikeys.NewManager: %v", err)
	}
	w.deps.APIKeys = keys
	w.handler = NewRouter(w.deps)
	return w
}

func (w groupRoleWalk) keyOf(t *testing.T, as *http.Cookie) string {
	t.Helper()
	rec := w.call(t, "POST", "/auth/api-keys", map[string]any{"name": "agent"}, as)
	if rec.Code != http.StatusCreated {
		t.Fatalf("mint a key: %d %s, want 201", rec.Code, rec.Body.String())
	}
	return decodeObject(t, rec)["token"].(string)
}

func (w groupRoleWalk) asKey(t *testing.T, token, method, path string, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	w.handler.ServeHTTP(rec, req)
	return rec
}

func (w groupRoleWalk) keyAssumes(t *testing.T, token, group string) {
	t.Helper()
	rec := w.asKey(t, token, "PUT", "/instances/"+w.instance+"/my-group", `{"group_id":"`+w.group(t, group)+`"}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("a key assumes %s: %d %s, want 200", group, rec.Code, rec.Body.String())
	}
}

func (w groupRoleWalk) keyHolds(t *testing.T, token string) []string {
	t.Helper()
	rec := w.asKey(t, token, "GET", "/instances/"+w.instance+"/my-roles", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("my-roles as a key: %d %s, want 200", rec.Code, rec.Body.String())
	}
	names := roleCodesOf(t, decodeObject(t, rec))
	slices.Sort(names)
	return names
}

func (w groupRoleWalk) keyCreatesAnIssue(t *testing.T, token string) int {
	t.Helper()
	return w.asKey(t, token, "POST", w.tm("/tasks"), `{"title":"An agent issue"}`).Code
}

func TestKeyAssumedGroup_AKeyHoldsTheRolesOfTheGroupItAssumedOnTheNextRequest(t *testing.T) {
	w := newGroupRoleWalk(t).withKeys(t)
	_, kofi := w.resident(t, "Kofi", "Support", "Dev")
	w.giveRole(t, "Support", "Reader")
	w.giveRole(t, "Dev", "Worker")
	token := w.keyOf(t, kofi)

	w.keyAssumes(t, token, "Support")
	wantRoles(t, "a key on Support", w.keyHolds(t, token), "Reader")
	w.keyAssumes(t, token, "Dev")
	wantRoles(t, "a key on Dev", w.keyHolds(t, token), "Worker")
}

func TestKeyAssumedGroup_AKeyWithNoAssumedGroupReachesNothing(t *testing.T) {
	w := newGroupRoleWalk(t).withKeys(t)
	_, kofi := w.resident(t, "Kofi", "Support")
	w.giveRole(t, "Support", "Worker")
	token := w.keyOf(t, kofi)

	if code := w.keyCreatesAnIssue(t, token); code != http.StatusForbidden {
		t.Fatalf("a key with no assumed group creates an issue: %d, want 403", code)
	}
	if rec := w.asKey(t, token, "GET", w.tm("/tasks"), ""); rec.Code != http.StatusForbidden {
		t.Fatalf("a key with no assumed group lists issues: %d, want 403", rec.Code)
	}
}

func TestKeyAssumedGroup_AKeyActsWithTheSeatsOfTheGroupItAssumed(t *testing.T) {
	w := newGroupRoleWalk(t).withKeys(t)
	_, kofi := w.resident(t, "Kofi", "Support", "Dev")
	w.giveRole(t, "Support", "Reader")
	w.giveRole(t, "Dev", "Worker")
	token := w.keyOf(t, kofi)

	w.keyAssumes(t, token, "Support")
	if code := w.keyCreatesAnIssue(t, token); code != http.StatusForbidden {
		t.Fatalf("a key on a Reader group creates an issue: %d, want 403", code)
	}
	w.keyAssumes(t, token, "Dev")
	if code := w.keyCreatesAnIssue(t, token); code != http.StatusCreated {
		t.Fatalf("a key on a Worker group creates an issue: %d, want 201", code)
	}
}

func TestKeyAssumedGroup_AKeyReachesTheBacklogOfTheGroupItAssumedOnly(t *testing.T) {
	w := newGroupRoleWalk(t).withKeys(t)
	_, kofi := w.resident(t, "Kofi", "Support", "Dev")
	w.giveRole(t, "Support", "Reader")
	w.giveRole(t, "Dev", "Reader")
	w.backlogWith(t, "see", "Support")
	w.journeyIssue(t, "backlog", "to-do")
	token := w.keyOf(t, kofi)
	listBacklogs := func() int {
		return w.asKey(t, token, "GET", w.tm("/backlogs"), "").Code
	}

	if code := listBacklogs(); code != http.StatusForbidden {
		t.Fatalf("a key with no assumed group lists backlogs: %d, want 403", code)
	}
	w.keyAssumes(t, token, "Support")
	if code := listBacklogs(); code != http.StatusOK {
		t.Fatalf("a key on Support (Can see) lists backlogs: %d, want 200", code)
	}
	w.keyAssumes(t, token, "Dev")
	rec := w.asKey(t, token, "GET", w.tm("/backlogs"), "")
	if items, _ := decodeObject(t, rec)["items"].([]any); rec.Code != http.StatusOK || len(items) != 0 {
		t.Fatalf("a key on Dev, a group with no access, lists backlogs: %d %s, want none", rec.Code, rec.Body.String())
	}
}
