package http

import (
	"context"
	"strings"
	"testing"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

const instanceNotFoundText = "instance not found"

type residentLookupCall struct {
	tool       string
	permission string
	action     string
}

var residentLookupCalls = []residentLookupCall{
	{tool: "agency_get_agency", permission: "agency.agency.read", action: "agency.agency.read"},
	{tool: "taskmanager_task_list", permission: "task.read", action: "taskmanager.task.list"},
	{tool: "digitaltwin_tenure_list", permission: "digitaltwin.view", action: "digitaltwin.tenure.list"},
	{tool: "agency_list_mounts", permission: "mount.list", action: "instance.mount.list"},
}

func residentLookupWalk(t *testing.T) groupRoleWalk {
	t.Helper()
	w := newGroupRoleWalk(t)
	runsModules(t, w.instance, "digitaltwin", "taskmanager")
	w.deps.rolePermissionsOverride = func(_ context.Context, roleID string) ([]string, error) {
		if roleID == w.roles["Reader"] {
			return []string{"digitaltwin.view", "mount.list"}, nil
		}
		return nil, nil
	}
	return w
}

func (w groupRoleWalk) callTool(t *testing.T, subject, tool string, args map[string]any) *mcp.CallToolResult {
	t.Helper()
	ctx := w.asSubject(subject)
	serverSide, clientSide := mcp.NewInMemoryTransports()
	session, err := newMCPServer(w.deps).Connect(ctx, serverSide, nil)
	if err != nil {
		t.Fatalf("connect server: %v", err)
	}
	t.Cleanup(func() { session.Close() })
	client, err := mcp.NewClient(&mcp.Implementation{Name: "test", Version: "1"}, nil).Connect(ctx, clientSide, nil)
	if err != nil {
		t.Fatalf("connect client: %v", err)
	}
	t.Cleanup(func() { client.Close() })
	out, err := client.CallTool(ctx, &mcp.CallToolParams{Name: tool, Arguments: args})
	if err != nil {
		t.Fatalf("call %s: %v", tool, err)
	}
	return out
}

func (w groupRoleWalk) lookup(t *testing.T, subject, tool string) *mcp.CallToolResult {
	t.Helper()
	return w.callTool(t, subject, tool, map[string]any{"instance_id": w.instance})
}

func TestResidentLookup_AResidentWithNoRoleIsRefusedByPermissionNotAsAStranger(t *testing.T) {
	w := residentLookupWalk(t)
	id, _ := w.resident(t, "Amina", "Support")
	for _, c := range residentLookupCalls {
		out := w.lookup(t, id, c.tool)
		text := toolErrorText(out)
		if !out.IsError {
			t.Errorf("%s: a resident with no role was admitted", c.tool)
			continue
		}
		if strings.Contains(text, instanceNotFoundText) {
			t.Errorf("%s: a resident is told %q, want a refusal by permission", c.tool, text)
		}
		if !strings.Contains(text, c.permission) && !strings.Contains(text, c.action) {
			t.Errorf("%s: refusal %q names neither %q nor %q", c.tool, text, c.permission, c.action)
		}
	}
}

func TestResidentLookup_AResidentHoldingThePermissionIsAdmitted(t *testing.T) {
	w := residentLookupWalk(t)
	id, _ := w.resident(t, "Amina", "Support")
	w.giveRole(t, "Support", "Reader")
	for _, tool := range []string{"digitaltwin_tenure_list", "agency_list_mounts"} {
		if out := w.lookup(t, id, tool); out.IsError {
			t.Errorf("%s: a resident holding the permission got %q", tool, toolErrorText(out))
		}
	}
}

func TestResidentLookup_ANonMemberStillGetsInstanceNotFound(t *testing.T) {
	w := residentLookupWalk(t)
	for _, c := range residentLookupCalls {
		out := w.lookup(t, "a-stranger", c.tool)
		if !out.IsError || !strings.Contains(toolErrorText(out), instanceNotFoundText) {
			t.Errorf("%s: a non-member got %q (error %v), want %q", c.tool, toolErrorText(out), out.IsError, instanceNotFoundText)
		}
	}
}
