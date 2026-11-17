package http

import (
	"context"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	mwanachamagit "wakalaserver/modules/git"

	"wakalaserver/internal/accounts"
)

type resultsFilesWorld struct {
	acts   roleHolderActs
	branch string
}

func newResultsFilesWorld(t *testing.T) resultsFilesWorld {
	t.Helper()
	return resultsFilesWorld{acts: newRoleHolderActs(t)}
}

func (w resultsFilesWorld) git(t *testing.T) mwanachamagit.GitManager {
	t.Helper()
	gm, err := w.acts.walk.deps.Registry.GitManager(context.Background(), w.acts.walk.instance)
	if err != nil {
		t.Fatalf("GitManager: %v", err)
	}
	return gm
}

func (w *resultsFilesWorld) initReports(t *testing.T) {
	t.Helper()
	repo, err := w.git(t).InitRepo(context.Background(), mwanachamagit.CreateRepoRequest{Name: "reports"})
	if err != nil {
		t.Fatalf("InitRepo: %v", err)
	}
	branch, err := w.git(t).GetBranchByName(context.Background(), repo.ID, repo.DefaultBranch)
	if err != nil {
		t.Fatalf("GetBranchByName: %v", err)
	}
	w.branch = branch.ID
}

func (w resultsFilesWorld) write(t *testing.T, path, content string) string {
	t.Helper()
	commit, err := w.git(t).WriteFile(context.Background(), mwanachamagit.WriteFileRequest{BranchID: w.branch, Path: path, Content: content})
	if err != nil {
		t.Fatalf("WriteFile %s: %v", path, err)
	}
	time.Sleep(1100 * time.Millisecond)
	return commit.SHA
}

func (w resultsFilesWorld) call(t *testing.T, subject, formID string) *mcp.CallToolResult {
	t.Helper()
	ctx := accounts.WithID(context.Background(), subject)
	serverSide, clientSide := mcp.NewInMemoryTransports()
	session, err := newMCPServer(w.acts.walk.deps).Connect(ctx, serverSide, nil)
	if err != nil {
		t.Fatalf("connect server: %v", err)
	}
	t.Cleanup(func() { session.Close() })
	client, err := mcp.NewClient(&mcp.Implementation{Name: "test", Version: "1"}, nil).Connect(ctx, clientSide, nil)
	if err != nil {
		t.Fatalf("connect client: %v", err)
	}
	t.Cleanup(func() { client.Close() })
	out, err := client.CallTool(ctx, &mcp.CallToolParams{Name: resultsFilesTool, Arguments: map[string]any{"instance_id": w.acts.walk.instance, "form_id": formID}})
	if err != nil {
		t.Fatalf("call %s: %v", resultsFilesTool, err)
	}
	return out
}

func (w resultsFilesWorld) items(t *testing.T, subject, formID string) []map[string]any {
	t.Helper()
	out := w.call(t, subject, formID)
	if out.IsError {
		t.Fatalf("%s as %s: %s", resultsFilesTool, subject, toolErrorText(out))
	}
	structured, _ := out.StructuredContent.(map[string]any)
	raw, ok := structured["items"].([]any)
	if !ok {
		t.Fatalf("items = %v, want a list", structured["items"])
	}
	items := make([]map[string]any, len(raw))
	for i, r := range raw {
		items[i], _ = r.(map[string]any)
	}
	return items
}

func (w resultsFilesWorld) subject(t *testing.T, who string) string {
	t.Helper()
	cookies := map[string]*http.Cookie{
		"Director": w.acts.director,
		"Clerk":    w.acts.clerk,
		"Nobody":   w.acts.nobody,
		"owner":    w.acts.walk.owner,
	}
	return w.acts.walk.subjectOf(t, cookies[who])
}

func TestFormsResultsFilesListsEachStoredFileVersionNewestFirst(t *testing.T) {
	w := newResultsFilesWorld(t)
	w.initReports(t)
	form := w.acts.closedID
	first := w.write(t, form+"/ward.md", "draft")
	other := w.write(t, "other-form/ward.md", "not this form")
	second := w.write(t, form+"/summary.md", "summary")
	third := w.write(t, form+"/ward.md", "final")

	got := w.items(t, w.subject(t, "Director"), form)
	wantVersions := []string{third, second, first}
	wantPaths := []string{form + "/ward.md", form + "/summary.md", form + "/ward.md"}
	wantNames := []string{"ward.md", "summary.md", "ward.md"}
	if len(got) != 3 {
		t.Fatalf("items = %v, want 3 (and none from another form's folder %s)", got, other)
	}
	for i, item := range got {
		if item["version"] != wantVersions[i] || item["path"] != wantPaths[i] || item["name"] != wantNames[i] {
			t.Errorf("item %d = %v, want %s %s %s", i, item, wantNames[i], wantPaths[i], wantVersions[i])
		}
		stamp, _ := item["committed_at"].(string)
		if _, err := time.Parse(time.RFC3339, stamp); err != nil {
			t.Errorf("item %d committed_at %q is not RFC3339", i, stamp)
		}
	}
	for i := 1; i < len(got); i++ {
		if got[i-1]["committed_at"].(string) < got[i]["committed_at"].(string) {
			t.Errorf("items %d and %d are not newest first: %v", i-1, i, got)
		}
	}
	if owner := w.items(t, w.subject(t, "owner"), form); len(owner) != 3 {
		t.Errorf("the owner sees %d items, want 3", len(owner))
	}
}

func TestFormsResultsFilesIsEmptyWithoutARepositoryOrAFolder(t *testing.T) {
	w := newResultsFilesWorld(t)
	form := w.acts.closedID
	if got := w.items(t, w.subject(t, "Director"), form); len(got) != 0 {
		t.Fatalf("with no reports repository the director sees %v, want none", got)
	}
	w.initReports(t)
	if got := w.items(t, w.subject(t, "Director"), form); len(got) != 0 {
		t.Fatalf("with an empty repository the director sees %v, want none", got)
	}
	w.write(t, "other-form/ward.md", "elsewhere")
	if got := w.items(t, w.subject(t, "Director"), form); len(got) != 0 {
		t.Errorf("with no folder for the form the director sees %v, want none", got)
	}
	if got := w.items(t, w.subject(t, "Director"), "no-such-form"); len(got) != 0 {
		t.Errorf("for a form the agency does not have the director sees %v, want none", got)
	}
}

func TestFormsResultsFilesRefusesAMemberWithoutReportPublish(t *testing.T) {
	w := newResultsFilesWorld(t)
	w.initReports(t)
	form := w.acts.closedID
	w.write(t, form+"/ward.md", "final")
	for name, subject := range map[string]string{"resident with no role": w.subject(t, "Nobody"), "holder of poll.run": w.subject(t, "Clerk")} {
		out := w.call(t, subject, form)
		if !out.IsError {
			t.Errorf("%s lists report files: %v, want a refusal", name, out.StructuredContent)
			continue
		}
		if text := toolErrorText(out); strings.Contains(text, "ward.md") {
			t.Errorf("%s was refused with %q, which leaks a file name", name, text)
		}
	}
}
