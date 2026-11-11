package routes

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	mwanachamaagency "wakalaserver/modules/agency"
	"wakalaserver/modules/agency/models"
)

type reviewAuthors struct {
	mwanachamaagency.AgencyManager
	startedBy, commentedBy string
}

func (r *reviewAuthors) StartReview(_ context.Context, _, by, _ string) (models.ReviewView, error) {
	r.startedBy = by
	return models.ReviewView{}, nil
}

func (r *reviewAuthors) CommentFinding(_ context.Context, _, _, by string) (models.ReviewComment, error) {
	r.commentedBy = by
	return models.ReviewComment{}, nil
}

func routeFor(t *testing.T, manager mwanachamaagency.AgencyManager, action string) Route {
	t.Helper()
	routes := Routes(manager, func(context.Context) string { return "the-session" })
	for _, route := range routes {
		if route.Action == action {
			return route
		}
	}
	t.Fatalf("no route for %s", action)
	return Route{}
}

func post(handler http.HandlerFunc, body string, pathValues map[string]string) *httptest.ResponseRecorder {
	req := httptest.NewRequest("POST", "/", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	for k, v := range pathValues {
		req.SetPathValue(k, v)
	}
	rec := httptest.NewRecorder()
	handler(rec, req)
	return rec
}

func TestAReviewIsStartedByTheCallerNotTheBody(t *testing.T) {
	manager := &reviewAuthors{}
	route := routeFor(t, manager, "agency.review.start")
	post(route.Handler, `{"draft_id":"d1","started_by":"forged-clerk"}`, nil)
	if manager.startedBy != "the-session" {
		t.Errorf("the review names %q as its starter; want the caller's own id the-session, never the body's forged-clerk", manager.startedBy)
	}
}

func TestAFindingCommentIsWrittenByTheCallerNotTheBody(t *testing.T) {
	manager := &reviewAuthors{}
	route := routeFor(t, manager, "agency.review_comment.create")
	post(route.Handler, `{"body":"a note","author":"forged-clerk"}`, map[string]string{"finding_id": "f1"})
	if manager.commentedBy != "the-session" {
		t.Errorf("the comment names %q as its author; want the caller's own id the-session, never the body's forged-clerk", manager.commentedBy)
	}
}
