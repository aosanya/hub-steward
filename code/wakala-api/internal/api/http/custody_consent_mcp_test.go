package http

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	"wakalaserver/internal/accounts"
)

var consentToolNames = []string{
	"custody_list_consent_versions",
	"custody_get_in_force_consent",
	"custody_publish_consent_version",
	"custody_get_my_consent",
	"custody_agree_consent",
	"custody_withdraw_consent",
}

func (cw consentWalk) mcpTool(t *testing.T, subject, tool string, args map[string]any) *mcp.CallToolResult {
	t.Helper()
	ctx := accounts.WithID(context.Background(), subject)
	serverSide, clientSide := mcp.NewInMemoryTransports()
	session, err := newMCPServer(cw.deps).Connect(ctx, serverSide, nil)
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

func (cw consentWalk) mcpOK(t *testing.T, subject, tool string, args map[string]any) map[string]any {
	t.Helper()
	out := cw.mcpTool(t, subject, tool, args)
	if out.IsError {
		t.Fatalf("%s as %s: %s", tool, subject, toolErrorText(out))
	}
	structured, _ := out.StructuredContent.(map[string]any)
	return structured
}

func (cw consentWalk) mcpRefused(t *testing.T, subject, tool string, args map[string]any, want string) {
	t.Helper()
	out := cw.mcpTool(t, subject, tool, args)
	if !out.IsError || !strings.Contains(toolErrorText(out), want) {
		t.Fatalf("%s as %s: error=%v %q, want an error holding %q", tool, subject, out.IsError, toolErrorText(out), want)
	}
}

func schemaText(t *testing.T, tool *mcp.Tool) string {
	t.Helper()
	raw, err := json.Marshal(tool.InputSchema)
	if err != nil {
		t.Fatalf("marshal schema of %s: %v", tool.Name, err)
	}
	return string(raw)
}

func TestCustodyConsentMCP_EveryToolIsListedWithItsInstanceArgument(t *testing.T) {
	cw := newConsentWalk(t)
	ctx := accounts.WithID(context.Background(), "test-owner")
	serverSide, clientSide := mcp.NewInMemoryTransports()
	session, err := newMCPServer(cw.deps).Connect(ctx, serverSide, nil)
	if err != nil {
		t.Fatalf("connect server: %v", err)
	}
	t.Cleanup(func() { session.Close() })
	client, err := mcp.NewClient(&mcp.Implementation{Name: "test", Version: "1"}, nil).Connect(ctx, clientSide, nil)
	if err != nil {
		t.Fatalf("connect client: %v", err)
	}
	t.Cleanup(func() { client.Close() })
	listed := map[string]*mcp.Tool{}
	for tool, err := range client.Tools(ctx, nil) {
		if err != nil {
			t.Fatalf("list tools: %v", err)
		}
		listed[tool.Name] = tool
	}
	for _, name := range consentToolNames {
		tool, ok := listed[name]
		if !ok {
			t.Errorf("%s is not served", name)
			continue
		}
		if !strings.Contains(schemaText(t, tool), "instance_id") {
			t.Errorf("%s takes no instance_id", name)
		}
	}
}

func TestCustodyConsentMCP_OwnerPublishesTheTextAndAResidentReadsAgreesAndWithdraws(t *testing.T) {
	cw := newConsentWalk(t)
	owner, resident, instance := "test-owner", cw.actorID, cw.instance
	base := func(extra map[string]any) map[string]any {
		args := map[string]any{"instance_id": instance}
		for k, v := range extra {
			args[k] = v
		}
		return args
	}

	cw.mcpRefused(t, resident, "custody_get_in_force_consent", base(nil), "not found")
	cw.mcpRefused(t, resident, "custody_agree_consent", base(nil), "no mechanics version")
	if state := cw.mcpOK(t, resident, "custody_get_my_consent", base(nil)); state["status"] != "none" {
		t.Fatalf("resident before agreeing: %v, want status none", state)
	}

	cw.mcpRefused(t, resident, "custody_list_consent_versions", base(nil), "instance not found")
	cw.mcpRefused(t, resident, "custody_publish_consent_version", base(map[string]any{"text": "mine"}), "instance not found")
	cw.mcpRefused(t, owner, "custody_publish_consent_version", base(map[string]any{"text": "   "}), "text is required")
	cw.mcpRefused(t, owner, "custody_publish_consent_version", base(map[string]any{"text": strings.Repeat("x", 2001)}), "2000")

	first := cw.mcpOK(t, owner, "custody_publish_consent_version", base(map[string]any{"text": "We keep your answers to run the ward consultation."}))
	if first["version"] != "v1" || first["published_at"] == nil {
		t.Fatalf("first publication: %v, want v1 published", first)
	}
	second := cw.mcpOK(t, owner, "custody_publish_consent_version", base(map[string]any{"text": strings.Repeat("y", 2000)}))
	if second["version"] != "v2" {
		t.Fatalf("second publication: %v, want v2", second)
	}

	listed := cw.mcpOK(t, owner, "custody_list_consent_versions", base(nil))
	rows, _ := listed["items"].([]any)
	if len(rows) != 2 {
		t.Fatalf("version list: %v, want two rows", listed)
	}
	newest, _ := rows[0].(map[string]any)
	oldest, _ := rows[1].(map[string]any)
	if newest["version"] != "v2" || newest["in_force"] != true || oldest["version"] != "v1" || oldest["in_force"] != false {
		t.Fatalf("version list: %v, want v2 in force above v1", rows)
	}

	inForce := cw.mcpOK(t, resident, "custody_get_in_force_consent", base(nil))
	if inForce["version"] != "v2" {
		t.Fatalf("resident reads the text in force: %v, want v2", inForce)
	}

	formID, questionID := openFormForGroup(t, cw)
	answerPath := "/instances/" + instance + "/forms/forms/" + formID + "/answers"
	answer := func() int {
		return cw.call(t, "POST", answerPath, map[string]any{"answers": []map[string]any{{"question_id": questionID, "value_text": "synthetic"}}}, cw.resident).Code
	}
	if code := answer(); code != http.StatusForbidden {
		t.Fatalf("answer before agreeing: %d, want 403", code)
	}

	agreed := cw.mcpOK(t, resident, "custody_agree_consent", base(nil))
	if agreed["actor_id"] != resident || agreed["language"] != "en" {
		t.Fatalf("agree: %v, want the resident's record in the agency language", agreed)
	}
	if code := answer(); code != http.StatusOK {
		t.Fatalf("answer after agreeing: %d, want 200", code)
	}
	if state := cw.mcpOK(t, resident, "custody_get_my_consent", base(nil)); state["status"] != "agreed" {
		t.Fatalf("resident after agreeing: %v, want status agreed", state)
	}

	cw.mcpOK(t, resident, "custody_withdraw_consent", base(nil))
	if code := answer(); code != http.StatusForbidden {
		t.Fatalf("answer after withdrawing: %d, want 403", code)
	}
	if state := cw.mcpOK(t, resident, "custody_get_my_consent", base(nil)); state["status"] != "withdrawn" {
		t.Fatalf("resident after withdrawing: %v, want status withdrawn", state)
	}
}

func TestCustodyConsentMCP_AStrangerIsToldInstanceNotFoundOnEveryTool(t *testing.T) {
	cw := newConsentWalk(t)
	for _, name := range consentToolNames {
		args := map[string]any{"instance_id": cw.instance}
		if name == "custody_publish_consent_version" {
			args["text"] = "x"
		}
		cw.mcpRefused(t, "stranger-x", name, args, "instance not found")
	}
}
