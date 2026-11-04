package reviewruns

import (
	"encoding/json"
	"errors"
	"regexp"
	"strings"
)

const unknownReason = "The reviewer could not finish."

var wrapPrefix = regexp.MustCompile(`^[a-z][a-z0-9_.]*( [a-z][a-z0-9_.]*){0,3}: `)

func RecordArgs(in AreaInput, result AreaResult) map[string]any {
	findings := make([]any, 0, len(result.Findings))
	for _, f := range result.Findings {
		findings = append(findings, findingArgs(f))
	}
	return map[string]any{
		"review_id":      in.ReviewID,
		"area":           in.Area,
		"status":         "done",
		"summary":        result.Summary,
		"failure_reason": "",
		"tokens":         result.Tokens,
		"findings":       findings,
	}
}

func FailedArgs(in AreaInput, reason string) map[string]any {
	return map[string]any{
		"review_id":      in.ReviewID,
		"area":           in.Area,
		"status":         "failed",
		"summary":        "",
		"failure_reason": reason,
		"tokens":         0,
		"findings":       []any{},
	}
}

func ReasonOf(err error) string {
	if err == nil {
		return unknownReason
	}
	if errors.Is(err, ErrNoDefaultAccount) {
		return ErrNoDefaultAccount.Error()
	}
	inner := err
	for {
		next := errors.Unwrap(inner)
		if next == nil {
			break
		}
		inner = next
	}
	text := strings.TrimSpace(inner.Error())
	text = withoutPrefixes(text)
	if text == "" {
		return unknownReason
	}
	text = strings.ToUpper(text[:1]) + text[1:]
	if !strings.HasSuffix(text, ".") && !strings.HasSuffix(text, "!") && !strings.HasSuffix(text, "?") {
		text += "."
	}
	return text
}

func withoutPrefixes(text string) string {
	for {
		rest := wrapPrefix.ReplaceAllString(text, "")
		if rest == "" || rest == text {
			return text
		}
		text = rest
	}
}

func findingArgs(f Finding) map[string]any {
	return map[string]any{
		"title":           f.Title,
		"detail":          f.Detail,
		"tool":            f.Tool,
		"arguments":       objectOf(f.Arguments),
		"then":            stepsArray(f.Then),
		"fate":            f.Fate,
		"fate_reason":     f.FateReason,
		"carried_from_id": f.CarriedFromID,
		"reopen":          f.Reopen,
	}
}

func objectOf(arguments map[string]any) map[string]any {
	if arguments == nil {
		return map[string]any{}
	}
	return arguments
}

func stepsArray(then string) []any {
	steps := []any{}
	if strings.TrimSpace(then) == "" {
		return steps
	}
	var decoded []map[string]any
	if err := json.Unmarshal([]byte(then), &decoded); err != nil {
		return steps
	}
	for _, s := range decoded {
		steps = append(steps, map[string]any{"tool": s["tool"], "arguments": objectValue(s["arguments"])})
	}
	return steps
}

func objectValue(v any) map[string]any {
	switch x := v.(type) {
	case map[string]any:
		return x
	case string:
		var decoded map[string]any
		if json.Unmarshal([]byte(x), &decoded) == nil && decoded != nil {
			return decoded
		}
	}
	return map[string]any{}
}
