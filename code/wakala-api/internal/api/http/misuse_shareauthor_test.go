package http

import (
	"context"
	"net/http"
	"testing"

	workspace "wakalaserver/modules/workspace"
	workspacemodels "wakalaserver/modules/workspace/models"
)

type sharesIssued struct {
	workspace.WorkspaceManager
	issuedBy string
}

func (s *sharesIssued) IssueShare(_ context.Context, _, _, issuedBy string) (workspacemodels.Share, string, error) {
	s.issuedBy = issuedBy
	return workspacemodels.Share{IssuedBy: issuedBy}, "key", nil
}

func TestWorkspaceShare_AKeyNamesTheSignedInOwnerNotTheBody(t *testing.T) {
	w := newStepRunWalk(t, nil)
	manager := &sharesIssued{}
	w.deps.Workspace = manager
	w.handler = NewRouter(w.deps)
	rec := w.call(t, "POST", "/workspace/workbooks/w1/shares", map[string]any{"label": "for the clerk", "issued_by": "forged-keeper"}, w.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("owner shares a workbook with a forged issued_by: %d %s, want 201", rec.Code, rec.Body.String())
	}
	if manager.issuedBy != "test-owner" {
		t.Errorf("the key names %q as its issuer; want the signed-in test-owner, never the body's forged-keeper", manager.issuedBy)
	}
}
