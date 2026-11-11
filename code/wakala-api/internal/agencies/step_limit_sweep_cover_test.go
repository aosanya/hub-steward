package agencies

import (
	"context"
	"errors"
	"testing"
	"time"

	agencymodels "wakalaserver/modules/agency/models"
	mwanachamataskmanager "wakalaserver/modules/taskmanager"
)

type fakeRegistry struct {
	Registry
	instances    []Instance
	listErr      error
	boards       map[string]*fakeBoard
	boardErr     map[string]error
	askedBoardOf []string
}

func (r *fakeRegistry) ListInstances(context.Context) ([]Instance, error) {
	return r.instances, r.listErr
}

func (r *fakeRegistry) TaskManager(_ context.Context, id string) (mwanachamataskmanager.TaskManager, error) {
	r.askedBoardOf = append(r.askedBoardOf, id)
	if err := r.boardErr[id]; err != nil {
		return nil, err
	}
	return r.boards[id], nil
}

func approved(id string) Instance { return Instance{ID: id, Approval: ApprovalApproved} }
func awaiting(id string) Instance { return Instance{ID: id, Approval: ApprovalPending} }

func TestSweepClosesRunsOnlyInApprovedAgenciesAndNamesTheFailures(t *testing.T) {
	ok := newFakeBoard()
	ok.closed = []mwanachamataskmanager.WorkflowRun{{ID: "r1"}, {ID: "r2"}}
	broken := newFakeBoard()
	broken.closed = []mwanachamataskmanager.WorkflowRun{{ID: "r3"}}
	broken.closeErr = errors.New("closing failed")
	reg := &fakeRegistry{
		instances: []Instance{approved("a"), awaiting("p"), approved("b"), approved("c")},
		boards:    map[string]*fakeBoard{"a": ok, "b": broken},
		boardErr:  map[string]error{"c": errors.New("no board")},
	}
	now := time.Date(2026, 11, 10, 14, 30, 0, 0, time.FixedZone("EAT", 3*3600))
	report, err := SweepStepLimits(context.Background(), reg, now, nil)
	if err != nil {
		t.Fatal(err)
	}
	if report.Agencies != 3 || report.RunsClosed != 3 {
		t.Fatalf("report %+v", report)
	}
	if len(report.FailedAgencies) != 2 || report.FailedAgencies[0] != "b" || report.FailedAgencies[1] != "c" {
		t.Fatalf("failed agencies %v", report.FailedAgencies)
	}
	if ok.closeAsOf != "2026-11-10T11:30:00Z" {
		t.Fatalf("the cut-off must be sent in UTC, got %q", ok.closeAsOf)
	}
	for _, id := range reg.askedBoardOf {
		if id == "p" {
			t.Fatal("an agency that is not approved must not be touched")
		}
	}
}

func TestSweepReturnsTheListingErrorAndStopsWhenCancelled(t *testing.T) {
	boom := errors.New("listing failed")
	if _, err := SweepStepLimits(context.Background(), &fakeRegistry{listErr: boom}, time.Now(), nil); !errors.Is(err, boom) {
		t.Fatalf("got %v", err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	reg := &fakeRegistry{instances: []Instance{approved("a")}, boards: map[string]*fakeBoard{"a": newFakeBoard()}}
	report, err := SweepStepLimits(ctx, reg, time.Now(), nil)
	if !errors.Is(err, context.Canceled) || report.Agencies != 0 || len(reg.askedBoardOf) != 0 {
		t.Fatalf("report %+v err %v asked %v", report, err, reg.askedBoardOf)
	}
}

func TestStepLimitSweepRunsOnEachTickAndStopsOnCancel(t *testing.T) {
	board := newFakeBoard()
	reg := &fakeRegistry{instances: []Instance{approved("a")}, boards: map[string]*fakeBoard{"a": board}}
	ctx, cancel := context.WithCancel(context.Background())
	ticks := make(chan time.Time)
	done := make(chan struct{})
	go func() {
		RunStepLimitSweep(ctx, reg, ticks, func() time.Time { return time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC) }, nil)
		close(done)
	}()
	ticks <- time.Now()
	ticks <- time.Now()
	cancel()
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("the sweep must stop when its context ends")
	}
	if len(reg.askedBoardOf) < 1 || board.closeAsOf != "2026-01-02T03:04:05Z" {
		t.Fatalf("asked %v asOf %q", reg.askedBoardOf, board.closeAsOf)
	}
}

type fixedPublications struct {
	document agencymodels.AgencyDocument
	err      error
}

func (f fixedPublications) GetPublication(_ context.Context, version int) (agencymodels.AgencyPublication, error) {
	return agencymodels.AgencyPublication{Version: version, Document: f.document}, f.err
}

func limitedOver(board *fakeBoard, reader publicationReader, readerErr error) limitedBoard {
	return limitedBoard{
		TaskManager:  board,
		publications: func(context.Context) (publicationReader, error) { return reader, readerErr },
	}
}

func TestStepStartsWithThePublishedLimitInPlaceOfTheOneAsked(t *testing.T) {
	board := newFakeBoard()
	board.run = mwanachamataskmanager.WorkflowRun{WorkflowCode: "order", WorkflowVersion: 4}
	lb := limitedOver(board, fixedPublications{document: limitDocument()}, nil)
	if _, err := lb.BeginWorkflowRunStep(context.Background(), "run-1", "pack", 15, "other"); err != nil {
		t.Fatal(err)
	}
	if got := board.begun[0]; got.minutes != 90 || got.cancelCode != "cancel_order" || got.step != "pack" {
		t.Fatalf("got %+v", got)
	}
}

var errRunGone = errors.New("gone")

func TestStepIsRefusedWhenNothingPublishedSpeaksForIt(t *testing.T) {
	cases := map[string]struct {
		build func(*fakeBoard) limitedBoard
		step  string
		want  error
	}{
		"run unreadable": {func(b *fakeBoard) limitedBoard {
			b.runErr = errRunGone
			return limitedOver(b, fixedPublications{document: limitDocument()}, nil)
		}, "pack", errRunGone},
		"run of no published workflow": {func(b *fakeBoard) limitedBoard {
			b.run = mwanachamataskmanager.WorkflowRun{WorkflowCode: "order"}
			return limitedOver(b, fixedPublications{document: limitDocument()}, nil)
		}, "pack", mwanachamataskmanager.ErrStepNotInWorkflow},
		"no publication": {func(b *fakeBoard) limitedBoard {
			b.run = mwanachamataskmanager.WorkflowRun{WorkflowCode: "order", WorkflowVersion: 1}
			return limitedOver(b, fixedPublications{err: errors.New("missing")}, nil)
		}, "pack", mwanachamataskmanager.ErrWorkflowNotPublished},
		"workflow not in the publication": {func(b *fakeBoard) limitedBoard {
			b.run = mwanachamataskmanager.WorkflowRun{WorkflowCode: "gone", WorkflowVersion: 1}
			return limitedOver(b, fixedPublications{document: limitDocument()}, nil)
		}, "pack", mwanachamataskmanager.ErrWorkflowNotPublished},
		"step not in the workflow": {func(b *fakeBoard) limitedBoard {
			b.run = mwanachamataskmanager.WorkflowRun{WorkflowCode: "order", WorkflowVersion: 1}
			return limitedOver(b, fixedPublications{document: limitDocument()}, nil)
		}, "deliver", mwanachamataskmanager.ErrStepNotInWorkflow},
	}
	for name, c := range cases {
		board := newFakeBoard()
		lb := c.build(board)
		_, err := lb.BeginWorkflowRunStep(context.Background(), "run-1", c.step, 0, "")
		if !errors.Is(err, c.want) || len(board.begun) != 0 {
			t.Errorf("%s: err %v begun %v", name, err, board.begun)
		}
	}
}

func TestAStepPublishedWithNoMinutesRemovesTheAskedLimit(t *testing.T) {
	board := newFakeBoard()
	board.run = mwanachamataskmanager.WorkflowRun{WorkflowCode: "order", WorkflowVersion: 4, CurrentStepID: "pack"}
	lb := limitedOver(board, fixedPublications{document: limitDocument()}, nil)
	if _, err := lb.BeginWorkflowRunStep(context.Background(), "run-1", "ship", 30, "other"); err != nil {
		t.Fatal(err)
	}
	if got := board.begun[0]; got.minutes != 0 || got.cancelCode != "" {
		t.Fatalf("got %+v", got)
	}
}

func TestAStepOutOfOrderOrAskingForAnUnpublishedCancelWorkflowIsRefused(t *testing.T) {
	cases := map[string]struct {
		current, step, cancel string
		want                  error
	}{
		"a jump past the first step":      {"", "ship", "", mwanachamataskmanager.ErrStepOutOfOrder},
		"the same step again":             {"pack", "pack", "", mwanachamataskmanager.ErrStepOutOfOrder},
		"a cancel workflow not published": {"", "pack", "W-NOPE-777", mwanachamataskmanager.ErrWorkflowNotPublished},
	}
	for name, c := range cases {
		board := newFakeBoard()
		board.run = mwanachamataskmanager.WorkflowRun{WorkflowCode: "order", WorkflowVersion: 4, CurrentStepID: c.current}
		lb := limitedOver(board, fixedPublications{document: limitDocument()}, nil)
		if _, err := lb.BeginWorkflowRunStep(context.Background(), "run-1", c.step, 5, c.cancel); !errors.Is(err, c.want) || len(board.begun) != 0 {
			t.Errorf("%s: err %v begun %v", name, err, board.begun)
		}
	}
}

func TestATrustedStepMayBeginOutOfOrderButStillMustBelongToTheWorkflow(t *testing.T) {
	board := newFakeBoard()
	board.run = mwanachamataskmanager.WorkflowRun{WorkflowCode: "order", WorkflowVersion: 4}
	lb := limitedOver(board, fixedPublications{document: limitDocument()}, nil)
	ctx := withTrustedStep(context.Background())
	if _, err := lb.BeginWorkflowRunStep(ctx, "run-1", "ship", 0, ""); err != nil {
		t.Fatalf("a trusted step out of order: %v", err)
	}
	if _, err := lb.BeginWorkflowRunStep(ctx, "run-1", "deliver", 0, ""); !errors.Is(err, mwanachamataskmanager.ErrStepNotInWorkflow) {
		t.Fatalf("a trusted step of no workflow: %v", err)
	}
}

func TestARunOfAPublishedWorkflowAndVersionStarts(t *testing.T) {
	board := newFakeBoard()
	lb := limitedOver(board, fixedPublications{document: limitDocument()}, nil)
	if _, err := lb.StartWorkflowRun(context.Background(), "n", "order", 4, "", ""); err != nil || len(board.started) != 1 || board.started[0] != "order" {
		t.Fatalf("err %v started %v", err, board.started)
	}
}

func TestARunIsRefusedForAWorkflowOrVersionThatIsNotPublished(t *testing.T) {
	cases := map[string]struct {
		reader fixedPublications
		code   string
	}{
		"no such workflow":    {fixedPublications{document: limitDocument()}, "W-999"},
		"no such publication": {fixedPublications{err: errors.New("missing")}, "order"},
	}
	for name, c := range cases {
		board := newFakeBoard()
		lb := limitedOver(board, c.reader, nil)
		if _, err := lb.StartWorkflowRun(context.Background(), "n", c.code, 99, "", ""); !errors.Is(err, mwanachamataskmanager.ErrWorkflowNotPublished) {
			t.Errorf("%s: %v", name, err)
		}
	}
}

func TestCompletingATaskAnswersItsRunsWaitingStep(t *testing.T) {
	board := newFakeBoard()
	board.tasks["t1"] = mwanachamataskmanager.Task{ID: "t1", WorkflowRunID: "run-7"}
	board.tasks["t2"] = mwanachamataskmanager.Task{ID: "t2"}
	lb := limitedOver(board, nil, nil)
	ctx := context.Background()

	if _, err := lb.MoveTaskToState(ctx, "t1", "doing"); err != nil || len(board.answered) != 0 {
		t.Fatalf("a task not completed answers nothing: %v %v", err, board.answered)
	}
	if _, err := lb.MoveTaskToState(ctx, "t2", "done"); err != nil || len(board.answered) != 0 {
		t.Fatalf("a task of no run answers nothing: %v %v", err, board.answered)
	}
	if _, err := lb.MoveTaskToState(ctx, "t1", "done"); err != nil || len(board.answered) != 1 || board.answered[0] != "run-7" {
		t.Fatalf("answered %v err %v", board.answered, err)
	}
	finished := board.tasks["t1"]
	finished.Status = mwanachamataskmanager.TaskStatusCompleted
	if _, err := lb.UpdateTask(ctx, finished); err != nil || len(board.answered) != 2 {
		t.Fatalf("an update that completes the task must answer too: %v %v", err, board.answered)
	}
}

func TestAFailedAnswerDoesNotFailTheMove(t *testing.T) {
	board := newFakeBoard()
	board.answerErr = errors.New("answer failed")
	board.tasks["t1"] = mwanachamataskmanager.Task{ID: "t1", WorkflowRunID: "run-7"}
	lb := limitedOver(board, nil, nil)
	if _, err := lb.MoveTaskToState(context.Background(), "t1", "done"); err != nil {
		t.Fatalf("the move itself succeeded, got %v", err)
	}
}

func TestAMoveThatFailsAnswersNothing(t *testing.T) {
	board := newFakeBoard()
	lb := limitedOver(board, nil, nil)
	if _, err := lb.MoveTaskToState(context.Background(), "ghost", "done"); err == nil || len(board.answered) != 0 {
		t.Fatalf("err %v answered %v", err, board.answered)
	}
}
