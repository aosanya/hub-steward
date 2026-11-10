package reviewruns

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"strings"
	"sync"
	"testing"
)

type fakeTools struct {
	mu          sync.Mutex
	recorded    []map[string]any
	recordErrs  []error
	inputErr    error
	previous    []PreviousFinding
	inputCalls  int
	started     Page
	startErr    error
	startedWith []string
	running     []Running
	runningErr  error
}

func (f *fakeTools) StartReview(_ context.Context, instanceID, draftID, startedBy, area string) (Page, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.startedWith = []string{instanceID, draftID, startedBy, area}
	return f.started, f.startErr
}

func (f *fakeTools) ReviewInput(context.Context, string, string, string) ([]PreviousFinding, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.inputCalls++
	return f.previous, f.inputErr
}

func (f *fakeTools) RecordArea(_ context.Context, _ string, args map[string]any) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.recorded = append(f.recorded, args)
	if len(f.recordErrs) > 0 {
		err := f.recordErrs[0]
		f.recordErrs = f.recordErrs[1:]
		return err
	}
	return nil
}

func (f *fakeTools) RunningReviews(context.Context) ([]Running, error) {
	return f.running, f.runningErr
}

func (f *fakeTools) byArea(area string) []map[string]any {
	f.mu.Lock()
	defer f.mu.Unlock()
	var out []map[string]any
	for _, r := range f.recorded {
		if r["area"] == area {
			out = append(out, r)
		}
	}
	return out
}

type stubReviewer struct {
	area   string
	result AreaResult
	err    error
	panics bool
	seen   chan AreaInput
	hold   chan struct{}
}

func (s *stubReviewer) Area() string { return s.area }

func (s *stubReviewer) Review(_ context.Context, in AreaInput) (AreaResult, error) {
	if s.seen != nil {
		s.seen <- in
	}
	if s.hold != nil {
		<-s.hold
	}
	if s.panics {
		panic("kaboom")
	}
	return s.result, s.err
}

func quiet() *slog.Logger { return slog.New(slog.NewTextHandler(io.Discard, nil)) }

func pageReading(areas ...string) Page {
	page := Page{Review: &Review{ID: "rv1", DraftID: "dr1", StartedBy: "amina"}}
	for _, a := range areas {
		page.Areas = append(page.Areas, Area{Area: a, Status: AreaReading})
	}
	return page
}

func rosterOf(reviewers ...Reviewer) ReviewerSource {
	roster := Roster{Reviewers: map[string]Reviewer{}, Unavailable: map[string]string{}}
	for _, r := range reviewers {
		roster.Reviewers[r.Area()] = r
	}
	return ReviewerSourceFunc(func(context.Context, string) (Roster, error) { return roster, nil })
}

func TestRunnerRecordsEachReadingAreaWithItsOwnFindings(t *testing.T) {
	tools := &fakeTools{previous: []PreviousFinding{{ID: "p1", Title: "Old"}}}
	seen := make(chan AreaInput, 4)
	goals := &stubReviewer{area: AreaGoals, result: AreaResult{Summary: "goals ok", Tokens: 9}, seen: seen}
	profile := &stubReviewer{area: AreaProfile, result: AreaResult{Summary: "profile ok", Tokens: 4}, seen: seen}
	NewRunner(tools, rosterOf(goals, profile), quiet()).Run(context.Background(), "ag1", pageReading(AreaGoals, AreaProfile))
	close(seen)
	for in := range seen {
		if in.ReviewID != "rv1" || in.DraftID != "dr1" || len(in.Previous) != 1 || in.Previous[0].ID != "p1" {
			t.Errorf("reviewer saw %+v", in)
		}
	}
	for area, summary := range map[string]string{AreaGoals: "goals ok", AreaProfile: "profile ok"} {
		got := tools.byArea(area)
		if len(got) != 1 || got[0]["status"] != "done" || got[0]["summary"] != summary {
			t.Errorf("%s recorded %v", area, got)
		}
	}
}

func TestRunnerDoesNothingForAPageWithNoReview(t *testing.T) {
	tools := &fakeTools{}
	r := NewRunner(tools, rosterOf(), nil)
	r.Run(context.Background(), "ag", Page{})
	r.Run(context.Background(), "ag", pageReading())
	if len(tools.recorded) != 0 || tools.inputCalls != 0 {
		t.Errorf("recorded %v", tools.recorded)
	}
}

func TestRunnerFailsEveryReadingAreaWhenNoRosterCanBeBuilt(t *testing.T) {
	tools := &fakeTools{}
	source := ReviewerSourceFunc(func(context.Context, string) (Roster, error) {
		return Roster{}, errors.New("review pieces: the server has no AI")
	})
	NewRunner(tools, source, quiet()).Run(context.Background(), "ag", pageReading(AreaGoals, AreaRisks))
	if len(tools.recorded) != 2 {
		t.Fatalf("recorded %d", len(tools.recorded))
	}
	for _, r := range tools.recorded {
		if r["status"] != "failed" || r["failure_reason"] != "The server has no AI." {
			t.Errorf("recorded %v", r)
		}
	}
}

func TestRunnerFailsAnAreaNoReviewerCoversAndSaysWhy(t *testing.T) {
	tools := &fakeTools{}
	source := ReviewerSourceFunc(func(context.Context, string) (Roster, error) {
		return Roster{Reviewers: map[string]Reviewer{}, Unavailable: map[string]string{AreaObjectives: objectivesNotApplicable}}, nil
	})
	NewRunner(tools, source, quiet()).Run(context.Background(), "ag", pageReading(AreaObjectives, AreaRisks))
	if got := tools.byArea(AreaObjectives); len(got) != 1 || got[0]["failure_reason"] != objectivesNotApplicable {
		t.Errorf("objectives %v", got)
	}
	if got := tools.byArea(AreaRisks); len(got) != 1 || got[0]["failure_reason"] != noReviewerSentence {
		t.Errorf("risks %v", got)
	}
}

func TestRunnerFailsAnAreaWhoseReviewerErrsOrPanics(t *testing.T) {
	tools := &fakeTools{}
	bad := &stubReviewer{area: AreaGoals, err: errors.New("review goals: model is down")}
	boom := &stubReviewer{area: AreaProfile, panics: true}
	NewRunner(tools, rosterOf(bad, boom), quiet()).Run(context.Background(), "ag", pageReading(AreaGoals, AreaProfile))
	if got := tools.byArea(AreaGoals); len(got) != 1 || got[0]["failure_reason"] != "Model is down." {
		t.Errorf("goals %v", got)
	}
	if got := tools.byArea(AreaProfile); len(got) != 1 || got[0]["failure_reason"] != panicReason {
		t.Errorf("profile %v", got)
	}
}

func TestRunnerFailsAnAreaWhosePreviousFindingsCannotBeRead(t *testing.T) {
	tools := &fakeTools{inputErr: errors.New("hub: input missing")}
	reviewer := &stubReviewer{area: AreaGoals, seen: make(chan AreaInput, 1)}
	NewRunner(tools, rosterOf(reviewer), quiet()).Run(context.Background(), "ag", pageReading(AreaGoals))
	if len(reviewer.seen) != 0 {
		t.Error("the reviewer ran without its earlier findings")
	}
	if got := tools.byArea(AreaGoals); len(got) != 1 || got[0]["status"] != "failed" || got[0]["failure_reason"] != "Input missing." {
		t.Errorf("recorded %v", got)
	}
}

func TestRunnerLeavesAnAreaReadingWhenTheServerIsStopping(t *testing.T) {
	tools := &fakeTools{}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	reviewer := &stubReviewer{area: AreaGoals, err: context.Canceled}
	NewRunner(tools, rosterOf(reviewer), quiet()).Run(ctx, "ag", pageReading(AreaGoals))
	if len(tools.recorded) != 0 {
		t.Errorf("recorded %v, the area must stay reading for the next start", tools.recorded)
	}
}

func TestRunnerAcceptsAnAreaRecordedElsewhereWithoutMarkingItFailed(t *testing.T) {
	tools := &fakeTools{recordErrs: []error{ErrAreaAlreadyRecorded}}
	reviewer := &stubReviewer{area: AreaGoals, result: AreaResult{Summary: "ok"}}
	NewRunner(tools, rosterOf(reviewer), quiet()).Run(context.Background(), "ag", pageReading(AreaGoals))
	if got := tools.byArea(AreaGoals); len(got) != 1 || got[0]["status"] != "done" {
		t.Errorf("recorded %v", got)
	}
}

func TestRunnerMarksAnAreaFailedWhenItsResultCannotBeSaved(t *testing.T) {
	tools := &fakeTools{recordErrs: []error{errors.New("store: disk full")}}
	reviewer := &stubReviewer{area: AreaGoals, result: AreaResult{Summary: "ok"}}
	NewRunner(tools, rosterOf(reviewer), quiet()).Run(context.Background(), "ag", pageReading(AreaGoals))
	got := tools.byArea(AreaGoals)
	if len(got) != 2 || got[0]["status"] != "done" || got[1]["status"] != "failed" || got[1]["failure_reason"] != "Disk full." {
		t.Errorf("recorded %v", got)
	}
}

func TestRunnerKeepsGoingWhenMarkingFailedAlsoFails(t *testing.T) {
	tools := &fakeTools{recordErrs: []error{errors.New("store down"), ErrAreaAlreadyRecorded}}
	bad := &stubReviewer{area: AreaGoals, err: errors.New("x")}
	profile := &stubReviewer{area: AreaProfile, err: errors.New("y")}
	NewRunner(tools, rosterOf(bad, profile), quiet()).Run(context.Background(), "ag", pageReading(AreaGoals, AreaProfile))
	if len(tools.recorded) != 2 {
		t.Errorf("recorded %d, want both areas attempted", len(tools.recorded))
	}
}

func TestRunnerCarriesTheStarterToTheRosterBuilder(t *testing.T) {
	tools := &fakeTools{}
	var starter string
	source := ReviewerSourceFunc(func(ctx context.Context, _ string) (Roster, error) {
		starter = StartedByFrom(ctx)
		return Roster{}, nil
	})
	NewRunner(tools, source, quiet()).Run(context.Background(), "ag", pageReading(AreaGoals))
	if starter != "amina" {
		t.Errorf("starter = %q", starter)
	}
}

func TestRunnerSkipsAnAreaAlreadyBeingReviewed(t *testing.T) {
	tools := &fakeTools{}
	hold := make(chan struct{})
	seen := make(chan AreaInput, 2)
	reviewer := &stubReviewer{area: AreaGoals, result: AreaResult{Summary: "ok"}, hold: hold, seen: seen}
	r := NewRunner(tools, rosterOf(reviewer), quiet())
	r.Launch(context.Background(), "ag", pageReading(AreaGoals))
	<-seen
	r.Run(context.Background(), "ag", pageReading(AreaGoals))
	close(hold)
	r.Wait()
	if len(seen) != 0 {
		t.Error("the same area was reviewed twice at once")
	}
	if got := tools.byArea(AreaGoals); len(got) != 1 {
		t.Errorf("recorded %d times", len(got))
	}
}

func TestStartedByRoundTripsAndIsEmptyWhenUnset(t *testing.T) {
	if got := StartedByFrom(context.Background()); got != "" {
		t.Errorf("unset = %q", got)
	}
	if got := StartedByFrom(WithStartedBy(context.Background(), "p9")); got != "p9" {
		t.Errorf("set = %q", got)
	}
}

func TestPageReadingNamesOnlyTheAreasStillBeingRead(t *testing.T) {
	page := Page{Areas: []Area{{Area: AreaGoals, Status: AreaReading}, {Area: AreaRisks, Status: AreaDone}, {Area: AreaTests, Status: AreaFailed}, {Area: AreaProfile, Status: AreaReading}}}
	if got := strings.Join(page.Reading(), ","); got != "goals,profile" {
		t.Errorf("reading = %q", got)
	}
}
