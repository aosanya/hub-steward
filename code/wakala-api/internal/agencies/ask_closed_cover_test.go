package agencies

import (
	"context"
	"errors"
	"reflect"
	"testing"

	"wakalaserver/internal/notifyrules"
	mwanachamamarket "wakalaserver/modules/market"
	mwanachamataskmanager "wakalaserver/modules/taskmanager"
)

func TestAskRunTriggerNamesTheAskAndAskOfRunReadsItBack(t *testing.T) {
	run := mwanachamataskmanager.WorkflowRun{TriggerEvent: AskRunTrigger("ask-9"), Initiator: "picker-1"}
	askID, picker, ok := askOfRun(run)
	if !ok || askID != "ask-9" || picker != "picker-1" {
		t.Fatalf("got %q %q %v", askID, picker, ok)
	}
}

func TestAskOfRunIgnoresRunsThatAreNotAnAsksOrNameNobody(t *testing.T) {
	for name, run := range map[string]mwanachamataskmanager.WorkflowRun{
		"other trigger": {TriggerEvent: "next.requested", Initiator: "p"},
		"no ask id":     {TriggerEvent: AskRunTrigger(""), Initiator: "p"},
		"no initiator":  {TriggerEvent: AskRunTrigger("a1")},
		"empty":         {},
	} {
		if _, _, ok := askOfRun(run); ok {
			t.Errorf("%s must not read as an ask", name)
		}
	}
}

func TestAskLinePrefersTheKindThenTheProduct(t *testing.T) {
	cases := []struct {
		ask  mwanachamamarket.Ask
		want string
	}{
		{mwanachamamarket.Ask{Kind: "delivery", Product: "maize"}, "a delivery"},
		{mwanachamamarket.Ask{Product: "maize"}, "maize"},
		{mwanachamamarket.Ask{}, "a request"},
	}
	for _, c := range cases {
		if got := askLine(c.ask); got != c.want {
			t.Errorf("%+v: got %q, want %q", c.ask, got, c.want)
		}
	}
}

func TestAskClosedToldTheAskersByDefault(t *testing.T) {
	got := askClosedAudience(context.Background(), "inst", "picker-1", nil)
	if !reflect.DeepEqual(got, []string{"picker-1"}) {
		t.Fatalf("got %v", got)
	}
}

func TestAskClosedUsesTheStoredRuleAndFallsBackToTheDefaultWhenItFailsToLoad(t *testing.T) {
	nobody := func(context.Context, string, notifyrules.Event) (notifyrules.Rule, error) {
		return notifyrules.Rule{Event: notifyrules.AskClosed, Told: []notifyrules.Audience{notifyrules.Owners}}, nil
	}
	if got := askClosedAudience(context.Background(), "inst", "picker-1", nobody); len(got) != 0 {
		t.Fatalf("a stored rule that tells owners only reaches nobody here, got %v", got)
	}
	failing := func(context.Context, string, notifyrules.Event) (notifyrules.Rule, error) {
		return notifyrules.Rule{}, errors.New("rules down")
	}
	if got := askClosedAudience(context.Background(), "inst", "picker-1", failing); !reflect.DeepEqual(got, []string{"picker-1"}) {
		t.Fatalf("got %v", got)
	}
}

func TestClosedRunsOfOtherWorkTellNobodyAndTouchNoRegistry(t *testing.T) {
	reg := &fakeRegistry{}
	closed := []mwanachamataskmanager.WorkflowRun{{ID: "r1", TriggerEvent: "next.requested"}, {ID: "r2"}}
	tellClosedAsks(context.Background(), reg, "inst", closed, nil, nil)
	if len(reg.askedBoardOf) != 0 {
		t.Fatalf("registry touched: %v", reg.askedBoardOf)
	}
}
