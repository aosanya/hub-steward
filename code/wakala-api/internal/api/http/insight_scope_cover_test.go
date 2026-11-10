package http

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
	mwanachamaactor "wakalaserver/modules/actor"
	mwanachamainsights "wakalaserver/modules/insights"
	insightmodels "wakalaserver/modules/insights/models"
)

type insightScopeDirectory struct {
	mwanachamaactor.UserManager
}

func (insightScopeDirectory) EnsureActor(context.Context, string) (mwanachamaactor.Actor, error) {
	return mwanachamaactor.Actor{}, nil
}

type insightScopeRegistry struct {
	agencies.Registry
	members map[string]bool
	down    bool
}

func (r insightScopeRegistry) IsMember(_ context.Context, instanceID, userID string) (bool, error) {
	if r.down {
		return false, errors.New("registry down")
	}
	return r.members[instanceID+"/"+userID], nil
}

func (insightScopeRegistry) ActorManager(context.Context, string) (mwanachamaactor.UserManager, error) {
	return insightScopeDirectory{}, nil
}

type insightsBySubject struct {
	mwanachamainsights.InsightManager
	subjects map[string]string
}

func (m insightsBySubject) GetInsight(_ context.Context, id string) (insightmodels.Insight, error) {
	subject, ok := m.subjects[id]
	if !ok {
		return insightmodels.Insight{}, errors.New("insight not found")
	}
	return insightmodels.Insight{ID: id, SubjectID: subject}, nil
}

func callScopedInsight(t *testing.T, reg agencies.Registry, im mwanachamainsights.InsightManager, method, target, body, pathInsight string) (int, string, bool) {
	t.Helper()
	reached := false
	handler := scopeInsightsToMembership(reg, im, func(w http.ResponseWriter, r *http.Request) {
		reached = true
		w.WriteHeader(http.StatusOK)
	})
	req := httptest.NewRequest(method, target, strings.NewReader(body))
	req = req.WithContext(accounts.WithID(req.Context(), "carol"))
	if pathInsight != "" {
		req.SetPathValue("insightID", pathInsight)
	}
	rec := httptest.NewRecorder()
	handler(rec, req)
	return rec.Code, rec.Body.String(), reached
}

func TestInsightsAreReachedOnlyThroughAnAgencyTheCallerBelongsTo(t *testing.T) {
	reg := insightScopeRegistry{members: map[string]bool{"mine/carol": true}}
	im := insightsBySubject{subjects: map[string]string{"in-mine": "mine", "in-theirs": "theirs"}}

	if code, _, reached := callScopedInsight(t, reg, im, http.MethodGet, "/?subject_id=mine", "", ""); code != http.StatusOK || !reached {
		t.Fatalf("a member listing their own agency's insights must pass, got %d", code)
	}
	if code, body, reached := callScopedInsight(t, reg, im, http.MethodGet, "/?subject_id=theirs", "", ""); code != http.StatusNotFound || reached || !strings.Contains(body, "not found") {
		t.Fatalf("another agency's insights must read as not found, got %d %s", code, body)
	}
	if code, _, reached := callScopedInsight(t, reg, im, http.MethodGet, "/", "", "in-mine"); code != http.StatusOK || !reached {
		t.Fatalf("an insight of my agency must open, got %d", code)
	}
	if code, _, reached := callScopedInsight(t, reg, im, http.MethodGet, "/", "", "in-theirs"); code != http.StatusNotFound || reached {
		t.Fatalf("an insight of another agency must read as not found, got %d", code)
	}
	if code, _, reached := callScopedInsight(t, reg, im, http.MethodGet, "/", "", "missing"); code != http.StatusNotFound || reached {
		t.Fatalf("an unknown insight must read as not found, got %d", code)
	}
}

func TestInsightWritesNameTheirAgencyInTheBody(t *testing.T) {
	reg := insightScopeRegistry{members: map[string]bool{"mine/carol": true}}
	im := insightsBySubject{}
	if code, _, reached := callScopedInsight(t, reg, im, http.MethodPost, "/", `{"subject_id":"mine","summary":"x"}`, ""); code != http.StatusOK || !reached {
		t.Fatalf("a write into my agency must pass, got %d", code)
	}
	if code, _, reached := callScopedInsight(t, reg, im, http.MethodPost, "/", `{"subject_id":"theirs"}`, ""); code != http.StatusNotFound || reached {
		t.Fatalf("a write into another agency must read as not found, got %d", code)
	}
	refusedBodies := []string{"", "   ", "{", `{"subject_id":"mine"} {"subject_id":"theirs"}`}
	for _, body := range refusedBodies {
		code, msg, reached := callScopedInsight(t, reg, im, http.MethodPost, "/", body, "")
		if code != http.StatusBadRequest || reached || !strings.Contains(msg, "names the agency") {
			t.Fatalf("body %q: want 400 naming the rule, got %d %s", body, code, msg)
		}
	}
}

func TestInsightScopeDoesNothingWithoutARegistry(t *testing.T) {
	if code, _, reached := callScopedInsight(t, nil, insightsBySubject{}, http.MethodGet, "/", "", ""); code != http.StatusOK || !reached {
		t.Fatalf("with no registry the handler is served as it is, got %d", code)
	}
}

func TestInsightScopeHidesAFailingMembershipCheck(t *testing.T) {
	reg := insightScopeRegistry{down: true}
	code, body, reached := callScopedInsight(t, reg, insightsBySubject{}, http.MethodGet, "/?subject_id=mine", "", "")
	if code != http.StatusNotFound || reached || strings.Contains(body, "registry down") {
		t.Fatalf("a failing check must read as not found without its reason, got %d %s", code, body)
	}
}
