package agencies

import (
	"bytes"
	"context"
	"errors"
	"log/slog"
	"strings"
	"testing"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
	mwanachamamarket "wakalaserver/modules/market"
	mwanachamataskmanager "wakalaserver/modules/taskmanager"
)

type startedRun struct {
	name, workflowCode, trigger, initiator string
	version                                int
}

type askBoard struct {
	*fakeBoard
	starts    []startedRun
	byName    map[string]mwanachamataskmanager.WorkflowRun
	lookupErr error
	startErr  error
}

func (b *askBoard) StartWorkflowRun(_ context.Context, name, workflowCode string, version int, trigger, initiator string) (mwanachamataskmanager.WorkflowRun, error) {
	if b.startErr != nil {
		return mwanachamataskmanager.WorkflowRun{}, b.startErr
	}
	b.starts = append(b.starts, startedRun{name, workflowCode, trigger, initiator, version})
	return mwanachamataskmanager.WorkflowRun{ID: "run-" + name, Name: name}, nil
}

func (b *askBoard) GetWorkflowRunByName(_ context.Context, name string) (mwanachamataskmanager.WorkflowRun, error) {
	if b.lookupErr != nil {
		return mwanachamataskmanager.WorkflowRun{}, b.lookupErr
	}
	run, ok := b.byName[name]
	if !ok {
		return mwanachamataskmanager.WorkflowRun{}, mwanachamataskmanager.ErrWorkflowRunNotFound
	}
	return run, nil
}

type askAgency struct {
	mwanachamaagency.AgencyManager
	publication agencymodels.AgencyPublication
	err         error
}

func (a askAgency) GetPublicationForChannel(context.Context, string) (agencymodels.AgencyPublication, error) {
	return a.publication, a.err
}

type askRegistry struct {
	Registry
	agency    askAgency
	agencyErr error
	board     *askBoard
	boardErr  error
}

func (r askRegistry) AgencyManager(context.Context, string) (mwanachamaagency.AgencyManager, error) {
	if r.agencyErr != nil {
		return nil, r.agencyErr
	}
	return r.agency, nil
}

func (r askRegistry) TaskManager(context.Context, string) (mwanachamataskmanager.TaskManager, error) {
	if r.boardErr != nil {
		return nil, r.boardErr
	}
	return r.board, nil
}

func (r askRegistry) MarketManager(context.Context, string, string) (mwanachamamarket.MarketManager, error) {
	return nil, errors.New("market unavailable")
}

func newAskBoard() *askBoard {
	return &askBoard{fakeBoard: newFakeBoard(), byName: map[string]mwanachamataskmanager.WorkflowRun{}}
}

func timedYesNoDocument() agencymodels.AgencyDocument {
	return agencymodels.AgencyDocument{
		Workflows: []agencymodels.DocumentWorkflow{{ID: "w1", Code: "W-1", Ordinality: 1}},
		WorkItems: []agencymodels.DocumentWorkItem{{
			ID: "s1", Code: "WI-1", WorkflowID: "w1", Ordinality: 1,
			Kind: agencymodels.StepKindYesNo, TimeLimitMinutes: 30, CancelWorkflowID: "w2",
		}},
	}
}

func askRegistryWith(doc agencymodels.AgencyDocument, board *askBoard) askRegistry {
	return askRegistry{
		agency: askAgency{publication: agencymodels.AgencyPublication{Version: 4, Document: doc}},
		board:  board,
	}
}

func TestStartAskRunStartsTheWorkflowNamedAfterTheAskAndBeginsItsTimedStep(t *testing.T) {
	board := newAskBoard()
	reg := askRegistryWith(timedYesNoDocument(), board)
	err := StartAskRun(context.Background(), reg, "inst", mwanachamamarket.Ask{ID: "a9", Picker: "picker-1"})
	if err != nil {
		t.Fatal(err)
	}
	if len(board.starts) != 1 {
		t.Fatalf("starts: %+v", board.starts)
	}
	got := board.starts[0]
	want := startedRun{name: "ask-a9", workflowCode: "W-1", trigger: AskRunTrigger("a9"), initiator: "picker-1", version: 4}
	if got != want {
		t.Fatalf("got %+v, want %+v", got, want)
	}
	if len(board.begun) != 1 || board.begun[0].runID != "run-ask-a9" || board.begun[0].step != "WI-1" || board.begun[0].minutes != 0 {
		t.Fatalf("begun: %+v", board.begun)
	}
}

func TestStartAskRunDoesNothingWithoutAProductionPublication(t *testing.T) {
	board := newAskBoard()
	reg := askRegistryWith(timedYesNoDocument(), board)
	reg.agency.err = mwanachamaagency.ErrPublicationNotFound
	if err := StartAskRun(context.Background(), reg, "inst", mwanachamamarket.Ask{ID: "a1", Picker: "p"}); err != nil {
		t.Fatalf("a missing publication is not a failure: %v", err)
	}
	if len(board.starts) != 0 {
		t.Fatalf("started %+v", board.starts)
	}
}

func TestStartAskRunDoesNothingWhenNoStepIsATimedYesNoWithACancelRoute(t *testing.T) {
	board := newAskBoard()
	doc := timedYesNoDocument()
	doc.WorkItems[0].CancelWorkflowID = ""
	err := StartAskRun(context.Background(), askRegistryWith(doc, board), "inst", mwanachamamarket.Ask{ID: "a1", Picker: "p"})
	if err != nil || len(board.starts) != 0 || len(board.begun) != 0 {
		t.Fatalf("err=%v starts=%+v begun=%+v", err, board.starts, board.begun)
	}
}

func TestStartAskRunPassesEachUpstreamFailureBack(t *testing.T) {
	boom := errors.New("boom")
	ask := mwanachamamarket.Ask{ID: "a1", Picker: "p"}
	cases := map[string]func(*askRegistry){
		"agency manager unavailable": func(r *askRegistry) { r.agencyErr = boom },
		"publication read fails":     func(r *askRegistry) { r.agency.err = boom },
		"task board unavailable":     func(r *askRegistry) { r.boardErr = boom },
		"run cannot be started":      func(r *askRegistry) { r.board.startErr = boom },
	}
	for name, break_ := range cases {
		t.Run(name, func(t *testing.T) {
			reg := askRegistryWith(timedYesNoDocument(), newAskBoard())
			break_(&reg)
			if err := StartAskRun(context.Background(), reg, "inst", ask); !errors.Is(err, boom) {
				t.Fatalf("got %v", err)
			}
			if len(reg.board.begun) != 0 {
				t.Fatalf("a failed start must not begin a step: %+v", reg.board.begun)
			}
		})
	}
}

func TestClearAskRunAnswersTheRunOfThatAsk(t *testing.T) {
	board := newAskBoard()
	board.byName["ask-a9"] = mwanachamataskmanager.WorkflowRun{ID: "run-9"}
	board.byName["ask-a8"] = mwanachamataskmanager.WorkflowRun{ID: "run-8"}
	if err := ClearAskRun(context.Background(), askRegistry{board: board}, "inst", "a9"); err != nil {
		t.Fatal(err)
	}
	if len(board.answered) != 1 || board.answered[0] != "run-9" {
		t.Fatalf("answered %v", board.answered)
	}
}

func TestClearAskRunIsQuietWhenTheAskNeverHadARun(t *testing.T) {
	board := newAskBoard()
	if err := ClearAskRun(context.Background(), askRegistry{board: board}, "inst", "none"); err != nil {
		t.Fatalf("got %v", err)
	}
	if len(board.answered) != 0 {
		t.Fatalf("answered %v", board.answered)
	}
}

func TestClearAskRunPassesLookupAnswerAndBoardFailuresBack(t *testing.T) {
	boom := errors.New("boom")
	lookup := newAskBoard()
	lookup.lookupErr = boom
	if err := ClearAskRun(context.Background(), askRegistry{board: lookup}, "inst", "a1"); !errors.Is(err, boom) {
		t.Fatalf("lookup: %v", err)
	}
	answer := newAskBoard()
	answer.byName["ask-a1"] = mwanachamataskmanager.WorkflowRun{ID: "r"}
	answer.answerErr = boom
	if err := ClearAskRun(context.Background(), askRegistry{board: answer}, "inst", "a1"); !errors.Is(err, boom) {
		t.Fatalf("answer: %v", err)
	}
	if err := ClearAskRun(context.Background(), askRegistry{boardErr: boom}, "inst", "a1"); !errors.Is(err, boom) {
		t.Fatalf("board: %v", err)
	}
}

func TestAskRunNameIsThePrefixedAskID(t *testing.T) {
	if got := askRunName("a7"); got != "ask-a7" {
		t.Fatalf("got %q", got)
	}
}

func TestTellClosedAsksSkipsRunsThatAreNotAsksAndLogsOnlyTheOnesItCouldNotTell(t *testing.T) {
	var out bytes.Buffer
	logger := slog.New(slog.NewTextHandler(&out, nil))
	closed := []mwanachamataskmanager.WorkflowRun{
		{ID: "plain", TriggerEvent: "next.requested", Initiator: "p"},
		{ID: "ask-run", TriggerEvent: AskRunTrigger("a5"), Initiator: "picker-5"},
	}
	tellClosedAsks(context.Background(), askRegistry{}, "inst", closed, nil, logger)
	logged := out.String()
	if strings.Contains(logged, "plain") {
		t.Fatalf("a run that is not an ask must be skipped silently: %s", logged)
	}
	for _, part := range []string{"run=ask-run", "ask=a5", "market unavailable"} {
		if !strings.Contains(logged, part) {
			t.Fatalf("log lacks %q: %s", part, logged)
		}
	}
}

func TestTellClosedAsksWithoutALoggerStillSurvivesAFailure(t *testing.T) {
	closed := []mwanachamataskmanager.WorkflowRun{{ID: "r", TriggerEvent: AskRunTrigger("a5"), Initiator: "p"}}
	tellClosedAsks(context.Background(), askRegistry{}, "inst", closed, nil, nil)
}
