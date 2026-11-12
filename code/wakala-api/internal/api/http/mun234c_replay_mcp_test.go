package http

import (
	"context"
	"encoding/json"
	"strings"
	"sync"
	"testing"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	"wakalaserver/internal/accounts"
)

type replayExpect int

const (
	replayOneRow replayExpect = iota
	replayDuplicatesAllowed
)

type replayCase struct {
	tool     string
	args     func(label string) map[string]any
	list     string
	listArgs map[string]any
	expect   replayExpect
	fixed    func(t *testing.T, cw consentWalk) map[string]any
	bug      string
}

type replayAnswer struct {
	refused  bool
	internal bool
	text     string
	id       string
}

var internalFailureMarkers = []string{"internal", "sqlstate", "database is locked", "table is locked", "constraint failed", "deadlock", "panic", "500", "duplicate key"}

func (cw consentWalk) replayCall(subject, tool string, args map[string]any) replayAnswer {
	ctx := accounts.WithID(context.Background(), subject)
	serverSide, clientSide := mcp.NewInMemoryTransports()
	session, err := newMCPServer(cw.deps).Connect(ctx, serverSide, nil)
	if err != nil {
		return replayAnswer{internal: true, text: "connect server: " + err.Error()}
	}
	defer session.Close()
	client, err := mcp.NewClient(&mcp.Implementation{Name: "test", Version: "1"}, nil).Connect(ctx, clientSide, nil)
	if err != nil {
		return replayAnswer{internal: true, text: "connect client: " + err.Error()}
	}
	defer client.Close()
	out, err := client.CallTool(ctx, &mcp.CallToolParams{Name: tool, Arguments: args})
	if err != nil {
		return replayAnswer{internal: true, text: "transport: " + err.Error()}
	}
	if out.IsError {
		text := toolErrorText(out)
		return replayAnswer{refused: true, text: text, internal: mentionsInternalFailure(text)}
	}
	raw, _ := json.Marshal(out.StructuredContent)
	answer := replayAnswer{text: string(raw)}
	if structured, ok := out.StructuredContent.(map[string]any); ok {
		answer.id = firstID(structured)
	}
	return answer
}

func mentionsInternalFailure(text string) bool {
	lowered := strings.ToLower(text)
	for _, marker := range internalFailureMarkers {
		if strings.Contains(lowered, marker) {
			return true
		}
	}
	return false
}

func firstID(structured map[string]any) string {
	for _, key := range []string{"id", "thread_id", "version", "record_id"} {
		if value, ok := structured[key].(string); ok && value != "" {
			return value
		}
	}
	return ""
}

func (cw consentWalk) rowsHolding(t *testing.T, c replayCase, fixed map[string]any, marker string) int {
	t.Helper()
	list := c.list
	listArgs := map[string]any{"instance_id": cw.instance}
	for key, value := range c.listArgs {
		listArgs[key] = value
	}
	for key := range c.listArgs {
		if value, ok := fixed[key]; ok {
			listArgs[key] = value
		}
	}
	answer := cw.replayCall("test-owner", list, listArgs)
	if answer.refused || answer.internal {
		t.Fatalf("%s: %s", list, answer.text)
	}
	var decoded any
	json.Unmarshal([]byte(answer.text), &decoded)
	return countRowsHolding(decoded, marker)
}

func countRowsHolding(decoded any, marker string) int {
	switch value := decoded.(type) {
	case []any:
		count := 0
		for _, row := range value {
			raw, _ := json.Marshal(row)
			if strings.Contains(string(raw), marker) {
				count++
			}
		}
		return count
	case map[string]any:
		count := 0
		for _, inner := range value {
			count += countRowsHolding(inner, marker)
		}
		return count
	}
	return 0
}

func (cw consentWalk) argsFor(c replayCase, fixed map[string]any, label string) map[string]any {
	args := c.args(label)
	for key, value := range fixed {
		args[key] = value
	}
	args["instance_id"] = cw.instance
	return args
}

func (cw consentWalk) twiceInARow(c replayCase, fixed map[string]any, label string) [2]replayAnswer {
	args := cw.argsFor(c, fixed, label)
	first := cw.replayCall("test-owner", c.tool, args)
	second := cw.replayCall("test-owner", c.tool, args)
	return [2]replayAnswer{first, second}
}

func (cw consentWalk) twiceAtOnce(c replayCase, fixed map[string]any, label string) [2]replayAnswer {
	var answers [2]replayAnswer
	start := make(chan struct{})
	var group sync.WaitGroup
	for i := range answers {
		group.Add(1)
		go func(i int) {
			defer group.Done()
			args := cw.argsFor(c, fixed, label)
			<-start
			answers[i] = cw.replayCall("test-owner", c.tool, args)
		}(i)
	}
	close(start)
	group.Wait()
	return answers
}

func judgeReplay(t *testing.T, c replayCase, phase string, answers [2]replayAnswer, rows int) {
	t.Helper()
	t.Logf("%s %s: first=%s second=%s rows=%d", c.tool, phase, shorten(answers[0]), shorten(answers[1]), rows)
	if c.bug != "" {
		t.Logf("%s %s: known bug %s, assertions skipped", c.tool, phase, c.bug)
		return
	}
	for i, answer := range answers {
		if answer.internal {
			t.Errorf("%s %s answer %d is not a clean refusal: %s", c.tool, phase, i+1, answer.text)
		}
	}
	if answers[0].refused && answers[1].refused {
		t.Errorf("%s %s: both sends refused: %q / %q", c.tool, phase, answers[0].text, answers[1].text)
	}
	if rows == 0 {
		t.Errorf("%s %s: no row was written", c.tool, phase)
	}
	if c.expect == replayOneRow && rows > 1 {
		t.Errorf("%s %s: %d rows for one request sent twice", c.tool, phase, rows)
	}
}

func shorten(a replayAnswer) string {
	text := a.text
	if len(text) > 90 {
		text = text[:90] + "..."
	}
	if a.refused {
		return "refused(" + text + ")"
	}
	return "ok(" + text + ")"
}

func (cw consentWalk) probeReplay(t *testing.T, cases []replayCase) {
	t.Helper()
	for _, c := range cases {
		c := c
		t.Run(c.tool, func(t *testing.T) {
			inARow := "seq" + strings.ReplaceAll(c.tool, "_", "")
			atOnce := "con" + strings.ReplaceAll(c.tool, "_", "")
			var fixed map[string]any
			if c.fixed != nil {
				fixed = c.fixed(t, cw)
			}
			answers := cw.twiceInARow(c, fixed, inARow)
			judgeReplay(t, c, "in a row", answers, cw.rowsHolding(t, c, fixed, inARow))
			answers = cw.twiceAtOnce(c, fixed, atOnce)
			judgeReplay(t, c, "at once", answers, cw.rowsHolding(t, c, fixed, atOnce))
		})
	}
}

func named(key string, extra map[string]any) func(label string) map[string]any {
	return func(label string) map[string]any {
		args := map[string]any{key: label}
		for k, v := range extra {
			args[k] = v
		}
		return args
	}
}

func replayWalk(t *testing.T) consentWalk {
	t.Helper()
	cw := newConsentWalk(t)
	cacheMountedSet(t, cw.instance, mountedSet{modules: map[string]bool{"custody": true, "forms": true, "market": true, "riskmanager": true, "ai": true, "taskmanager": true, "assetmanager": true, "sources": true, "comm": true, "actor": true}})
	return cw
}

func (cw consentWalk) makeOne(t *testing.T, tool string, args map[string]any) map[string]any {
	t.Helper()
	args["instance_id"] = cw.instance
	answer := cw.replayCall("test-owner", tool, args)
	if answer.refused || answer.internal {
		t.Fatalf("set up with %s: %s", tool, answer.text)
	}
	var decoded map[string]any
	json.Unmarshal([]byte(answer.text), &decoded)
	return decoded
}

func TestMUN234c_ReplayMCP_Round1(t *testing.T) {
	cw := replayWalk(t)
	cw.probeReplay(t, []replayCase{
		{tool: "actor_create_actor", args: named("display_name", nil), list: "actor_list_actors", expect: replayDuplicatesAllowed},
		{tool: "actor_create_group", args: named("name", nil), list: "actor_list_groups", expect: replayOneRow},
		{tool: "actor_create_hierarchy", args: named("name", nil), list: "actor_list_hierarchies", expect: replayOneRow},
		{tool: "actor_create_role_kind", args: named("name", nil), list: "actor_list_role_kinds", expect: replayOneRow},
		{tool: "taskmanager_project_create", args: named("name", nil), list: "taskmanager_project_list", expect: replayOneRow},
		{tool: "taskmanager_backlog_create", args: named("name", nil), list: "taskmanager_backlog_list", expect: replayOneRow},
		{tool: "taskmanager_task_create", args: named("title", nil), list: "taskmanager_task_list", expect: replayDuplicatesAllowed},
		{tool: "taskmanager_case_open", args: named("title", map[string]any{"subject_kind": "task"}), list: "taskmanager_case_list", expect: replayDuplicatesAllowed},
		{tool: "assetmanager_location_create", args: named("name", nil), list: "assetmanager_location_list", expect: replayDuplicatesAllowed},
		{tool: "assetmanager_asset_create", args: func(label string) map[string]any {
			return map[string]any{"name": label, "tracking_mode": "serialized", "serial_tag": label}
		}, list: "assetmanager_asset_list", expect: replayOneRow, bug: "MUN684"},
		{tool: "sources_source_create", args: named("title", nil), list: "sources_source_list", expect: replayDuplicatesAllowed},
	})
}

func TestMUN234c_ReplayMCP_Round2(t *testing.T) {
	cw := replayWalk(t)
	draft := func(t *testing.T, cw consentWalk) map[string]any {
		return map[string]any{"draft_id": cw.makeOne(t, "agency_create_draft", map[string]any{"description": "replay"})["id"]}
	}
	cw.probeReplay(t, []replayCase{
		{tool: "actor_create_group_type", args: named("name", nil), list: "actor_list_group_types", expect: replayOneRow, bug: "MUN688", fixed: func(t *testing.T, cw consentWalk) map[string]any {
			hierarchy := cw.makeOne(t, "actor_create_hierarchy", map[string]any{"name": "typed"})
			level := cw.makeOne(t, "actor_create_level", map[string]any{"name": "ward", "depth": 1, "hierarchy_id": hierarchy["id"]})
			return map[string]any{"hierarchy_id": hierarchy["id"], "level_id": level["id"]}
		}},
		{tool: "agency_create_draft", args: named("description", nil), list: "agency_list_drafts", expect: replayDuplicatesAllowed},
		{tool: "agency_create_role", args: named("name", nil), list: "agency_list_roles", listArgs: map[string]any{"draft_id": ""}, expect: replayDuplicatesAllowed, fixed: draft},
		{tool: "agency_create_goal", args: named("title", nil), list: "agency_list_goals", listArgs: map[string]any{"draft_id": ""}, expect: replayDuplicatesAllowed, fixed: draft},
		{tool: "agency_create_value", args: named("text", nil), list: "agency_list_values", listArgs: map[string]any{"draft_id": ""}, expect: replayDuplicatesAllowed, fixed: draft},
		{tool: "agency_create_workflow", args: named("name", nil), list: "agency_list_workflows", listArgs: map[string]any{"draft_id": ""}, expect: replayDuplicatesAllowed, fixed: draft},
		{tool: "custody_publish_consent_version", args: named("text", map[string]any{"scope": "mechanics"}), list: "custody_list_consent_versions", expect: replayOneRow, bug: "MUN687"},
	})
}

func TestMUN234c_ReplayMCP_Round3(t *testing.T) {
	cw := replayWalk(t)
	cw.probeReplay(t, []replayCase{
		{tool: "taskmanager_backlog_step_add", args: named("name", nil), list: "taskmanager_backlog_list", expect: replayOneRow, fixed: func(t *testing.T, cw consentWalk) map[string]any {
			backlog := cw.makeOne(t, "taskmanager_backlog_create", map[string]any{"name": "stepped"})
			return map[string]any{"backlogID": backlog["id"]}
		}},
		{tool: "taskmanager_task_note_add", args: named("text", nil), list: "taskmanager_task_note_list", expect: replayDuplicatesAllowed, listArgs: map[string]any{"taskID": ""}, fixed: func(t *testing.T, cw consentWalk) map[string]any {
			task := cw.makeOne(t, "taskmanager_task_create", map[string]any{"title": "noted"})
			return map[string]any{"taskID": task["id"]}
		}},
		{tool: "riskmanager_risk_create", args: func(label string) map[string]any { return map[string]any{"title": label, "top_event": label} }, list: "riskmanager_risk_list", expect: replayDuplicatesAllowed},
		{tool: "riskmanager_control_create", args: named("name", nil), list: "riskmanager_control_list", expect: replayDuplicatesAllowed},
		{tool: "forms_form_create", args: named("title", map[string]any{"closes_at": "2030-01-01T00:00:00Z"}), list: "forms_form_list", expect: replayDuplicatesAllowed},
		{tool: "market_create_notice", args: named("wanted", nil), list: "market_list_notices", expect: replayDuplicatesAllowed},
	})
}
