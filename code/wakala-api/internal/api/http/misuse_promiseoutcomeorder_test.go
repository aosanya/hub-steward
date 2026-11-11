package http

import (
	"context"
	"errors"
	"net/http"
	"testing"

	"wakalaserver/internal/agencies"
)

func TestPromiseOutcome_HolderCannotDoRecordBeforeDueOrOverwrite(t *testing.T) {
	w := newStepRunWalk(t, nil)
	perms := map[string][]string{
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
	first := agent("agent-first", "role-scrutiny")
	second := agent("agent-second", "role-scrutiny")

	ctx := context.Background()
	board, err := w.deps.Registry.TaskManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("TaskManager: %v", err)
	}
	tasks, err := agencies.PromisesAsTasks(ctx, board, "form-1", 1, []agencies.ReportPromise{
		{Text: "Fix the Mill Row lights", DueAt: "2099-12-31T00:00:00Z", AnswersFor: "lights"},
		{Text: "Repaint the Oak Lane bench", DueAt: "2020-01-01T00:00:00Z", AnswersFor: "bench"},
	})
	if err != nil || len(tasks) != 2 {
		t.Fatalf("PromisesAsTasks: %v %d", err, len(tasks))
	}
	future := path + "/forms/forms/form-1/results/promises/" + tasks[0].ID + "/outcome"
	due := path + "/forms/forms/form-1/results/promises/" + tasks[1].ID + "/outcome"

	if rec := w.call(t, "PUT", due, map[string]any{"outcome": "kept", "note": "done"}, first); rec.Code != http.StatusOK {
		t.Fatalf("recording the outcome of a due promise: %d %s, want 200", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "PUT", future, map[string]any{"outcome": "kept", "note": "early"}, first); rec.Code < 400 || rec.Code >= 500 {
		t.Errorf("recording the outcome of a promise not yet due: %d %s, want 409 or 4xx", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "PUT", due, map[string]any{"outcome": "not_kept", "note": "overwrite"}, second); rec.Code != http.StatusConflict {
		t.Fatalf("second holder overwriting a recorded outcome: %d %s, want 409", rec.Code, rec.Body.String())
	}
}
