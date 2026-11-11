package routes

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"

	"wakalaserver/modules/shared/dispatch"

	workspace "wakalaserver/modules/workspace"
	"wakalaserver/modules/workspace/models"
)

type shareAuthors struct {
	workspace.WorkspaceManager
	issuedBy string
}

func (s *shareAuthors) IssueShare(_ context.Context, _, _, issuedBy string) (models.Share, string, error) {
	s.issuedBy = issuedBy
	return models.Share{}, "key", nil
}

var theSession = Mount{Caller: func(context.Context) string { return "the-session" }}

func TestAShareIsIssuedByTheCallerNotTheBody(t *testing.T) {
	manager := &shareAuthors{}
	for _, route := range OwnerRoutesFor(manager, theSession) {
		if route.Action != "workspace.share.issue" {
			continue
		}
		req := httptest.NewRequest("POST", "/", strings.NewReader(`{"label":"for the clerk","issued_by":"forged-clerk"}`))
		req.Header.Set("Content-Type", "application/json")
		req.SetPathValue("workbook_id", "w1")
		route.Handler(httptest.NewRecorder(), req)
		if manager.issuedBy != "the-session" {
			t.Errorf("the key names %q as its issuer; want the-session, never the body's forged-clerk", manager.issuedBy)
		}
		return
	}
	t.Fatal("no route for workspace.share.issue")
}

func TestShareToolDoesNotAskForItsIssuer(t *testing.T) {
	manager := &shareAuthors{}
	for _, tool := range ToolsFor(manager, theSession) {
		if tool.Action != "workspace.share.issue" {
			continue
		}
		var schema struct {
			Properties map[string]json.RawMessage `json:"properties"`
		}
		if err := json.Unmarshal(tool.InputSchema, &schema); err != nil {
			t.Fatalf("schema: %v", err)
		}
		if _, asked := schema.Properties["issued_by"]; asked {
			t.Errorf("%s still takes issued_by from the request; the caller signs it", tool.Name)
		}
		if _, err := tool.Handle(context.Background(), dispatch.Request{Arguments: json.RawMessage(`{"workbook_id":"w1","label":"for the clerk"}`)}); err != nil {
			t.Fatalf("%s: %v", tool.Name, err)
		}
		if manager.issuedBy != "the-session" {
			t.Errorf("the key names %q as its issuer; want the-session", manager.issuedBy)
		}
		return
	}
	t.Fatal("no tool for workspace.share.issue")
}
