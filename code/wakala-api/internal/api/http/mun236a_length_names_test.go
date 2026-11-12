package http

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"testing"
)

type mun236aProbe struct {
	label  string
	method string
	path   string
	field  string
	extra  map[string]any
}

func (p mun236aProbe) body(name string) map[string]any {
	out := map[string]any{p.field: name}
	for k, v := range p.extra {
		out[k] = v
	}
	return out
}

func mun236aLengths() []int {
	return []int{1, 200, 201, 1000, 10000, 100000}
}

func mun236aName(length int) string {
	return strings.Repeat("a", length)
}

func mun236aUnboundedAbove() int {
	return 10000
}

func (w freeTextWalk) mun236aProbeLengths(t *testing.T, p mun236aProbe) {
	t.Helper()
	var answers []string
	var labels []string
	names := map[string]string{}
	for _, length := range mun236aLengths() {
		label := fmt.Sprintf("%d chars", length)
		labels = append(labels, label)
		names[label] = mun236aName(length)
	}
	labels = append(labels, "spaces only")
	names["spaces only"] = "     "
	for _, label := range labels {
		name := names[label]
		rec := w.call(t, p.method, p.path, p.body(name), w.owner)
		answers = append(answers, fmt.Sprintf("%s=%d%s", label, rec.Code, mun236aStoredNote(rec.Body.String(), p.field, len(name))))
		if rec.Code >= 500 {
			t.Errorf("%s with %s answered %d %s, want never a 5xx", p.label, label, rec.Code, mun236aTruncated(rec.Body.String()))
			continue
		}
		if rec.Code < 300 && strings.HasPrefix(label, "spaces") {
			t.Errorf("%s with only spaces answered %d, want a 400", p.label, rec.Code)
			continue
		}
		if rec.Code < 300 && len(name) >= mun236aUnboundedAbove() {
			t.Errorf("%s with a name of %s was accepted (%d), want a 400 over a limit", p.label, label, rec.Code)
		}
		if rec.Code >= 400 && rec.Code != http.StatusBadRequest && rec.Code != http.StatusRequestEntityTooLarge {
			t.Errorf("%s with %s answered %d %s, want 400 or 413", p.label, label, rec.Code, mun236aTruncated(rec.Body.String()))
		}
	}
	t.Logf("%s: %s", p.label, strings.Join(answers, " "))
}

func mun236aStoredNote(body, field string, sent int) string {
	var out map[string]any
	if err := json.Unmarshal([]byte(body), &out); err != nil {
		return ""
	}
	stored, ok := out[field].(string)
	if !ok {
		return ""
	}
	return fmt.Sprintf("(stored %d of %d)", len(stored), sent)
}

func mun236aTruncated(s string) string {
	if len(s) > 160 {
		return s[:160] + "..."
	}
	return s
}

func TestLengthNames_RoundOneGroupsAndActors(t *testing.T) {
	w := newFreeTextWalk(t)
	actor := "/instances/" + w.instance + "/actor"
	w.mun236aProbeLengths(t, mun236aProbe{label: "create group", method: "POST", path: actor + "/groups", field: "name"})
	w.mun236aProbeLengths(t, mun236aProbe{label: "create actor display name", method: "POST", path: actor + "/actors", field: "display_name"})
	w.mun236aProbeLengths(t, mun236aProbe{label: "create hierarchy", method: "POST", path: actor + "/hierarchies", field: "name"})
}

func TestLengthNames_RoundTwoFormsAndPolls(t *testing.T) {
	w := newFreeTextWalk(t)
	w.mun236aProbeLengths(t, mun236aProbe{label: "create form title", method: "POST", path: w.forms, field: "title", extra: map[string]any{
		"closes_at": w.closes, "originator_chapter_id": w.groupID, "audience": "member", "collection_mode": "self",
	}})
	w.mun236aProbeLengths(t, mun236aProbe{label: "create poll question", method: "POST", path: w.polls, field: "question", extra: map[string]any{
		"mode": "one", "per_group": "once", "group_ids": []string{w.groupID}, "opens_at": w.opens, "closes_at": w.closes,
		"choices": []map[string]any{{"label": "green"}, {"label": "blue"}},
	}})
}

func TestLengthNames_RoundThreeBacklogsProjectsAndIssues(t *testing.T) {
	w := newFreeTextWalk(t)
	tm := "/instances/" + w.instance + "/taskmanager"
	w.mun236aProbeLengths(t, mun236aProbe{label: "create backlog", method: "POST", path: tm + "/backlogs", field: "name", extra: map[string]any{"steps": []string{"Open", "Done"}}})
	w.mun236aProbeLengths(t, mun236aProbe{label: "create project", method: "POST", path: tm + "/projects", field: "name"})
	w.mun236aProbeLengths(t, mun236aProbe{label: "create issue title", method: "POST", path: tm + "/tasks", field: "title"})
	w.mun236aProbeLengths(t, mun236aProbe{label: "create agency", method: "POST", path: "/instances", field: "name"})
}
