package launchlog

import (
	"fmt"
	"testing"
	"time"
)

func drain(ch <-chan Event) []Event {
	var got []Event
	for {
		select {
		case e, ok := <-ch:
			if !ok {
				return got
			}
			got = append(got, e)
		default:
			return got
		}
	}
}

func closed(ch <-chan Event) bool {
	for {
		select {
		case _, ok := <-ch:
			if !ok {
				return true
			}
		default:
			return false
		}
	}
}

func TestEventTerminalOnlyForReadyAndFailed(t *testing.T) {
	cases := map[string]bool{
		StateRunning: false,
		StateNaming:  false,
		StateReady:   true,
		StateFailed:  true,
		"":           false,
	}
	for state, want := range cases {
		if got := (Event{State: state}).Terminal(); got != want {
			t.Errorf("state %q: Terminal() = %v, want %v", state, got, want)
		}
	}
}

func TestAppendNumbersEventsFromOneAndStampsMissingTime(t *testing.T) {
	var j Journal
	fixed := time.Date(2026, 1, 2, 3, 4, 5, 0, time.UTC)
	j.Append("a", Event{Step: "first", State: StateRunning, Seq: 99})
	j.Append("a", Event{Step: "second", State: StateRunning, At: fixed})

	replay, _, stop := j.Watch("a")
	defer stop()
	if len(replay) != 2 {
		t.Fatalf("replay has %d events, want 2", len(replay))
	}
	if replay[0].Seq != 1 || replay[1].Seq != 2 {
		t.Errorf("seqs = %d,%d, want 1,2 (caller-supplied Seq must be ignored)", replay[0].Seq, replay[1].Seq)
	}
	if replay[0].At.IsZero() {
		t.Error("an event with no time must be stamped")
	}
	if !replay[1].At.Equal(fixed) {
		t.Errorf("an event with a time must keep it, got %v", replay[1].At)
	}
}

func TestAppendKeepsEachLaunchSeparate(t *testing.T) {
	var j Journal
	j.Append("a", Event{Step: "a1", State: StateRunning})
	j.Append("b", Event{Step: "b1", State: StateRunning})
	j.Append("a", Event{Step: "a2", State: StateRunning})

	ra, _, stopA := j.Watch("a")
	defer stopA()
	rb, _, stopB := j.Watch("b")
	defer stopB()
	if len(ra) != 2 || ra[0].Step != "a1" || ra[1].Step != "a2" {
		t.Errorf("launch a replay = %+v", ra)
	}
	if len(rb) != 1 || rb[0].Step != "b1" || rb[0].Seq != 1 {
		t.Errorf("launch b replay = %+v", rb)
	}
}

func TestAppendKeepsOnlyTheFirstMaxEventsPerLaunch(t *testing.T) {
	j := Journal{Max: 3}
	for i := 1; i <= 6; i++ {
		j.Append("run", Event{Step: fmt.Sprintf("s%d", i), State: StateRunning})
	}
	replay, _, stop := j.Watch("run")
	defer stop()
	if len(replay) != 3 {
		t.Fatalf("replay has %d events, want 3", len(replay))
	}
	for i, e := range replay {
		if want := fmt.Sprintf("s%d", i+1); e.Step != want {
			t.Errorf("event %d step = %q, want %q (the first events are the ones kept)", i, e.Step, want)
		}
	}
}

func TestAppendAfterTerminalEventIsDropped(t *testing.T) {
	var j Journal
	j.Append("run", Event{Step: "go", State: StateRunning})
	j.Append("run", Event{Step: "done", State: StateReady})
	j.Append("run", Event{Step: "late", State: StateRunning})

	replay, live, _ := j.Watch("run")
	if len(replay) != 2 || replay[1].Step != "done" {
		t.Errorf("replay = %+v, want the two events up to and including the terminal one", replay)
	}
	if !closed(live) {
		t.Error("watching a finished launch must give an already closed channel")
	}
}

func TestWatchReplaysThenStreamsLiveEvents(t *testing.T) {
	var j Journal
	j.Append("run", Event{Step: "one", State: StateRunning})
	replay, live, stop := j.Watch("run")
	defer stop()
	if len(replay) != 1 || replay[0].Step != "one" {
		t.Fatalf("replay = %+v", replay)
	}
	j.Append("run", Event{Step: "two", State: StateRunning})
	got := drain(live)
	if len(got) != 1 || got[0].Step != "two" || got[0].Seq != 2 {
		t.Errorf("live = %+v, want only the event appended after the watch", got)
	}
}

func TestTerminalEventDeliversThenClosesEveryWatcher(t *testing.T) {
	var j Journal
	_, l1, s1 := j.Watch("run")
	defer s1()
	_, l2, s2 := j.Watch("run")
	defer s2()
	j.Append("run", Event{Step: "fin", State: StateFailed})
	for i, l := range []<-chan Event{l1, l2} {
		got := drain(l)
		if len(got) != 1 || got[0].State != StateFailed {
			t.Errorf("watcher %d got %+v, want the failed event", i, got)
		}
		if !closed(l) {
			t.Errorf("watcher %d channel must be closed after a terminal event", i)
		}
	}
}

func TestNamingEventDoesNotEndTheLaunch(t *testing.T) {
	var j Journal
	_, live, stop := j.Watch("run")
	defer stop()
	j.Append("run", Event{Step: "ask", State: StateNaming, Options: []string{"Alpha", "Beta"}})
	got := drain(live)
	if len(got) != 1 || len(got[0].Options) != 2 {
		t.Fatalf("got %+v", got)
	}
	if closed(live) {
		t.Error("a naming event must leave the watcher open")
	}
	j.Append("run", Event{Step: "ok", State: StateReady})
	if !closed(live) {
		t.Error("the ready event must close the watcher")
	}
}

func TestSlowWatcherDoesNotBlockAppend(t *testing.T) {
	var j Journal
	_, live, stop := j.Watch("run")
	defer stop()
	total := watcherBuffer + 10
	finished := make(chan struct{})
	go func() {
		for i := 0; i < total; i++ {
			j.Append("run", Event{Step: "x", State: StateRunning})
		}
		close(finished)
	}()
	select {
	case <-finished:
	case <-time.After(2 * time.Second):
		t.Fatal("Append blocked on a watcher that is not reading")
	}
	if got := len(drain(live)); got != watcherBuffer {
		t.Errorf("buffered %d events, want %d (overflow is dropped)", got, watcherBuffer)
	}
}

func TestStopUnsubscribesAndIsSafeToCallTwice(t *testing.T) {
	var j Journal
	j.Append("run", Event{Step: "one", State: StateRunning})
	_, live, stop := j.Watch("run")
	stop()
	stop()
	if !closed(live) {
		t.Error("stop must close the channel")
	}
	j.Append("run", Event{Step: "two", State: StateRunning})
	replay, _, stop2 := j.Watch("run")
	defer stop2()
	if len(replay) != 2 {
		t.Errorf("the journal must keep recording after a watcher leaves, replay = %+v", replay)
	}
}

func TestWatchingAnUnknownLaunchThenLeavingForgetsIt(t *testing.T) {
	var j Journal
	replay, live, stop := j.Watch("ghost")
	if len(replay) != 0 {
		t.Errorf("replay = %+v, want empty", replay)
	}
	stop()
	if !closed(live) {
		t.Error("stop must close the channel")
	}
	if _, ok := j.streams["ghost"]; ok {
		t.Error("a launch nobody ever wrote to must not linger after its only watcher leaves")
	}
}

func TestWatchBeforeFirstAppendReceivesIt(t *testing.T) {
	var j Journal
	replay, live, stop := j.Watch("early")
	defer stop()
	j.Append("early", Event{Step: "hello", State: StateRunning})
	if len(replay) != 0 {
		t.Fatalf("replay = %+v", replay)
	}
	got := drain(live)
	if len(got) != 1 || got[0].Step != "hello" {
		t.Errorf("live = %+v", got)
	}
}

func TestOldestLaunchesAreEvictedPastKeepAndTheirWatchersClosed(t *testing.T) {
	j := Journal{Keep: 2}
	j.Append("one", Event{Step: "a", State: StateRunning})
	_, live, stop := j.Watch("one")
	defer stop()
	j.Append("two", Event{Step: "b", State: StateRunning})
	j.Append("three", Event{Step: "c", State: StateRunning})

	if !closed(live) {
		t.Error("watcher on the evicted launch must be closed")
	}
	replayOne, _, s1 := j.Watch("one")
	defer s1()
	if len(replayOne) != 0 {
		t.Errorf("evicted launch still replays %+v", replayOne)
	}
	replayTwo, _, s2 := j.Watch("two")
	defer s2()
	replayThree, _, s3 := j.Watch("three")
	defer s3()
	if len(replayTwo) != 1 || len(replayThree) != 1 {
		t.Errorf("recent launches must survive: two=%+v three=%+v", replayTwo, replayThree)
	}
}

func TestZeroValuePromptsAreUsable(t *testing.T) {
	var p Prompts
	if p.Waiting("x") {
		t.Error("nothing is waiting on a fresh Prompts")
	}
	if p.Answer("x", "y") {
		t.Error("an answer to nothing must be refused")
	}
}

func TestAskThenAnswerDeliversOnceAndRefusesTheSecond(t *testing.T) {
	var p Prompts
	answers, cancel := p.Ask("run")
	defer cancel()
	if !p.Waiting("run") {
		t.Fatal("run must be waiting after Ask")
	}
	if p.Waiting("other") {
		t.Error("another launch must not be waiting")
	}
	if !p.Answer("run", "Fresh Name") {
		t.Fatal("first answer must be accepted")
	}
	if p.Answer("run", "Second") {
		t.Error("a second answer while one is queued must be refused, not block")
	}
	if got := <-answers; got != "Fresh Name" {
		t.Errorf("answer = %q, want the first one", got)
	}
}

func TestCancelStopsWaitingAndRefusesLateAnswers(t *testing.T) {
	var p Prompts
	_, cancel := p.Ask("run")
	cancel()
	cancel()
	if p.Waiting("run") {
		t.Error("cancelled launch must not be waiting")
	}
	if p.Answer("run", "late") {
		t.Error("an answer after cancel must be refused")
	}
}

func TestSecondAskReplacesFirstAndClosesItsChannel(t *testing.T) {
	var p Prompts
	first, cancelFirst := p.Ask("run")
	second, cancelSecond := p.Ask("run")
	defer cancelSecond()

	if _, ok := <-first; ok {
		t.Error("the replaced question's channel must be closed")
	}
	cancelFirst()
	if !p.Waiting("run") {
		t.Error("cancelling the replaced question must not cancel the current one")
	}
	if !p.Answer("run", "yes") {
		t.Fatal("answer to the current question must be accepted")
	}
	if got := <-second; got != "yes" {
		t.Errorf("answer = %q", got)
	}
}
