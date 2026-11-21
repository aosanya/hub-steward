package http

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
)

const homeContractTool = "agency_get_home"

type homeWorld struct {
	groupRoleWalk
	mgr mwanachamaagency.AgencyManager
}

func newHomeWorld(t *testing.T) homeWorld {
	t.Helper()
	w := newGroupRoleWalk(t)
	mgr, err := w.deps.Registry.AgencyManager(context.Background(), w.instance)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	return homeWorld{groupRoleWalk: w, mgr: mgr}
}

func homeSection(key, title string, entries ...agencymodels.DocumentHomeNode) agencymodels.DocumentHomeNode {
	return agencymodels.DocumentHomeNode{Key: key, Title: title, Entries: entries}
}

func homeEntry(key, title string, kind agencymodels.HomeTargetType, ref string) agencymodels.DocumentHomeNode {
	return agencymodels.DocumentHomeNode{Key: key, Title: title, Target: &agencymodels.HomeTarget{Type: kind, Ref: ref}}
}

func (h homeWorld) declare(t *testing.T, draftID string, nodes ...agencymodels.DocumentHomeNode) {
	t.Helper()
	h.declareUnder(t, draftID, "", nodes)
}

func (h homeWorld) declareUnder(t *testing.T, draftID, parentID string, nodes []agencymodels.DocumentHomeNode) {
	t.Helper()
	for _, node := range nodes {
		row := agencymodels.HomeEntryOfNode(node)
		row.DraftID, row.ParentID = draftID, parentID
		created, err := h.mgr.CreateHomeEntry(context.Background(), row)
		if err != nil {
			t.Fatalf("CreateHomeEntry %s: %v", node.Key, err)
		}
		h.declareUnder(t, draftID, created.ID, node.Entries)
	}
}

func (h homeWorld) publishDraft(t *testing.T, draftID string) {
	t.Helper()
	rec := h.call(t, "POST", "/instances/"+h.instance+"/publications", map[string]any{"draft_id": draftID}, h.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("publish %s: %d %s", draftID, rec.Code, rec.Body.String())
	}
}

func (h homeWorld) nextDraft(t *testing.T) string {
	t.Helper()
	draft, err := h.mgr.CreateDraft(context.Background(), "next version", h.draftID, "draft")
	if err != nil {
		t.Fatalf("CreateDraft: %v", err)
	}
	return draft.ID
}

func (h homeWorld) homeOf(t *testing.T, subject string) *mcp.CallToolResult {
	t.Helper()
	return h.callTool(t, subject, homeContractTool, map[string]any{"instance_id": h.instance})
}

func (h homeWorld) homeFor(t *testing.T, subject string) []any {
	t.Helper()
	return homeItems(t, h.homeOf(t, subject))
}

func homeItems(t *testing.T, out *mcp.CallToolResult) []any {
	t.Helper()
	if out.IsError {
		t.Fatalf("%s answered with an error: %s", homeContractTool, toolErrorText(out))
	}
	structured, ok := out.StructuredContent.(map[string]any)
	if !ok {
		t.Fatalf("%s structured content = %#v, want an object holding the list", homeContractTool, out.StructuredContent)
	}
	for _, wrapper := range []string{"items", "entries"} {
		if raw, present := structured[wrapper]; present {
			list, ok := raw.([]any)
			if !ok {
				t.Fatalf("%s %s = %#v, want a list (an empty Home is [], not null)", homeContractTool, wrapper, raw)
			}
			return nestedTargets(list)
		}
	}
	t.Fatalf("%s structured content %#v holds neither items nor entries", homeContractTool, structured)
	return nil
}

func nestedTargets(nodes []any) []any {
	out := make([]any, len(nodes))
	for i, raw := range nodes {
		node, ok := raw.(map[string]any)
		if !ok {
			out[i] = raw
			continue
		}
		copied := map[string]any{}
		for key, value := range node {
			copied[key] = value
		}
		if kind, flat := node["target_type"]; flat {
			target := map[string]any{"type": kind, "ref": node["target"]}
			for _, field := range []string{"step", "scope", "where"} {
				if value, present := node[field]; present {
					target[field] = value
					delete(copied, field)
				}
			}
			copied["target"] = target
			delete(copied, "target_type")
		}
		if entries, ok := node["entries"].([]any); ok {
			copied["entries"] = nestedTargets(entries)
		}
		out[i] = copied
	}
	return out
}

func rawNodes(t *testing.T, out *mcp.CallToolResult) []any {
	t.Helper()
	structured, _ := out.StructuredContent.(map[string]any)
	for _, wrapper := range []string{"items", "entries"} {
		if list, ok := structured[wrapper].([]any); ok {
			return list
		}
	}
	t.Fatalf("%s structured content %#v holds no list", homeContractTool, out.StructuredContent)
	return nil
}

func shapeOf(t *testing.T, value any, dropped ...string) any {
	t.Helper()
	encoded, err := json.Marshal(value)
	if err != nil {
		t.Fatalf("encode: %v", err)
	}
	var generic any
	if err := json.Unmarshal(encoded, &generic); err != nil {
		t.Fatalf("decode: %v", err)
	}
	return withoutEmpties(generic, dropped)
}

func withoutEmpties(value any, dropped []string) any {
	switch v := value.(type) {
	case map[string]any:
		out := map[string]any{}
		for key, inner := range v {
			if isDropped(key, dropped) {
				continue
			}
			cleaned := withoutEmpties(inner, dropped)
			if isEmptyValue(cleaned) {
				continue
			}
			out[key] = cleaned
		}
		return out
	case []any:
		out := make([]any, len(v))
		for i, inner := range v {
			out[i] = withoutEmpties(inner, dropped)
		}
		return out
	}
	return value
}

func isDropped(key string, dropped []string) bool {
	for _, name := range append([]string{"workflow_id", "step_id"}, dropped...) {
		if key == name {
			return true
		}
	}
	return false
}

func isEmptyValue(value any) bool {
	switch v := value.(type) {
	case nil:
		return true
	case string:
		return v == ""
	case []any:
		return len(v) == 0
	case map[string]any:
		return len(v) == 0
	}
	return false
}

func homeKeysOf(nodes []any) []string {
	var keys []string
	for _, node := range nodes {
		object, _ := node.(map[string]any)
		key, _ := object["key"].(string)
		keys = append(keys, key)
	}
	return keys
}

func nodeNamed(nodes []any, key string) (map[string]any, bool) {
	for _, node := range nodes {
		object, _ := node.(map[string]any)
		if object["key"] == key {
			return object, true
		}
		if inner, ok := nodeNamed(entriesOf(object), key); ok {
			return inner, true
		}
	}
	return nil, false
}

func entriesOf(node map[string]any) []any {
	entries, _ := node["entries"].([]any)
	return entries
}

func targetRefsOf(nodes []any) []string {
	var refs []string
	for _, node := range nodes {
		object, _ := node.(map[string]any)
		if target, ok := object["target"].(map[string]any); ok {
			ref, _ := target["ref"].(string)
			refs = append(refs, ref)
		}
		refs = append(refs, targetRefsOf(entriesOf(object))...)
	}
	return refs
}

func refusalText(out *mcp.CallToolResult) string {
	if !out.IsError {
		return ""
	}
	return strings.TrimSpace(toolErrorText(out))
}

func (h homeWorld) stepCodeOf(t *testing.T, workflowID string) string {
	t.Helper()
	steps, err := h.mgr.ListWorkItems(context.Background(), h.draftID, mwanachamaagency.WorkItemFilter{})
	if err != nil {
		t.Fatalf("ListWorkItems: %v", err)
	}
	for _, step := range steps {
		if step.WorkflowID == workflowID {
			return step.Code
		}
	}
	t.Fatalf("workflow %s holds no step", workflowID)
	return ""
}
