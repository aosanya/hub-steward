package http

import (
	"encoding/json"
	"testing"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

type filingDesk struct {
	designAgentWalk
	form     string
	question string
	resident string
}

func structuredItems(t *testing.T, out *mcp.CallToolResult) []map[string]any {
	t.Helper()
	if out.IsError {
		t.Fatalf("tool answered with an error: %s", toolErrorText(out))
	}
	encoded, err := json.Marshal(out.StructuredContent)
	if err != nil {
		t.Fatalf("structured content does not encode: %v", err)
	}
	var body struct {
		Items []map[string]any `json:"items"`
	}
	if err := json.Unmarshal(encoded, &body); err != nil {
		t.Fatalf("structured content %s does not carry items: %v", encoded, err)
	}
	return body.Items
}

func questionIDOf(t *testing.T, out *mcp.CallToolResult) string {
	t.Helper()
	if out.IsError {
		t.Fatalf("adding the question: %s", toolErrorText(out))
	}
	encoded, err := json.Marshal(out.StructuredContent)
	if err != nil {
		t.Fatalf("structured content does not encode: %v", err)
	}
	var body struct {
		Question struct {
			ID string `json:"id"`
		} `json:"question"`
	}
	if err := json.Unmarshal(encoded, &body); err != nil || body.Question.ID == "" {
		t.Fatalf("structured content %s carries no question id: %v", encoded, err)
	}
	return body.Question.ID
}

func newFilingDesk(t *testing.T) filingDesk {
	t.Helper()
	w := newDesignAgentWalk(t)
	owner := func(tool string, args map[string]any) *mcp.CallToolResult {
		args["instance_id"] = w.instance
		return w.mcpCall(t, "test-owner", tool, args)
	}
	d := filingDesk{designAgentWalk: w}
	d.form = createdIDOf(t, owner("forms_form_create", map[string]any{"title": "Stall licence", "closes_at": "2030-01-01T00:00:00Z"}))
	d.question = questionIDOf(t, owner("forms_question_create", map[string]any{"form_id": d.form, "answer_type": "free_text", "prompt": "Name of the stall", "required": true}))
	desk := createdIDOf(t, owner("actor_create_group", map[string]any{"name": "Market desk"}))
	if out := owner("forms_target_create", map[string]any{"form_id": d.form, "chapter_id": desk}); out.IsError {
		t.Fatalf("aiming the form at the desk: %s", toolErrorText(out))
	}
	if out := owner("forms_form_publish", map[string]any{"form_id": d.form}); out.IsError {
		t.Fatalf("publishing the form: %s", toolErrorText(out))
	}
	d.resident = createdIDOf(t, owner("actor_create_actor", map[string]any{"display_name": "Mama Zawadi"}))
	if out := owner("actor_assign_group", map[string]any{"actor_id": d.resident, "group_id": desk}); out.IsError {
		t.Fatalf("registering the resident in the desk group: %s", toolErrorText(out))
	}
	return d
}

func (d filingDesk) file(t *testing.T, args map[string]any) *mcp.CallToolResult {
	t.Helper()
	args["instance_id"] = d.instance
	args["form_id"] = d.form
	args["answers"] = []map[string]any{{"question_id": d.question, "value_text": "Mandazi stall"}}
	return d.mcpCall(t, "test-owner", "forms_submission_file", args)
}

func TestMountedFormsSubmissionFile_TheOwnerFilesForAResidentAndGetsTheSendBackForThemNotForTheClerk(t *testing.T) {
	d := newFilingDesk(t)

	filed := structuredItems(t, d.file(t, map[string]any{"member_id": d.resident, "channel": "field"}))
	if len(filed) != 1 || filed[0]["member_id"] != d.resident || filed[0]["send_id"] == "" || filed[0]["send_id"] == nil {
		t.Fatalf("filed answers = %+v, want one answer of the resident carrying the send id", filed)
	}

	sends := structuredItems(t, d.mcpCall(t, "test-owner", "forms_submission_list", map[string]any{"instance_id": d.instance, "form_id": d.form, "member_id": d.resident}))
	if len(sends) != 1 {
		t.Fatalf("sends of the resident = %+v, want one", sends)
	}
	send := sends[0]
	if send["id"] != filed[0]["send_id"] || send["member_id"] != d.resident || send["channel"] != "field" || send["collector"] != "test-owner" {
		t.Fatalf("send = %+v, want the filed send of the resident on the field channel collected by test-owner", send)
	}
}

func TestMountedFormsSubmissionFile_AChannelOtherThanPaperOrFieldIsRefused(t *testing.T) {
	d := newFilingDesk(t)

	out := d.file(t, map[string]any{"member_id": d.resident, "channel": "app"})
	if !out.IsError {
		t.Fatalf("filing on the app channel succeeded, want a refusal")
	}
	if sends := structuredItems(t, d.mcpCall(t, "test-owner", "forms_submission_list", map[string]any{"instance_id": d.instance, "form_id": d.form})); len(sends) != 0 {
		t.Fatalf("a refused filing left sends: %+v", sends)
	}
}

func TestMountedFormsSubmissionFile_APersonOutsideTheDeskGroupIsRefused(t *testing.T) {
	d := newFilingDesk(t)
	stranger := createdIDOf(t, d.mcpCall(t, "test-owner", "actor_create_actor", map[string]any{"instance_id": d.instance, "display_name": "Passer By"}))

	if out := d.file(t, map[string]any{"member_id": stranger}); !out.IsError {
		t.Fatalf("filing for a person outside the audience succeeded, want a refusal")
	}
}
