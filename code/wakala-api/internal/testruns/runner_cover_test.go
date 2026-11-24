package testruns

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"testing"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
	"github.com/aosanya/mwanachama-backend-shared/dispatch"
)

func TestRunnerRefusesWithoutAFactory(t *testing.T) {
	r := NewRunner("agy1", nil)
	_, err := r.Run(context.Background(), mwanachamaagency.RunRequest{RunID: "r1"})
	if !errors.Is(err, ErrNoFactory) {
		t.Fatalf("err = %v, want ErrNoFactory", err)
	}
	_, err = r.RunReporting(context.Background(), mwanachamaagency.RunRequest{}, func(agencymodels.RunStep) bool { return true })
	if !errors.Is(err, ErrNoFactory) {
		t.Fatalf("RunReporting err = %v, want ErrNoFactory", err)
	}
}

func TestRunnerSurfacesAFactoryFailureAndPassesTheInstance(t *testing.T) {
	boom := errors.New("no ai account")
	var seen string
	r := NewRunner("agy42", func(_ context.Context, instanceID string, _ mwanachamaagency.RunRequest) (Agent, error) {
		seen = instanceID
		return Agent{}, boom
	})
	_, err := r.Run(context.Background(), mwanachamaagency.RunRequest{RunID: "r1"})
	if !errors.Is(err, boom) {
		t.Fatalf("err = %v, want the factory's error", err)
	}
	if seen != "agy42" {
		t.Fatalf("factory instance = %q, want agy42", seen)
	}
}

func TestRunnerStopsAScenarioWithNoSteps(t *testing.T) {
	r := NewRunner("agy1", func(context.Context, string, mwanachamaagency.RunRequest) (Agent, error) {
		return Agent{}, nil
	})
	out, err := r.Run(context.Background(), mwanachamaagency.RunRequest{RunID: "r1"})
	if err != nil {
		t.Fatal(err)
	}
	if out.Result != agencymodels.TestRunStopped || out.StopReason != noStepsReason {
		t.Fatalf("outcome = %q / %q, want stopped / %q", out.Result, out.StopReason, noStepsReason)
	}
	if len(out.Steps) != 0 {
		t.Fatalf("steps = %d, want none", len(out.Steps))
	}
}

func TestAgentReportsFailedWhenAnEarlierStepAlreadyFailed(t *testing.T) {
	req := mwanachamaagency.RunRequest{RunID: "r1", Done: []agencymodels.RunStep{{Step: "1", Failed: false}, {Step: "2", Failed: true}}}
	out, err := Agent{}.Run(context.Background(), req)
	if err != nil {
		t.Fatal(err)
	}
	if out.Result != agencymodels.TestRunFailed || out.StopReason != "" {
		t.Fatalf("outcome = %q / %q, want failed with no stop reason", out.Result, out.StopReason)
	}
}

func TestStopErrorNamesItsReasonAndIsFoundWhenWrapped(t *testing.T) {
	if got := ErrBudgetReached.Error(); got != "testruns: stopped: Budget reached" {
		t.Fatalf("message = %q", got)
	}
	wrapped := fmt.Errorf("while asking: %w", &StopError{Reason: "Out of time"})
	reason, ok := stopReason(wrapped)
	if !ok || reason != "Out of time" {
		t.Fatalf("stopReason = %q, %v, want Out of time, true", reason, ok)
	}
	if reason, ok := stopReason(errors.New("plain")); ok || reason != "" {
		t.Fatalf("a plain error must not read as a stop: %q, %v", reason, ok)
	}
	if _, ok := stopReason(nil); ok {
		t.Fatal("nil must not read as a stop")
	}
}

func TestGateAllowsOnlyTheListedActions(t *testing.T) {
	authorize := gate(map[string]bool{"forms.answer.submit": true, "forms.form.publish": false})
	if err := authorize(context.Background(), "forms.answer.submit"); err != nil {
		t.Fatalf("listed action refused: %v", err)
	}
	for _, action := range []string{"forms.form.publish", "comm.chat.post", ""} {
		if err := authorize(context.Background(), action); !errors.Is(err, dispatch.ErrForbidden) {
			t.Errorf("action %q: err = %v, want ErrForbidden", action, err)
		}
	}
}

func toolReturning(name string, out any, err error) dispatch.Tool {
	return dispatch.Tool{Name: name, Invoke: func(_ context.Context, raw json.RawMessage) (any, error) {
		if err != nil {
			return nil, err
		}
		return out, nil
	}}
}

func TestPlayToolAnswersWithTheToolsObjectAndOneTrailLine(t *testing.T) {
	tools := []dispatch.Tool{toolReturning("other", map[string]any{"x": 1}, nil), toolReturning("forms_answer_submit", map[string]any{"saved": true}, nil)}
	out, err := playTool(context.Background(), "forms", tools, Call{StepID: "s1", Endpoint: "forms_answer_submit", Args: map[string]any{"a": "b"}})
	if err != nil {
		t.Fatal(err)
	}
	if out.Answer["saved"] != true {
		t.Fatalf("answer = %v, want saved true", out.Answer)
	}
	if len(out.Trail) != 1 {
		t.Fatalf("trail lines = %d, want 1", len(out.Trail))
	}
	line := out.Trail[0]
	if line.StepID != "s1" || line.Module != "forms" || line.Endpoint != "forms_answer_submit" || line.Text != `{"saved":true}` {
		t.Fatalf("trail line = %+v", line)
	}
	if line.At.IsZero() {
		t.Fatal("trail line has no time")
	}
}

func TestPlayToolWrapsANonObjectResultUnderResult(t *testing.T) {
	tools := []dispatch.Tool{toolReturning("list", []string{"a", "b"}, nil)}
	out, err := playTool(context.Background(), "forms", tools, Call{Endpoint: "list"})
	if err != nil {
		t.Fatal(err)
	}
	raw, ok := out.Answer["result"].(json.RawMessage)
	if !ok || string(raw) != `["a","b"]` {
		t.Fatalf("answer = %v, want result holding the array", out.Answer)
	}
}

func TestPlayToolNamesTheModuleWhenTheToolRefuses(t *testing.T) {
	tools := []dispatch.Tool{toolReturning("post", nil, dispatch.ErrForbidden)}
	_, err := playTool(context.Background(), "comm", tools, Call{Endpoint: "post"})
	if !errors.Is(err, dispatch.ErrForbidden) {
		t.Fatalf("err = %v, want it to wrap ErrForbidden", err)
	}
	if want := "comm refused post: "; len(err.Error()) < len(want) || err.Error()[:len(want)] != want {
		t.Fatalf("err = %q, want it to start with %q", err, want)
	}
}

func TestPlayToolRefusesAnEndpointTheTestCopyDoesNotHave(t *testing.T) {
	_, err := playTool(context.Background(), "market", nil, Call{Endpoint: "market_nothing"})
	want := "market_nothing is not an endpoint of the market test copy"
	if err == nil || err.Error() != want {
		t.Fatalf("err = %v, want %q", err, want)
	}
}

func TestPlayToolRefusesArgumentsThatCannotBeEncoded(t *testing.T) {
	_, err := playTool(context.Background(), "forms", nil, Call{Endpoint: "x", Args: map[string]any{"bad": make(chan int)}})
	if err == nil {
		t.Fatal("want an error for an unencodable argument")
	}
}
