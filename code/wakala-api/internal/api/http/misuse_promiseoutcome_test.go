package http

import (
	"context"
	"errors"
	"net/http"
	"testing"

	"wakalaserver/internal/agencies"
)

func TestPromiseOutcome_MayorCannotDoRecordOutcome(t *testing.T) {
	w := newStepRunWalk(t, nil)
	perms := map[string][]string{
		"role-mayor":    {"report.publish"},
		"role-scrutiny": {"promise.record_outcome"},
	}
	w.deps.rolePermissionsOverride = func(_ context.Context, roleID string) ([]string, error) {
		p, ok := perms[roleID]
		if !ok {
			return nil, errors.New("unknown role")
		}
		return p, nil
	}
	path := "/instances/" + w.instance
	agent := func(subject, roleID string) *http.Cookie {
		c := w.cookieFor(t, subject)
		if rec := w.call(t, "POST", path+"/agents", map[string]any{"user_id": subject}, w.owner); rec.Code != http.StatusCreated {
			t.Fatalf("owner adds agent %s: %d %s", subject, rec.Code, rec.Body.String())
		}
		if rec := w.call(t, "PUT", path+"/members/"+subject+"/agency-role", map[string]any{"agency_role_id": roleID}, w.owner); rec.Code != http.StatusOK {
			t.Fatalf("owner links %s to %s: %d %s", subject, roleID, rec.Code, rec.Body.String())
		}
		return c
	}
	mayor := agent("agent-mayor", "role-mayor")
	scrutiny := agent("agent-scrutiny", "role-scrutiny")

	ctx := context.Background()
	board, err := w.deps.Registry.TaskManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("TaskManager: %v", err)
	}
	tasks, err := agencies.PromisesAsTasks(ctx, board, "form-1", 1, []agencies.ReportPromise{{Text: "Fix the Mill Row lights", DueAt: "2026-12-31T00:00:00Z", AnswersFor: "lights"}})
	if err != nil || len(tasks) != 1 {
		t.Fatalf("PromisesAsTasks: %v %d", err, len(tasks))
	}
	outcome := path + "/forms/forms/form-1/results/promises/" + tasks[0].ID + "/outcome"
	body := map[string]any{"outcome": "kept", "note": "done"}

	if rec := w.call(t, "PUT", outcome, body, mayor); rec.Code != http.StatusForbidden && rec.Code != http.StatusNotFound {
		t.Fatalf("mayor recording a promise outcome: %d %s, want 403 or 404", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "PUT", outcome, body, scrutiny); rec.Code != http.StatusOK {
		t.Fatalf("scrutiny chair recording a promise outcome: %d %s, want 200", rec.Code, rec.Body.String())
	}
}
