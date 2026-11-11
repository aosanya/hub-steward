package agencies

import (
	"context"
	"errors"
	"testing"
	"time"

	mwanachamataskmanager "wakalaserver/modules/taskmanager"
)

func TestPromisesBecomeTasksCarryingTheirReportAndWhoAnswers(t *testing.T) {
	board := newFakeBoard()
	tasks, err := PromisesAsTasks(context.Background(), board, "form-1", 3, []ReportPromise{
		{Text: "  Mend the well  ", DueAt: "2026-12-01T00:00:00Z", AnswersFor: "ward-clerk"},
		{Text: "Clear the drain", AnswersFor: "ward-clerk"},
	})
	if err != nil || len(tasks) != 2 {
		t.Fatalf("got %d tasks, %v", len(tasks), err)
	}
	if tasks[0].Title != "Mend the well" || tasks[0].DueAt != "2026-12-01T00:00:00Z" {
		t.Fatalf("title must be trimmed and due kept: %+v", tasks[0])
	}
	link, ok := PromiseOf(tasks[0])
	if !ok || link.FormID != "form-1" || link.ReportVersion != 3 || link.AnswersFor != "ward-clerk" || link.Outcome != "" {
		t.Fatalf("link %+v ok=%v", link, ok)
	}
}

func TestPromisesNeedAFormAVersionAndEachTextAndOwner(t *testing.T) {
	board := newFakeBoard()
	good := []ReportPromise{{Text: "x", AnswersFor: "a"}}
	for name, run := range map[string]func() error{
		"no form":      func() error { _, err := PromisesAsTasks(context.Background(), board, "", 1, good); return err },
		"version zero": func() error { _, err := PromisesAsTasks(context.Background(), board, "f", 0, good); return err },
		"blank text": func() error {
			_, err := PromisesAsTasks(context.Background(), board, "f", 1, []ReportPromise{{Text: "  ", AnswersFor: "a"}})
			return err
		},
		"no owner": func() error {
			_, err := PromisesAsTasks(context.Background(), board, "f", 1, []ReportPromise{{Text: "x"}})
			return err
		},
	} {
		if err := run(); !errors.Is(err, ErrInvalidPromise) {
			t.Errorf("%s: got %v", name, err)
		}
	}
	if len(board.tasks) != 0 {
		t.Fatalf("a refused set must create no task, made %d", len(board.tasks))
	}
}

func TestOneBadPromiseStopsTheWholeSetBeforeAnyTaskIsMade(t *testing.T) {
	board := newFakeBoard()
	_, err := PromisesAsTasks(context.Background(), board, "f", 1, []ReportPromise{{Text: "ok", AnswersFor: "a"}, {Text: "", AnswersFor: "a"}})
	if !errors.Is(err, ErrInvalidPromise) || len(board.tasks) != 0 {
		t.Fatalf("err=%v tasks=%d", err, len(board.tasks))
	}
}

func TestPromiseOfIgnoresTasksThatAreNotPromises(t *testing.T) {
	for name, body := range map[string]string{"empty": "", "text": "not json", "no form": `{"report_version":2}`} {
		if _, ok := PromiseOf(mwanachamataskmanager.Task{Context: body}); ok {
			t.Errorf("%s must not read as a promise", name)
		}
	}
}

func TestRecordingAnOutcomeKeepsTheLinkAndAddsTheNote(t *testing.T) {
	board := newFakeBoard()
	made, _ := PromisesAsTasks(context.Background(), board, "form-1", 2, []ReportPromise{{Text: "Mend the well", AnswersFor: "clerk"}})
	updated, err := RecordPromiseOutcome(context.Background(), board, made[0].ID, PromisePartlyKept, "pump still missing", time.Now())
	if err != nil {
		t.Fatal(err)
	}
	link, _ := PromiseOf(updated)
	if link.Outcome != PromisePartlyKept || link.OutcomeNote != "pump still missing" || link.FormID != "form-1" || link.ReportVersion != 2 || link.AnswersFor != "clerk" {
		t.Fatalf("link %+v", link)
	}
}

func TestRecordingRefusesAnUnknownOutcomeAnUnknownTaskAndANonPromise(t *testing.T) {
	board := newFakeBoard()
	plain, _ := board.CreateTask(context.Background(), mwanachamataskmanager.Task{Title: "plain"})
	if _, err := RecordPromiseOutcome(context.Background(), board, plain.ID, PromiseOutcome("late"), "", time.Now()); !errors.Is(err, ErrInvalidPromise) {
		t.Errorf("unknown outcome: %v", err)
	}
	if _, err := RecordPromiseOutcome(context.Background(), board, "missing", PromiseKept, "", time.Now()); err == nil || errors.Is(err, ErrInvalidPromise) {
		t.Errorf("unknown task must pass the board's error, got %v", err)
	}
	if _, err := RecordPromiseOutcome(context.Background(), board, plain.ID, PromiseKept, "", time.Now()); !errors.Is(err, ErrInvalidPromise) {
		t.Errorf("non-promise task: %v", err)
	}
}

func TestReportPromisesListsOnlyThatReportInTaskOrder(t *testing.T) {
	board := newFakeBoard()
	ctx := context.Background()
	if _, err := PromisesAsTasks(ctx, board, "form-1", 1, []ReportPromise{{Text: "old", AnswersFor: "a"}}); err != nil {
		t.Fatal(err)
	}
	if _, err := PromisesAsTasks(ctx, board, "form-1", 2, []ReportPromise{{Text: "first", DueAt: "d1", AnswersFor: "a"}, {Text: "second", AnswersFor: "b"}}); err != nil {
		t.Fatal(err)
	}
	if _, err := PromisesAsTasks(ctx, board, "form-2", 2, []ReportPromise{{Text: "elsewhere", AnswersFor: "a"}}); err != nil {
		t.Fatal(err)
	}
	board.CreateTask(ctx, mwanachamataskmanager.Task{Title: "plain"})
	reads, err := ReportPromises(ctx, board, "form-1", 2)
	if err != nil || len(reads) != 2 {
		t.Fatalf("got %+v, %v", reads, err)
	}
	if reads[0].Text != "first" || reads[0].DueAt != "d1" || reads[1].Text != "second" || reads[0].TaskID >= reads[1].TaskID {
		t.Fatalf("order or fields wrong: %+v", reads)
	}
	none, err := ReportPromises(ctx, board, "form-9", 1)
	if err != nil || none == nil || len(none) != 0 {
		t.Fatalf("an empty report must read as an empty list, got %#v %v", none, err)
	}
}

func TestRecordingWaitsForTheDueDateAndNeverOverwrites(t *testing.T) {
	ctx := context.Background()
	board := newFakeBoard()
	due := time.Date(2027, 1, 8, 0, 0, 0, 0, time.UTC)
	made, _ := PromisesAsTasks(ctx, board, "form-1", 1, []ReportPromise{{Text: "Fix benches", DueAt: due.Format(time.RFC3339), AnswersFor: "clerk"}})
	if _, err := RecordPromiseOutcome(ctx, board, made[0].ID, PromiseKept, "early", due.Add(-time.Second)); !errors.Is(err, ErrPromiseNotDue) {
		t.Fatalf("before the due date: %v", err)
	}
	if _, err := RecordPromiseOutcome(ctx, board, made[0].ID, PromiseKept, "on time", due); err != nil {
		t.Fatalf("on the due date: %v", err)
	}
	if _, err := RecordPromiseOutcome(ctx, board, made[0].ID, PromiseNotKept, "overwrite", due.Add(time.Hour)); !errors.Is(err, ErrPromiseOutcomeRecorded) {
		t.Fatalf("second record: %v", err)
	}
	got, _ := board.GetTask(ctx, made[0].ID)
	if link, _ := PromiseOf(got); link.Outcome != PromiseKept || link.OutcomeNote != "on time" {
		t.Fatalf("first record changed: %+v", link)
	}
}
