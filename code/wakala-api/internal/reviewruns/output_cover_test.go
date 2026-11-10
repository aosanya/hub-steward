package reviewruns

import (
	"strings"
	"testing"
)

func parse(t *testing.T, text string, previous ...PreviousFinding) (AreaResult, error) {
	t.Helper()
	return ParseAreaResult(text, previous)
}

func refuses(t *testing.T, text string, previous []PreviousFinding, want string) {
	t.Helper()
	_, err := ParseAreaResult(text, previous)
	if err == nil {
		t.Fatalf("answer was accepted, want a refusal containing %q", want)
	}
	if !strings.Contains(err.Error(), want) {
		t.Errorf("err = %q, want it to contain %q", err, want)
	}
}

func TestParseAreaResultKeepsATrimmedSummaryAndFindings(t *testing.T) {
	r, err := parse(t, `intro {"summary":"  ok  ","findings":[{"title":" A ","detail":" d ","fate":"new","tool":"goal_add","arguments":{"n":1}}]} outro`)
	if err != nil {
		t.Fatal(err)
	}
	if r.Summary != "ok" || len(r.Findings) != 1 {
		t.Fatalf("r = %+v", r)
	}
	f := r.Findings[0]
	if f.Title != "A" || f.Detail != "d" || f.Tool != "goal_add" || f.Arguments["n"] != float64(1) {
		t.Errorf("f = %+v", f)
	}
}

func TestParseAreaResultRefusesAnswersThatBreakTheFormat(t *testing.T) {
	refuses(t, "plain words", nil, "not JSON")
	refuses(t, `{"summary":1}`, nil, "summary should be string")
	refuses(t, `{"summary":"x","findings":[}`, nil, "format")
	refuses(t, `{"summary":"  "}`, nil, "no summary")
	refuses(t, `{"summary":"s","findings":[{"title":" ","detail":"d","fate":"new"}]}`, nil, "Finding 1 has no title")
	refuses(t, `{"summary":"s","findings":[{"title":"T","detail":"","fate":"new"}]}`, nil, "has no detail")
	refuses(t, `{"summary":"s","findings":[{"title":"T","detail":"d","fate":"maybe"}]}`, nil, `fate "maybe"`)
}

func TestParseAreaResultChecksTheLinkToEarlierFindings(t *testing.T) {
	prev := []PreviousFinding{{ID: "p1", Title: "Old"}}
	refuses(t, `{"summary":"s","findings":[{"title":"T","detail":"d","fate":"new","carried_from_id":"p1"}]}`, prev, "names the earlier finding")
	refuses(t, `{"summary":"s","findings":[{"title":"T","detail":"d","fate":"new","reopen":true}]}`, nil, "nothing to reopen")
	refuses(t, `{"summary":"s","findings":[{"title":"T","detail":"d","fate":"fixed","fate_reason":"r"}]}`, prev, "does not name the earlier finding")
	refuses(t, `{"summary":"s","findings":[{"title":"T","detail":"d","fate":"fixed","carried_from_id":"zz","fate_reason":"r"}]}`, prev, "not one of the earlier findings")
	refuses(t, `{"summary":"s","findings":[{"title":"T","detail":"d","fate":"fixed","carried_from_id":"p1"}]}`, prev, "gives no reason")
	refuses(t, `{"summary":"s","findings":[{"title":"T","detail":"d","fate":"fixed","carried_from_id":"p1","fate_reason":"r","reopen":true}]}`, prev, "not still_open")
	refuses(t, `{"summary":"s","findings":[{"title":"T","detail":"d","fate":"fixed","carried_from_id":"p1","fate_reason":"r"},{"title":"U","detail":"d","fate":"withdrawn","carried_from_id":"p1","fate_reason":"r"}]}`, prev, "answered more than once")
	refuses(t, `{"summary":"s","findings":[]}`, prev, "gives no fate to the earlier finding")
}

func TestParseAreaResultAcceptsReopeningAStillOpenFinding(t *testing.T) {
	prev := []PreviousFinding{{ID: "p1", Title: "Old"}}
	r, err := parse(t, `{"summary":"s","findings":[{"title":"Old","detail":"d","fate":"still_open","carried_from_id":"p1","fate_reason":"still true","reopen":true}]}`, prev...)
	if err != nil {
		t.Fatal(err)
	}
	f := r.Findings[0]
	if !f.Reopen || f.CarriedFromID != "p1" || f.FateReason != "still true" {
		t.Errorf("f = %+v", f)
	}
}

func TestParseAreaResultChecksToolsAndFollowUpSteps(t *testing.T) {
	refuses(t, `{"summary":"s","findings":[{"title":"T","detail":"d","fate":"new","arguments":{"a":1}}]}`, nil, "no tool")
	refuses(t, `{"summary":"s","findings":[{"title":"T","detail":"d","fate":"new","then":[{"tool":"x","arguments":{}}]}]}`, nil, "no tool")
	refuses(t, `{"summary":"s","findings":[{"title":"T","detail":"d","fate":"new","tool":"Bad Name"}]}`, nil, "not a tool name")
	refuses(t, `{"summary":"s","findings":[{"title":"T","detail":"d","fate":"new","tool":"ok","then":[{"tool":"Bad"}]}]}`, nil, "then step")
	refuses(t, `{"summary":"s","findings":[{"title":"T","detail":"d","fate":"new","tool":"ok","then":{"tool":"x"}}]}`, nil, "not a list of steps")
	refuses(t, `{"summary":"s","findings":[{"title":"T","detail":"d","fate":"new","tool":"ok","then":"{oops"}]}`, nil, "not a list of steps")
}

func TestParseAreaResultReadsThenGivenAsAnArrayOrAsQuotedJSON(t *testing.T) {
	for name, then := range map[string]string{
		"array":  `[{"tool":"b_tool"}]`,
		"quoted": `"[{\"tool\":\"b_tool\"}]"`,
	} {
		r, err := parse(t, `{"summary":"s","findings":[{"title":"T","detail":"d","fate":"new","tool":"a_tool","then":`+then+`}]}`)
		if err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		if got := r.Findings[0].Then; got != `[{"tool":"b_tool","arguments":{}}]` {
			t.Errorf("%s: then = %s", name, got)
		}
	}
}

func TestParseAreaResultTreatsEmptyThenAsNoSteps(t *testing.T) {
	for _, then := range []string{`null`, `""`, `[]`} {
		r, err := parse(t, `{"summary":"s","findings":[{"title":"T","detail":"d","fate":"new","tool":"a_tool","then":`+then+`}]}`)
		if err != nil {
			t.Fatalf("then %s: %v", then, err)
		}
		if r.Findings[0].Then != "" {
			t.Errorf("then %s kept as %q", then, r.Findings[0].Then)
		}
	}
}

func TestParseAreaResultGivesAToolWithoutArgumentsEmptyArguments(t *testing.T) {
	r, err := parse(t, `{"summary":"s","findings":[{"title":"T","detail":"d","fate":"new","tool":"a_tool"},{"title":"U","detail":"d","fate":"new"}]}`)
	if err != nil {
		t.Fatal(err)
	}
	if r.Findings[0].Arguments == nil || len(r.Findings[0].Arguments) != 0 {
		t.Errorf("tool finding arguments = %v, want empty non-nil", r.Findings[0].Arguments)
	}
	if r.Findings[1].Arguments != nil {
		t.Errorf("plain finding arguments = %v, want nil", r.Findings[1].Arguments)
	}
}

func TestParseAreaResultDropsNewFindingsThatRepeatATitle(t *testing.T) {
	prev := []PreviousFinding{{ID: "p1", Title: "Old"}}
	r, err := parse(t, `{"summary":"s","findings":[
		{"title":"Same  Thing","detail":"d","fate":"new"},
		{"title":"same thing","detail":"again","fate":"new"},
		{"title":"Old","detail":"d","fate":"still_open","carried_from_id":"p1","fate_reason":"r"},
		{"title":"OLD","detail":"d","fate":"new"}]}`, prev...)
	if err != nil {
		t.Fatal(err)
	}
	if len(r.Findings) != 2 {
		t.Fatalf("kept %d findings: %+v", len(r.Findings), r.Findings)
	}
	if r.Findings[0].Detail != "d" || r.Findings[1].Fate != FateStillOpen {
		t.Errorf("kept the wrong ones: %+v", r.Findings)
	}
}
