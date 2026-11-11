package http

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"sync"
	"testing"

	"wakalaserver/internal/agencies"
)

func TestPromiseOutcome_ParallelRecordsLeaveOneWinnerAndTheRestRefused(t *testing.T) {
	w := newStepRunWalk(t, nil)
	w.deps.rolePermissionsOverride = func(_ context.Context, roleID string) ([]string, error) {
		if roleID != "role-scrutiny" {
			return nil, errors.New("unknown role")
		}
		return []string{"promise.record_outcome"}, nil
	}
	path := "/instances/" + w.instance
	subject := "agent-parallel"
	cookie := w.cookieFor(t, subject)
	if rec := w.call(t, "POST", path+"/agents", map[string]any{"user_id": subject}, w.owner); rec.Code != http.StatusCreated {
		t.Fatalf("owner adds agent: %d %s", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "PUT", path+"/members/"+subject+"/agency-role", map[string]any{"agency_role_id": "role-scrutiny"}, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("owner links agent: %d %s", rec.Code, rec.Body.String())
	}
	ctx := context.Background()
	board, err := w.deps.Registry.TaskManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("TaskManager: %v", err)
	}

	const promises = 6
	const callers = 16
	reports := make([]agencies.ReportPromise, promises)
	for i := range reports {
		reports[i] = agencies.ReportPromise{Text: fmt.Sprintf("promise %d", i), DueAt: "2020-01-01T00:00:00Z", AnswersFor: "lights"}
	}
	tasks, err := agencies.PromisesAsTasks(ctx, board, "form-1", 1, reports)
	if err != nil || len(tasks) != promises {
		t.Fatalf("PromisesAsTasks: %v %d", err, len(tasks))
	}

	for _, task := range tasks {
		url := path + "/forms/forms/form-1/results/promises/" + task.ID + "/outcome"
		codes := make([]int, callers)
		notes := make([]string, callers)
		start := make(chan struct{})
		var wg sync.WaitGroup
		for i := 0; i < callers; i++ {
			wg.Add(1)
			go func(i int) {
				defer wg.Done()
				notes[i] = fmt.Sprintf("n%d", i)
				<-start
				codes[i] = w.call(t, "PUT", url, map[string]any{"outcome": "kept", "note": notes[i]}, cookie).Code
			}(i)
		}
		close(start)
		wg.Wait()

		winner := -1
		for i, code := range codes {
			switch code {
			case http.StatusOK:
				if winner != -1 {
					t.Errorf("promise %s: more than one caller got 200 (callers %d and %d)", task.ID, winner, i)
				}
				winner = i
			case http.StatusConflict:
			default:
				t.Errorf("promise %s: caller %d got %d, want 200 or 409", task.ID, i, code)
			}
		}
		if winner == -1 {
			t.Errorf("promise %s: no caller got 200", task.ID)
			continue
		}
		stored, err := board.GetTask(ctx, task.ID)
		if err != nil {
			t.Fatalf("GetTask: %v", err)
		}
		link, _ := agencies.PromiseOf(stored)
		if link.OutcomeNote != notes[winner] {
			t.Errorf("promise %s: stored note %q, want the winner's %q", task.ID, link.OutcomeNote, notes[winner])
		}
	}
}
