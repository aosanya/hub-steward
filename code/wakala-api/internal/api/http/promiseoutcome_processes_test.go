package http

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"gorm.io/gorm"

	"wakalaserver/internal/agencies"
)

func grantOutcomeRecording(d *Deps) {
	d.rolePermissionsOverride = func(_ context.Context, roleID string) ([]string, error) {
		if roleID != "role-scrutiny" {
			return nil, errors.New("unknown role")
		}
		return []string{"promise.record_outcome"}, nil
	}
}

func TestPromiseOutcomeRecordedOnceWhenTwoProcessesShareADatabase(t *testing.T) {
	path := filepath.Join(t.TempDir(), "wakala.db")
	first := newStepRunWalkOn(t, openSharedFile(t, path), nil)
	grantOutcomeRecording(first.deps)
	secondDeps, _ := stepRunDeps(t, openSharedFile(t, path))
	secondDeps.Sessions = first.deps.Sessions
	grantOutcomeRecording(secondDeps)
	handlers := []http.Handler{first.handler, NewRouter(secondDeps)}

	base := "/instances/" + first.instance
	subject := "agent-two-processes"
	cookie := first.cookieFor(t, subject)
	if rec := first.call(t, "POST", base+"/agents", map[string]any{"user_id": subject}, first.owner); rec.Code != http.StatusCreated {
		t.Fatalf("owner adds agent: %d %s", rec.Code, rec.Body.String())
	}
	if rec := first.call(t, "PUT", base+"/members/"+subject+"/agency-role", map[string]any{"agency_role_id": "role-scrutiny"}, first.owner); rec.Code != http.StatusOK {
		t.Fatalf("owner links agent: %d %s", rec.Code, rec.Body.String())
	}
	ctx := context.Background()
	board, err := first.deps.Registry.TaskManager(ctx, first.instance)
	if err != nil {
		t.Fatalf("TaskManager: %v", err)
	}

	const promises = 12
	const callers = 8
	reports := make([]agencies.ReportPromise, promises)
	for i := range reports {
		reports[i] = agencies.ReportPromise{Text: fmt.Sprintf("promise %d", i), DueAt: "2020-01-01T00:00:00Z", AnswersFor: "lights"}
	}
	tasks, err := agencies.PromisesAsTasks(ctx, board, "form-1", 1, reports)
	if err != nil || len(tasks) != promises {
		t.Fatalf("PromisesAsTasks: %v %d", err, len(tasks))
	}

	for round, task := range tasks {
		url := base + "/forms/forms/form-1/results/promises/" + task.ID + "/outcome"
		results := make([]*httptest.ResponseRecorder, callers)
		notes := make([]string, callers)
		start := make(chan struct{})
		var wg sync.WaitGroup
		for i := 0; i < callers; i++ {
			wg.Add(1)
			go func(i int) {
				defer wg.Done()
				notes[i] = fmt.Sprintf("n%d", i)
				<-start
				results[i] = callOn(handlers[i%len(handlers)], "PUT", url, map[string]any{"outcome": "kept", "note": notes[i]}, cookie)
			}(i)
		}
		close(start)
		wg.Wait()

		winner, ok, conflicts := -1, 0, 0
		for i, rec := range results {
			switch rec.Code {
			case http.StatusOK:
				ok++
				winner = i
			case http.StatusConflict:
				conflicts++
			default:
				t.Fatalf("round %d: caller %d got %d %s", round, i, rec.Code, rec.Body.String())
			}
		}
		if ok != 1 || conflicts != callers-1 {
			t.Fatalf("round %d: %d x 200 and %d x 409 from %d callers split over two processes, want 1 and %d", round, ok, conflicts, callers, callers-1)
		}
		stored, err := board.GetTask(ctx, task.ID)
		if err != nil {
			t.Fatalf("GetTask: %v", err)
		}
		link, _ := agencies.PromiseOf(stored)
		if link.OutcomeNote != notes[winner] {
			t.Fatalf("round %d: stored note %q, want the winner's %q", round, link.OutcomeNote, notes[winner])
		}
	}
}

type promiseOutcomeWalk struct {
	walk   stepRunWalk
	path   string
	cookie *http.Cookie
}

func newPromiseOutcomeWalk(t *testing.T, db *gorm.DB) promiseOutcomeWalk {
	t.Helper()
	w := newStepRunWalkOn(t, db, nil)
	grantOutcomeRecording(w.deps)
	path := "/instances/" + w.instance
	subject := "agent-claims"
	if rec := w.call(t, "POST", path+"/agents", map[string]any{"user_id": subject}, w.owner); rec.Code != http.StatusCreated {
		t.Fatalf("owner adds agent: %d %s", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "PUT", path+"/members/"+subject+"/agency-role", map[string]any{"agency_role_id": "role-scrutiny"}, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("owner links agent: %d %s", rec.Code, rec.Body.String())
	}
	return promiseOutcomeWalk{walk: w, path: path, cookie: w.cookieFor(t, subject)}
}

func (p promiseOutcomeWalk) duePromise(t *testing.T) string {
	t.Helper()
	board, err := p.walk.deps.Registry.TaskManager(context.Background(), p.walk.instance)
	if err != nil {
		t.Fatalf("TaskManager: %v", err)
	}
	tasks, err := agencies.PromisesAsTasks(context.Background(), board, "form-1", 1, []agencies.ReportPromise{{Text: "light the road", DueAt: "2020-01-01T00:00:00Z", AnswersFor: "lights"}})
	if err != nil || len(tasks) != 1 {
		t.Fatalf("PromisesAsTasks: %v %d", err, len(tasks))
	}
	return tasks[0].ID
}

func (p promiseOutcomeWalk) put(t *testing.T, taskID, outcome, note string) *httptest.ResponseRecorder {
	t.Helper()
	return p.walk.call(t, "PUT", p.path+"/forms/forms/form-1/results/promises/"+taskID+"/outcome", map[string]any{"outcome": outcome, "note": note}, p.cookie)
}

func (p promiseOutcomeWalk) stored(t *testing.T, taskID string) agencies.PromiseLink {
	t.Helper()
	board, err := p.walk.deps.Registry.TaskManager(context.Background(), p.walk.instance)
	if err != nil {
		t.Fatalf("TaskManager: %v", err)
	}
	task, err := board.GetTask(context.Background(), taskID)
	if err != nil {
		t.Fatalf("GetTask: %v", err)
	}
	link, _ := agencies.PromiseOf(task)
	return link
}

func TestPromiseOutcomeClaimedByAProcessThatStoppedIsFinishedByTheNextCaller(t *testing.T) {
	db := openSharedFile(t, filepath.Join(t.TempDir(), "wakala.db"))
	p := newPromiseOutcomeWalk(t, db)
	taskID := p.duePromise(t)
	claim := map[string]any{"task_id": taskID, "outcome": "partly_kept", "note": "half the lamps", "created_at": time.Now().UTC()}
	if err := db.Table("promise_outcome_claims").Create(claim).Error; err != nil {
		t.Fatalf("seed the claim a stopped process left: %v", err)
	}

	if rec := p.put(t, taskID, "kept", "all of them"); rec.Code != http.StatusConflict {
		t.Fatalf("a caller after the claim: %d %s, want 409", rec.Code, rec.Body.String())
	}
	link := p.stored(t, taskID)
	if link.Outcome != agencies.PromisePartlyKept || link.OutcomeNote != "half the lamps" {
		t.Fatalf("stored %q %q, want the claim's partly_kept and its note", link.Outcome, link.OutcomeNote)
	}
}

func TestStartupWithoutClaimsKeepsRecordedOutcomesAndTakesNewOnes(t *testing.T) {
	path := filepath.Join(t.TempDir(), "wakala.db")
	db := openSharedFile(t, path)
	p := newPromiseOutcomeWalk(t, db)
	recorded := p.duePromise(t)
	open := p.duePromise(t)
	if rec := p.put(t, recorded, "kept", "done"); rec.Code != http.StatusOK {
		t.Fatalf("first outcome: %d %s", rec.Code, rec.Body.String())
	}
	if err := db.Exec("drop table promise_outcome_claims").Error; err != nil {
		t.Fatalf("drop the claims as a database from before them has none: %v", err)
	}

	restartedDeps, _ := stepRunDeps(t, openSharedFile(t, path))
	restartedDeps.Sessions = p.walk.deps.Sessions
	grantOutcomeRecording(restartedDeps)
	restarted := p.walk
	restarted.deps, restarted.handler = restartedDeps, NewRouter(restartedDeps)
	again := promiseOutcomeWalk{walk: restarted, path: p.path, cookie: p.cookie}

	if rec := again.put(t, recorded, "not_kept", "changed my mind"); rec.Code != http.StatusConflict {
		t.Fatalf("an outcome recorded before the claims: %d %s, want 409", rec.Code, rec.Body.String())
	}
	if link := again.stored(t, recorded); link.Outcome != agencies.PromiseKept || link.OutcomeNote != "done" {
		t.Fatalf("stored %q %q, want the first outcome kept", link.Outcome, link.OutcomeNote)
	}
	if rec := again.put(t, open, "kept", "later"); rec.Code != http.StatusOK {
		t.Fatalf("a promise with no outcome yet: %d %s, want 200", rec.Code, rec.Body.String())
	}
	if rec := again.put(t, open, "not_kept", "again"); rec.Code != http.StatusConflict {
		t.Fatalf("a second outcome after the restart: %d %s, want 409", rec.Code, rec.Body.String())
	}
}
