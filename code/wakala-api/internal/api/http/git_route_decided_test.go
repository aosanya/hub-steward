package http

import (
	"context"
	"encoding/json"
	"net/http"
	"net/url"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

const orchardOwnerAccount = "orchard-owner"

func (m mountedGit) cookieFor(t *testing.T, account string) *http.Cookie {
	t.Helper()
	session, err := m.deps.Sessions.Mint(context.Background(), account, time.Hour)
	if err != nil {
		t.Fatalf("mint session for %s: %v", account, err)
	}
	return &http.Cookie{Name: sessionCookieName, Value: session.Token}
}

func (m mountedGit) send(t *testing.T, method, path string, body string, as *http.Cookie) (int, map[string]any) {
	t.Helper()
	req, err := http.NewRequest(method, m.server.URL+path, strings.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(as)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("%s %s: %v", method, path, err)
	}
	defer resp.Body.Close()
	var decoded map[string]any
	_ = json.NewDecoder(resp.Body).Decode(&decoded)
	return resp.StatusCode, decoded
}

func (m mountedGit) mintAgencyKey(t *testing.T, agency, owner, name string) string {
	t.Helper()
	code, body := m.send(t, http.MethodPost, "/instances/"+agency+"/api-keys", `{"name":"`+name+`"}`, m.cookieFor(t, owner))
	token, _ := body["token"].(string)
	if code != http.StatusCreated || token == "" {
		t.Fatalf("POST /instances/%s/api-keys = %d %v, want 201 with a token", agency, code, body)
	}
	return token
}

func (m mountedGit) remoteWith(agency, token string) string {
	base, _ := url.Parse(m.server.URL)
	base.User = url.UserPassword("me", token)
	return base.String() + "/git/" + agency + "/harvest.git"
}

func (m mountedGit) refsStatus(t *testing.T, agency, token string) int {
	t.Helper()
	req, err := http.NewRequest(http.MethodGet, m.server.URL+"/git/"+agency+"/harvest.git/info/refs?service=git-upload-pack", nil)
	if err != nil {
		t.Fatal(err)
	}
	req.SetBasicAuth("me", token)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	return resp.StatusCode
}

func (m mountedGit) addOrchard(t *testing.T) string {
	t.Helper()
	ctx := context.Background()
	orchard, err := m.deps.Registry.CreateInstance(ctx, "Orchard")
	if err != nil {
		t.Fatalf("CreateInstance Orchard: %v", err)
	}
	if err := m.deps.Registry.AddMember(ctx, orchard.ID, orchardOwnerAccount, agencies.RoleOwner); err != nil {
		t.Fatalf("AddMember Orchard owner: %v", err)
	}
	runsModules(t, orchard.ID, "git")
	seedHarvest(t, m.deps.Registry, orchard.ID)
	return orchard.ID
}

func TestDecidedGitKeys_ARealAgencyKeyClonesAndPushesInItsAgencyAndIsRefused404InAnother(t *testing.T) {
	m := newMountedGit(t)
	orchard := m.addOrchard(t)
	farmKey := m.mintAgencyKey(t, m.agency, mountedWriterAccount, "farm bot")
	orchardKey := m.mintAgencyKey(t, orchard, orchardOwnerAccount, "orchard bot")

	parent := t.TempDir()
	mustRunGit(t, parent, "clone", m.remoteWith(m.agency, farmKey), "farm")
	farm := filepath.Join(parent, "farm")
	mustRunGit(t, farm, "checkout", "-b", "bot-topic")
	commitFile(t, farm, "bot.md", []byte("from the bot\n"))
	mustRunGit(t, farm, "push", "origin", "bot-topic")

	mustRunGit(t, parent, "clone", m.remoteWith(orchard, orchardKey), "orchard")

	if code := m.refsStatus(t, m.agency, farmKey); code != http.StatusOK {
		t.Errorf("the Farm key in Farm = %d, want 200", code)
	}
	if code := m.refsStatus(t, orchard, farmKey); code != http.StatusNotFound {
		t.Errorf("the Farm key in Orchard = %d, want 404", code)
	}
	farmKeyAccount, err := m.deps.APIKeys.Verify(context.Background(), farmKey)
	if err != nil {
		t.Fatalf("Verify the Farm key: %v", err)
	}
	if err := m.deps.Registry.AddMember(context.Background(), orchard, farmKeyAccount.AccountID, agencies.RoleAgent); err != nil {
		t.Fatalf("AddMember the Farm key's account to Orchard: %v", err)
	}
	if code := m.refsStatus(t, orchard, farmKey); code != http.StatusNotFound {
		t.Errorf("the Farm key in Orchard after its account joined Orchard = %d, want 404", code)
	}
	if code := m.refsStatus(t, m.agency, orchardKey); code != http.StatusNotFound {
		t.Errorf("the Orchard key in Farm = %d, want 404", code)
	}
	out, err := runGit(t, parent, "clone", m.remoteWith(orchard, farmKey), "crossed")
	if err == nil {
		t.Fatalf("the Farm key cloned Orchard:\n%s", out)
	}
	if !strings.Contains(out, "not found") {
		t.Errorf("the refusal in Orchard was not a 404:\n%s", out)
	}
	out, err = runGit(t, farm, "push", m.remoteWith(orchard, farmKey), "bot-topic")
	if err == nil {
		t.Fatalf("the Farm key pushed to Orchard:\n%s", out)
	}
	if !strings.Contains(out, "not found") {
		t.Errorf("the push refusal in Orchard was not a 404:\n%s", out)
	}
}

func TestDecidedGitKeys_AMemberRemovedFromTheAgencyCannotCloneOnTheNextRequest(t *testing.T) {
	m := newMountedGit(t)
	parent := t.TempDir()
	token := m.tokens[mountedReaderAccount]
	mustRunGit(t, parent, "clone", m.remoteWith(m.agency, token), "before")
	if code := m.refsStatus(t, m.agency, token); code != http.StatusOK {
		t.Fatalf("the member's key before the removal = %d, want 200", code)
	}

	if err := m.deps.Registry.RemoveMember(context.Background(), m.agency, mountedReaderAccount); err != nil {
		t.Fatalf("RemoveMember: %v", err)
	}

	if code := m.refsStatus(t, m.agency, token); code != http.StatusNotFound {
		t.Errorf("the removed member's key = %d, want 404", code)
	}
	out, err := runGit(t, parent, "clone", m.remoteWith(m.agency, token), "after")
	if err == nil {
		t.Fatalf("a removed member cloned:\n%s", out)
	}
	before := filepath.Join(parent, "before")
	mustRunGit(t, before, "checkout", "-b", "late-topic")
	commitFile(t, before, "late.md", []byte("late\n"))
	if out, err := runGit(t, before, "push", "origin", "late-topic"); err == nil {
		t.Errorf("a removed member pushed:\n%s", out)
	}
}

func TestDecidedGitKeys_AKeyRevokedThroughDeleteAuthApiKeysIsAnswered401OnTheNextGitRequest(t *testing.T) {
	m := newMountedGit(t)
	owner := m.cookieFor(t, mountedWriterAccount)
	code, minted := m.send(t, http.MethodPost, "/auth/api-keys", `{"name":"laptop"}`, owner)
	token, _ := minted["token"].(string)
	id, _ := minted["id"].(string)
	if code != http.StatusCreated || token == "" || id == "" {
		t.Fatalf("POST /auth/api-keys = %d %v", code, minted)
	}
	parent := t.TempDir()
	mustRunGit(t, parent, "clone", m.remoteWith(m.agency, token), "before")
	if status := m.refsStatus(t, m.agency, token); status != http.StatusOK {
		t.Fatalf("the key before the revoke = %d, want 200", status)
	}

	if status, _ := m.send(t, http.MethodDelete, "/auth/api-keys/"+id, "", owner); status != http.StatusNoContent {
		t.Fatalf("DELETE /auth/api-keys/%s = %d, want 204", id, status)
	}

	if status := m.refsStatus(t, m.agency, token); status != http.StatusUnauthorized {
		t.Errorf("the revoked key = %d, want 401", status)
	}
	out, err := runGit(t, parent, "clone", m.remoteWith(m.agency, token), "after")
	if err == nil {
		t.Fatalf("a revoked key cloned:\n%s", out)
	}
	if !strings.Contains(out, "401") && !strings.Contains(out, "Authentication failed") {
		t.Errorf("the refusal of a revoked key was not a 401:\n%s", out)
	}
}

func (m mountedGit) mcpAs(t *testing.T, account string) *mcp.ClientSession {
	t.Helper()
	ctx := accounts.WithID(t.Context(), account)
	serverSide, clientSide := mcp.NewInMemoryTransports()
	session, err := newMCPServer(m.deps).Connect(ctx, serverSide, nil)
	if err != nil {
		t.Fatalf("connect server: %v", err)
	}
	t.Cleanup(func() { session.Close() })
	client, err := mcp.NewClient(&mcp.Implementation{Name: "decided", Version: "1"}, nil).Connect(ctx, clientSide, nil)
	if err != nil {
		t.Fatalf("connect client: %v", err)
	}
	t.Cleanup(func() { client.Close() })
	return client
}

func callGitTool(t *testing.T, client *mcp.ClientSession, tool string, args map[string]any) map[string]any {
	t.Helper()
	out, err := client.CallTool(t.Context(), &mcp.CallToolParams{Name: tool, Arguments: args})
	if err != nil {
		t.Fatalf("call %s: %v", tool, err)
	}
	if out.IsError {
		t.Fatalf("%s: %s", tool, toolErrorText(out))
	}
	structured, _ := out.StructuredContent.(map[string]any)
	return structured
}

func TestDecidedGitMerge_APushedBranchOpenedAsAMergeRequestThroughMCPAndMergedReachesMain(t *testing.T) {
	m := newMountedGit(t)
	parent := t.TempDir()
	mustRunGit(t, parent, "clone", m.remote(m.server, mountedWriterAccount), "work")
	work := filepath.Join(parent, "work")
	mustRunGit(t, work, "checkout", "-b", "feature")
	commitFile(t, work, "calendar.md", []byte("sow in april\n"))
	commitFile(t, work, "tools.md", []byte("spade\n"))
	mustRunGit(t, work, "push", "origin", "feature")

	ctx := context.Background()
	gm, err := m.deps.Registry.GitManager(ctx, m.agency)
	if err != nil {
		t.Fatalf("GitManager: %v", err)
	}
	repos, err := gm.ListRepositories(ctx)
	if err != nil || len(repos) != 1 {
		t.Fatalf("ListRepositories = %v, %v", repos, err)
	}
	feature, err := gm.GetBranchByName(ctx, repos[0].ID, "feature")
	if err != nil {
		t.Fatalf("the pushed branch has no row: %v", err)
	}

	client := m.mcpAs(t, mountedWriterAccount)
	opened := callGitTool(t, client, "forms_git_merge_request_create", map[string]any{
		"instance_id":      m.agency,
		"repository_id":    repos[0].ID,
		"title":            "calendar and tools",
		"source_branch_id": feature.ID,
	})
	mrID, _ := opened["id"].(string)
	if mrID == "" {
		t.Fatalf("the merge request carries no id: %v", opened)
	}
	merged := callGitTool(t, client, "forms_git_merge_request_complete", map[string]any{"instance_id": m.agency, "mrID": mrID})
	if merged["status"] != "merged" {
		t.Fatalf("merge request after complete = %v, want status merged", merged)
	}

	fresh := t.TempDir()
	mustRunGit(t, fresh, "clone", m.remote(m.server, mountedWriterAccount), "main")
	for name, want := range map[string]string{"plan.md": "plant in march\n", "calendar.md": "sow in april\n", "tools.md": "spade\n"} {
		got := mustRunGit(t, filepath.Join(fresh, "main"), "show", "HEAD:"+name)
		if got != strings.TrimSuffix(want, "\n") {
			t.Errorf("main %s = %q, want %q", name, got, want)
		}
	}
}
