package http

import (
	"context"
	"net/http"
	"sync"
	"testing"

	"wakalaserver/internal/reviewruns"
)

type countingReviews struct {
	mu      sync.Mutex
	started []string
}

func (c *countingReviews) Start(_ context.Context, _, draftID, startedBy, _ string) (reviewruns.Page, error) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.started = append(c.started, startedBy+":"+draftID)
	return reviewruns.Page{Review: &reviewruns.Review{ID: "review-1", DraftID: draftID, StartedBy: startedBy}}, nil
}

func (c *countingReviews) Resume(context.Context) error { return nil }

func (c *countingReviews) count() int {
	c.mu.Lock()
	defer c.mu.Unlock()
	return len(c.started)
}

func newReviewAgentWalk(t *testing.T) (designAgentWalk, *countingReviews) {
	t.Helper()
	w := newDesignAgentWalk(t)
	reviews := &countingReviews{}
	w.deps.Reviews = reviews
	return w, reviews
}

func (w designAgentWalk) runReviewOverHTTP(t *testing.T, as *http.Cookie) int {
	t.Helper()
	return w.call(t, "POST", w.base+"/review-runs", map[string]any{"draft_id": w.draftID}, as).Code
}

func (w designAgentWalk) runReviewOverMCP(t *testing.T, subject string) bool {
	t.Helper()
	out := w.mcpCall(t, subject, "agency_run_review", map[string]any{"instance_id": w.instance, "draft_id": w.draftID})
	return !out.IsError
}

func TestAgentReview_AgentWithoutPermissionCannotRunAReviewOverHTTP(t *testing.T) {
	w, reviews := newReviewAgentWalk(t)

	if code := w.runReviewOverHTTP(t, w.agent); code != http.StatusForbidden {
		t.Errorf("agent running a review over HTTP: %d, want 403", code)
	}
	if reviews.count() != 0 {
		t.Errorf("a review was started for the refused agent: %v", reviews.started)
	}
}

func TestAgentReview_AgentWithoutPermissionCannotRunAReviewOverMCP(t *testing.T) {
	w, reviews := newReviewAgentWalk(t)

	if w.runReviewOverMCP(t, "agent-chat") {
		t.Errorf("agent running agency_run_review: succeeded, want a tool error")
	}
	if reviews.count() != 0 {
		t.Errorf("a review was started for the refused agent: %v", reviews.started)
	}
}

func TestAgentReview_OwnerRunsAReviewOverHTTPAndMCP(t *testing.T) {
	w, reviews := newReviewAgentWalk(t)

	if code := w.runReviewOverHTTP(t, w.owner); code != http.StatusCreated {
		t.Errorf("owner running a review over HTTP: %d, want 201", code)
	}
	if !w.runReviewOverMCP(t, "test-owner") {
		t.Errorf("owner running agency_run_review: tool error, want success")
	}
	if reviews.count() != 2 {
		t.Errorf("reviews started for the owner: %d, want 2", reviews.count())
	}
}

func TestAgentReview_AgentHoldingReviewRunRunsAReviewOnBothDoors(t *testing.T) {
	w, reviews := newReviewAgentWalk(t)
	grant := map[string]any{"name": "Volunteer", "permissions": []string{"review.run"}}
	if rec := w.call(t, "PATCH", w.base+"/roles/"+w.roleID, grant, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("owner gives the role review.run: %d %s, want 200", rec.Code, rec.Body.String())
	}

	if code := w.runReviewOverHTTP(t, w.agent); code != http.StatusCreated {
		t.Errorf("agent holding review.run over HTTP: %d, want 201", code)
	}
	if !w.runReviewOverMCP(t, "agent-chat") {
		t.Errorf("agent holding review.run over MCP: tool error, want success")
	}
	if reviews.count() != 2 {
		t.Errorf("reviews started for the permitted agent: %d, want 2", reviews.count())
	}
}

func TestAgentReview_AgentHoldingOnlyDesignReadsCannotRunAReview(t *testing.T) {
	w, reviews := newReviewAgentWalk(t)
	grant := map[string]any{"name": "Volunteer", "permissions": []string{"risk.read", "controls.edit"}}
	if rec := w.call(t, "PATCH", w.base+"/roles/"+w.roleID, grant, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("owner gives the role risk.read and controls.edit: %d %s, want 200", rec.Code, rec.Body.String())
	}

	if code := w.runReviewOverHTTP(t, w.agent); code != http.StatusForbidden {
		t.Errorf("agent without review.run over HTTP: %d, want 403", code)
	}
	if w.runReviewOverMCP(t, "agent-chat") {
		t.Errorf("agent without review.run over MCP: succeeded, want a tool error")
	}
	if reviews.count() != 0 {
		t.Errorf("a review was started for the refused agent: %v", reviews.started)
	}
}
