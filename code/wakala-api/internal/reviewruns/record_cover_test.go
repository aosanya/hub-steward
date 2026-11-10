package reviewruns

import (
	"errors"
	"fmt"
	"reflect"
	"testing"
)

func TestRecordArgsCarryEachFindingWithItsFollowUpSteps(t *testing.T) {
	in := AreaInput{ReviewID: "r1", Area: AreaGoals}
	result := AreaResult{Summary: "two gaps", Tokens: 42, Findings: []Finding{
		{Title: "A", Detail: "d", Tool: "goal_add", Arguments: map[string]any{"name": "x"}, Fate: FateNew,
			Then: `[{"tool":"goal_link","arguments":{"id":"1"}},{"tool":"goal_note","arguments":"{\"k\":\"v\"}"}]`},
		{Title: "B", Detail: "d2", Fate: FateFixed, FateReason: "done", CarriedFromID: "old"},
	}}
	args := RecordArgs(in, result)
	if args["status"] != "done" || args["failure_reason"] != "" || args["tokens"] != 42 || args["review_id"] != "r1" || args["area"] != AreaGoals {
		t.Fatalf("header wrong: %v", args)
	}
	findings := args["findings"].([]any)
	if len(findings) != 2 {
		t.Fatalf("findings = %d", len(findings))
	}
	first := findings[0].(map[string]any)
	want := []any{
		map[string]any{"tool": "goal_link", "arguments": map[string]any{"id": "1"}},
		map[string]any{"tool": "goal_note", "arguments": map[string]any{"k": "v"}},
	}
	if !reflect.DeepEqual(first["then"], want) {
		t.Errorf("then = %v, want %v", first["then"], want)
	}
	second := findings[1].(map[string]any)
	if !reflect.DeepEqual(second["arguments"], map[string]any{}) || !reflect.DeepEqual(second["then"], []any{}) {
		t.Errorf("a finding with no action must carry empty arguments and steps: %v", second)
	}
	if second["fate"] != FateFixed || second["carried_from_id"] != "old" || second["fate_reason"] != "done" {
		t.Errorf("fate lost: %v", second)
	}
}

func TestRecordArgsIgnoresAThenThatIsNotAList(t *testing.T) {
	args := RecordArgs(AreaInput{}, AreaResult{Findings: []Finding{{Title: "A", Then: "not json"}, {Title: "B", Then: "  "}}})
	for _, f := range args["findings"].([]any) {
		if !reflect.DeepEqual(f.(map[string]any)["then"], []any{}) {
			t.Errorf("then = %v, want empty", f.(map[string]any)["then"])
		}
	}
}

func TestObjectValueFallsBackToEmptyForUnusableArguments(t *testing.T) {
	for _, v := range []any{nil, 3, "not json", "null", []any{1}} {
		if got := objectValue(v); len(got) != 0 {
			t.Errorf("objectValue(%v) = %v, want empty", v, got)
		}
	}
}

func TestFailedArgsCarryTheReasonAndNoFindings(t *testing.T) {
	args := FailedArgs(AreaInput{ReviewID: "r2", Area: AreaRisks}, "why")
	if args["status"] != "failed" || args["failure_reason"] != "why" || args["tokens"] != 0 {
		t.Errorf("args = %v", args)
	}
	if len(args["findings"].([]any)) != 0 {
		t.Errorf("a failed area must record no findings")
	}
}

func TestReasonOfReadsTheInnermostCauseAsASentence(t *testing.T) {
	cases := []struct {
		name string
		err  error
		want string
	}{
		{"nil", nil, unknownReason},
		{"no default account", fmt.Errorf("wrap: %w", ErrNoDefaultAccount), ErrNoDefaultAccount.Error()},
		{"innermost lower case gets capital and stop", fmt.Errorf("outer: %w", errors.New("connection refused")), "Connection refused."},
		{"prefix stripped", errors.New("review profile: tools call: boom"), "Boom."},
		{"already stopped", errors.New("It broke!"), "It broke!"},
		{"question mark kept", errors.New("Why?"), "Why?"},
		{"blank", errors.New("   "), unknownReason},
	}
	for _, c := range cases {
		if got := ReasonOf(c.err); got != c.want {
			t.Errorf("%s: ReasonOf = %q, want %q", c.name, got, c.want)
		}
	}
}
