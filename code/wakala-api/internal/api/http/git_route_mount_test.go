package http

import (
	"context"
	"crypto/rand"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
	"wakalaserver/internal/apikeys"
	mwanachamagit "wakalaserver/modules/git"
)

const (
	mountedReaderAccount = "mounted-reader"
	mountedWriterAccount = "mounted-writer"
	defaultBranchRefusal = "push to a merge request, not to the default branch"
)

type readOnlyGitBackend struct {
	depsGitBackend
	readOnly string
}

func (b readOnlyGitBackend) accessIn(ctx context.Context, agency, account string) (gitAccess, error) {
	access, err := b.depsGitBackend.accessIn(ctx, agency, account)
	if account == b.readOnly {
		access.write = false
	}
	return access, err
}

type mountedGit struct {
	deps    *Deps
	agency  string
	tokens  map[string]string
	server  *httptest.Server
	readers *httptest.Server
}

func newMountedGit(t *testing.T) mountedGit {
	t.Helper()
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("no git binary on PATH")
	}
	db := stepRunDB(t)
	deps, registry := stepRunDeps(t, db, agencies.WithGitRepositoryFolder(t.TempDir(), 4))
	keys, err := apikeys.NewManager(db)
	if err != nil {
		t.Fatalf("apikeys.NewManager: %v", err)
	}
	deps.APIKeys = keys

	ctx := context.Background()
	instance, err := registry.CreateInstance(ctx, "Farm")
	if err != nil {
		t.Fatalf("CreateInstance: %v", err)
	}
	for account, role := range map[string]string{mountedWriterAccount: agencies.RoleOwner, mountedReaderAccount: agencies.RoleAgent} {
		if err := registry.AddMember(ctx, instance.ID, account, role); err != nil {
			t.Fatalf("AddMember %s: %v", account, err)
		}
	}
	runsModules(t, instance.ID, "git")
	seedHarvest(t, registry, instance.ID)

	tokens := map[string]string{}
	for _, account := range []string{mountedWriterAccount, mountedReaderAccount} {
		_, token, err := keys.Create(accounts.WithID(ctx, account), "git")
		if err != nil {
			t.Fatalf("mint key for %s: %v", account, err)
		}
		tokens[account] = token
	}

	server := httptest.NewServer(NewRouter(deps))
	t.Cleanup(server.Close)
	readOnlyMux := http.NewServeMux()
	readOnlyMux.Handle(gitRoutePrefix, gitRouteAuth(readOnlyGitBackend{depsGitBackend: depsGitBackend{d: deps}, readOnly: mountedReaderAccount}, deps.GitRoute()))
	readers := httptest.NewServer(readOnlyMux)
	t.Cleanup(readers.Close)
	return mountedGit{deps: deps, agency: instance.ID, tokens: tokens, server: server, readers: readers}
}

func seedHarvest(t *testing.T, registry agencies.Registry, agency string) {
	t.Helper()
	ctx := context.Background()
	manager, err := registry.GitManager(ctx, agency)
	if err != nil {
		t.Fatalf("GitManager: %v", err)
	}
	repo, err := manager.InitRepo(ctx, mwanachamagit.CreateRepoRequest{Name: "harvest"})
	if err != nil {
		t.Fatalf("InitRepo: %v", err)
	}
	main, err := manager.GetBranchByName(ctx, repo.ID, repo.DefaultBranch)
	if err != nil {
		t.Fatalf("GetBranchByName: %v", err)
	}
	work, err := manager.CreateBranch(ctx, mwanachamagit.CreateBranchRequest{RepositoryID: repo.ID, Name: "seed", FromBranchID: main.ID})
	if err != nil {
		t.Fatalf("CreateBranch: %v", err)
	}
	if _, err := manager.WriteFile(ctx, mwanachamagit.WriteFileRequest{BranchID: work.ID, Path: "plan.md", Content: "plant in march\n"}); err != nil {
		t.Fatalf("WriteFile: %v", err)
	}
	if _, err := manager.MergeBranch(ctx, work.ID); err != nil {
		t.Fatalf("MergeBranch: %v", err)
	}
}

func (m mountedGit) remote(server *httptest.Server, account string) string {
	base, _ := url.Parse(server.URL)
	if account != "" {
		base.User = url.UserPassword("me", m.tokens[account])
	}
	return base.String() + "/git/" + m.agency + "/harvest.git"
}

func runGit(t *testing.T, dir string, args ...string) (string, error) {
	t.Helper()
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	cmd.Env = append(cmd.Environ(),
		"GIT_CONFIG_GLOBAL=/dev/null",
		"GIT_CONFIG_SYSTEM=/dev/null",
		"GIT_AUTHOR_NAME=Mount Test",
		"GIT_AUTHOR_EMAIL=mount@example.com",
		"GIT_COMMITTER_NAME=Mount Test",
		"GIT_COMMITTER_EMAIL=mount@example.com",
		"GIT_TERMINAL_PROMPT=0",
	)
	out, err := cmd.CombinedOutput()
	return strings.TrimSpace(string(out)), err
}

func mustRunGit(t *testing.T, dir string, args ...string) string {
	t.Helper()
	out, err := runGit(t, dir, args...)
	if err != nil {
		t.Fatalf("git %s: %v\n%s", strings.Join(args, " "), err, out)
	}
	return out
}

func commitFile(t *testing.T, clone, name string, content []byte) {
	t.Helper()
	if err := os.WriteFile(filepath.Join(clone, name), content, 0o644); err != nil {
		t.Fatalf("write %s: %v", name, err)
	}
	mustRunGit(t, clone, "add", name)
	mustRunGit(t, clone, "commit", "-m", "add "+name)
}

func TestGitMount_NoKeyIsAnswered401WithTheBasicChallenge(t *testing.T) {
	m := newMountedGit(t)
	response, err := http.Get(m.remote(m.server, "") + "/info/refs?service=git-upload-pack")
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", response.StatusCode)
	}
	if got := response.Header.Get("WWW-Authenticate"); got != `Basic realm="hub"` {
		t.Fatalf("challenge = %q", got)
	}
	out, err := runGit(t, t.TempDir(), "clone", m.remote(m.server, ""), "nokey")
	if err == nil {
		t.Fatalf("clone without a key succeeded:\n%s", out)
	}
}

func TestGitMount_AReadersKeyClonesAndItsPushIsRefused403(t *testing.T) {
	m := newMountedGit(t)
	parent := t.TempDir()
	mustRunGit(t, parent, "clone", m.remote(m.readers, mountedReaderAccount), "mine")
	clone := filepath.Join(parent, "mine")
	if data, err := os.ReadFile(filepath.Join(clone, "plan.md")); err != nil || string(data) != "plant in march\n" {
		t.Fatalf("plan.md = %q, %v", data, err)
	}
	mustRunGit(t, clone, "checkout", "-b", "reader-topic")
	commitFile(t, clone, "notes.md", []byte("notes\n"))
	out, err := runGit(t, clone, "push", "origin", "reader-topic")
	if err == nil {
		t.Fatalf("a reader's push succeeded:\n%s", out)
	}
	if !strings.Contains(out, "403") {
		t.Errorf("a reader's push was not refused with 403:\n%s", out)
	}
}

func TestGitMount_AWritersKeyPushesANewBranchAndTheDefaultBranchIsRefused(t *testing.T) {
	m := newMountedGit(t)
	parent := t.TempDir()
	mustRunGit(t, parent, "clone", m.remote(m.server, mountedWriterAccount), "first")
	first := filepath.Join(parent, "first")

	mustRunGit(t, first, "checkout", "-b", "topic")
	commitFile(t, first, "notes.md", []byte("notes\n"))
	tip := mustRunGit(t, first, "rev-parse", "HEAD")
	mustRunGit(t, first, "push", "origin", "topic")

	mustRunGit(t, parent, "clone", "--branch", "topic", m.remote(m.server, mountedWriterAccount), "second")
	second := filepath.Join(parent, "second")
	if got := mustRunGit(t, second, "rev-parse", "HEAD"); got != tip {
		t.Errorf("second clone HEAD = %q, want %q", got, tip)
	}
	for name, want := range map[string]string{"plan.md": "plant in march\n", "notes.md": "notes\n"} {
		if data, err := os.ReadFile(filepath.Join(second, name)); err != nil || string(data) != want {
			t.Errorf("second clone %s = %q, %v, want %q", name, data, err, want)
		}
	}

	mustRunGit(t, first, "checkout", "-")
	mustRunGit(t, first, "commit", "--allow-empty", "-m", "straight to the default branch")
	branch := mustRunGit(t, first, "rev-parse", "--abbrev-ref", "HEAD")
	out, err := runGit(t, first, "push", "origin", branch)
	if err == nil {
		t.Fatalf("a push to the default branch succeeded:\n%s", out)
	}
	if !strings.Contains(out, defaultBranchRefusal) {
		t.Errorf("the refusal did not carry the plain message:\n%s", out)
	}
}

func TestGitMount_ASinglePushBodyOverOneMebibyteIsNotCutByTheJSONBodyLimit(t *testing.T) {
	m := newMountedGit(t)
	parent := t.TempDir()
	mustRunGit(t, parent, "clone", m.remote(m.server, mountedWriterAccount), "big")
	clone := filepath.Join(parent, "big")
	mustRunGit(t, clone, "checkout", "-b", "heavy")
	payload := make([]byte, 3<<20)
	if _, err := rand.Read(payload); err != nil {
		t.Fatal(err)
	}
	commitFile(t, clone, "payload.bin", payload)
	if out, err := runGit(t, clone, "-c", "http.postBuffer=16777216", "push", "origin", "heavy"); err != nil {
		t.Fatalf("push of a 3 MiB file: %v\n%s", err, out)
	}
}

func TestGitMount_TheOtherRoutesStillAnswer(t *testing.T) {
	m := newMountedGit(t)
	response, err := http.Get(m.server.URL + "/healthz")
	if err != nil {
		t.Fatal(err)
	}
	response.Body.Close()
	if response.StatusCode != http.StatusOK {
		t.Errorf("/healthz = %d, want 200", response.StatusCode)
	}
	for _, path := range []string{"/instances", "/mcp"} {
		response, err := http.Get(m.server.URL + path)
		if err != nil {
			t.Fatal(err)
		}
		response.Body.Close()
		if response.StatusCode != http.StatusUnauthorized {
			t.Errorf("%s without a credential = %d, want 401", path, response.StatusCode)
		}
	}
}
