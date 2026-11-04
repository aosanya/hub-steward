package reviewruns

import (
	"bytes"
	"encoding/json"
	"fmt"
	"regexp"
	"slices"
	"strings"
)

var toolName = regexp.MustCompile(`^[a-z][a-z0-9_]*$`)

type rawStep struct {
	Tool      string         `json:"tool"`
	Arguments map[string]any `json:"arguments"`
}

type rawFinding struct {
	Title         string          `json:"title"`
	Detail        string          `json:"detail"`
	Tool          string          `json:"tool"`
	Arguments     map[string]any  `json:"arguments"`
	Then          json.RawMessage `json:"then"`
	Fate          string          `json:"fate"`
	FateReason    string          `json:"fate_reason"`
	CarriedFromID string          `json:"carried_from_id"`
	Reopen        bool            `json:"reopen"`
}

type rawResult struct {
	Summary  string       `json:"summary"`
	Findings []rawFinding `json:"findings"`
}

func ParseAreaResult(text string, previous []PreviousFinding) (AreaResult, error) {
	body, err := jsonObject(text)
	if err != nil {
		return AreaResult{}, err
	}
	var raw rawResult
	if err := json.Unmarshal(body, &raw); err != nil {
		return AreaResult{}, fmt.Errorf("The reviewer's answer does not follow the format: %s.", describeJSONError(err))
	}
	if strings.TrimSpace(raw.Summary) == "" {
		return AreaResult{}, fmt.Errorf("The reviewer's answer has no summary.")
	}
	known := map[string]bool{}
	for _, p := range previous {
		known[p.ID] = true
	}
	answered := map[string]bool{}
	out := AreaResult{Summary: strings.TrimSpace(raw.Summary), Findings: make([]Finding, 0, len(raw.Findings))}
	for i, r := range raw.Findings {
		f, err := checkFinding(i+1, r, known, answered)
		if err != nil {
			return AreaResult{}, err
		}
		out.Findings = append(out.Findings, f)
	}
	for _, p := range previous {
		if !answered[p.ID] {
			return AreaResult{}, fmt.Errorf("The reviewer's answer gives no fate to the earlier finding %q (%s).", p.Title, p.ID)
		}
	}
	out.Findings = withoutRepeats(out.Findings)
	return out, nil
}

func titleKey(title string) string {
	return strings.ToLower(strings.Join(strings.Fields(title), " "))
}

func withoutRepeats(findings []Finding) []Finding {
	carried := map[string]bool{}
	for _, f := range findings {
		if f.Fate != FateNew {
			carried[titleKey(f.Title)] = true
		}
	}
	seen := map[string]bool{}
	kept := make([]Finding, 0, len(findings))
	for _, f := range findings {
		key := titleKey(f.Title)
		if f.Fate == FateNew && (carried[key] || seen[key]) {
			continue
		}
		if f.Fate == FateNew {
			seen[key] = true
		}
		kept = append(kept, f)
	}
	return kept
}

func checkFinding(n int, r rawFinding, known, answered map[string]bool) (Finding, error) {
	if strings.TrimSpace(r.Title) == "" {
		return Finding{}, fmt.Errorf("Finding %d has no title.", n)
	}
	if strings.TrimSpace(r.Detail) == "" {
		return Finding{}, fmt.Errorf("Finding %d (%s) has no detail.", n, r.Title)
	}
	if !slices.Contains(Fates(), r.Fate) {
		return Finding{}, fmt.Errorf("Finding %d (%s) has the fate %q; the fate must be one of %s.", n, r.Title, r.Fate, strings.Join(Fates(), ", "))
	}
	if err := checkCarry(n, r, known, answered); err != nil {
		return Finding{}, err
	}
	then, err := checkAction(n, r)
	if err != nil {
		return Finding{}, err
	}
	return Finding{
		Title:         strings.TrimSpace(r.Title),
		Detail:        strings.TrimSpace(r.Detail),
		Tool:          r.Tool,
		Arguments:     actionArguments(r),
		Then:          then,
		Fate:          r.Fate,
		FateReason:    strings.TrimSpace(r.FateReason),
		CarriedFromID: r.CarriedFromID,
		Reopen:        r.Reopen,
	}, nil
}

func checkCarry(n int, r rawFinding, known, answered map[string]bool) error {
	if r.Fate == FateNew {
		if r.CarriedFromID != "" {
			return fmt.Errorf("Finding %d (%s) is new but names the earlier finding %s.", n, r.Title, r.CarriedFromID)
		}
		if r.Reopen {
			return fmt.Errorf("Finding %d (%s) is new, so it has nothing to reopen.", n, r.Title)
		}
		return nil
	}
	if r.CarriedFromID == "" {
		return fmt.Errorf("Finding %d (%s) has the fate %s but does not name the earlier finding it answers.", n, r.Title, r.Fate)
	}
	if !known[r.CarriedFromID] {
		return fmt.Errorf("Finding %d (%s) answers %s, which is not one of the earlier findings.", n, r.Title, r.CarriedFromID)
	}
	if answered[r.CarriedFromID] {
		return fmt.Errorf("The earlier finding %s is answered more than once.", r.CarriedFromID)
	}
	answered[r.CarriedFromID] = true
	if strings.TrimSpace(r.FateReason) == "" {
		return fmt.Errorf("Finding %d (%s) has the fate %s but gives no reason.", n, r.Title, r.Fate)
	}
	if r.Reopen && r.Fate != FateStillOpen {
		return fmt.Errorf("Finding %d (%s) asks to reopen but its fate is %s, not still_open.", n, r.Title, r.Fate)
	}
	return nil
}

func actionArguments(r rawFinding) map[string]any {
	if r.Tool == "" {
		return nil
	}
	if r.Arguments == nil {
		return map[string]any{}
	}
	return r.Arguments
}

func checkAction(n int, r rawFinding) (string, error) {
	steps, err := stepsOf(r.Then)
	if err != nil {
		return "", fmt.Errorf("Finding %d (%s) has a then that is not a list of steps, each with a tool and arguments.", n, r.Title)
	}
	if r.Tool == "" {
		if len(r.Arguments) > 0 || len(steps) > 0 {
			return "", fmt.Errorf("Finding %d (%s) has arguments or then steps but no tool.", n, r.Title)
		}
		return "", nil
	}
	if !toolName.MatchString(r.Tool) {
		return "", fmt.Errorf("Finding %d (%s) names the tool %q, which is not a tool name.", n, r.Title, r.Tool)
	}
	for _, s := range steps {
		if !toolName.MatchString(s.Tool) {
			return "", fmt.Errorf("Finding %d (%s) has a then step whose tool %q is not a tool name.", n, r.Title, s.Tool)
		}
	}
	if len(steps) == 0 {
		return "", nil
	}
	encoded, err := json.Marshal(steps)
	if err != nil {
		return "", fmt.Errorf("Finding %d (%s) has then steps that cannot be saved.", n, r.Title)
	}
	return string(encoded), nil
}

func stepsOf(raw json.RawMessage) ([]rawStep, error) {
	trimmed := bytes.TrimSpace(raw)
	if len(trimmed) == 0 || string(trimmed) == "null" || string(trimmed) == `""` {
		return nil, nil
	}
	if trimmed[0] == '"' {
		var inner string
		if err := json.Unmarshal(trimmed, &inner); err != nil {
			return nil, err
		}
		trimmed = []byte(inner)
	}
	var steps []rawStep
	if err := json.Unmarshal(trimmed, &steps); err != nil {
		return nil, err
	}
	for i := range steps {
		if steps[i].Arguments == nil {
			steps[i].Arguments = map[string]any{}
		}
	}
	return steps, nil
}

func jsonObject(text string) ([]byte, error) {
	start := strings.Index(text, "{")
	end := strings.LastIndex(text, "}")
	if start < 0 || end < start {
		return nil, fmt.Errorf("The reviewer's answer is not JSON.")
	}
	return []byte(text[start : end+1]), nil
}

func describeJSONError(err error) string {
	var typed *json.UnmarshalTypeError
	if asTyped(err, &typed) {
		return fmt.Sprintf("%s should be %s", typed.Field, typed.Type.String())
	}
	return strings.TrimSuffix(err.Error(), ".")
}

func asTyped(err error, target **json.UnmarshalTypeError) bool {
	t, ok := err.(*json.UnmarshalTypeError)
	if ok {
		*target = t
	}
	return ok
}
