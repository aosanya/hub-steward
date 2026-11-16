package agencies

import (
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func agencyGit(t *testing.T, dir string, args ...string) (string, error) {
	t.Helper()
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	cmd.Env = append(cmd.Environ(),
		"GIT_CONFIG_GLOBAL=/dev/null",
		"GIT_CONFIG_SYSTEM=/dev/null",
		"GIT_AUTHOR_NAME=Agency Test",
		"GIT_AUTHOR_EMAIL=agency@example.com",
		"GIT_COMMITTER_NAME=Agency Test",
		"GIT_COMMITTER_EMAIL=agency@example.com",
		"GIT_TERMINAL_PROMPT=0",
	)
	out, err := cmd.CombinedOutput()
	return strings.TrimSpace(string(out)), err
}

func mustAgencyGit(t *testing.T, dir string, args ...string) string {
	t.Helper()
	out, err := agencyGit(t, dir, args...)
	if err != nil {
		t.Fatalf("git %s: %v\n%s", strings.Join(args, " "), err, out)
	}
	return out
}

func TestGitFolder_SmartHTTPServesEachRepositoryFileByNameAndRefusesTheDefaultBranch(t *testing.T) {
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("no git binary on PATH")
	}
	f := newGitFolderFixture(t, 4)
	harvest, harvestMain := f.initRepo(t, "harvest")
	f.writeAndMerge(t, harvest, harvestMain, "plan.md", "plant in march\n")
	other, otherMain := f.initRepo(t, "orchard")
	f.writeAndMerge(t, other, otherMain, "trees.md", "apples\n")

	srv := httptest.NewServer(f.routed.SmartHTTPHandler())
	t.Cleanup(srv.Close)

	parent := t.TempDir()
	mustAgencyGit(t, parent, "clone", srv.URL+"/harvest.git", "first")
	first := filepath.Join(parent, "first")
	if data, err := os.ReadFile(filepath.Join(first, "plan.md")); err != nil || string(data) != "plant in march\n" {
		t.Fatalf("harvest clone plan.md = %q, %v", data, err)
	}
	if _, err := os.Stat(filepath.Join(first, "trees.md")); err == nil {
		t.Error("the harvest clone holds a file of the orchard repository")
	}

	mustAgencyGit(t, first, "checkout", "-b", "topic")
	if err := os.WriteFile(filepath.Join(first, "notes.md"), []byte("notes\n"), 0o644); err != nil {
		t.Fatalf("write notes.md: %v", err)
	}
	mustAgencyGit(t, first, "add", "notes.md")
	mustAgencyGit(t, first, "commit", "-m", "notes")
	tip := mustAgencyGit(t, first, "rev-parse", "HEAD")
	mustAgencyGit(t, first, "push", "origin", "topic")

	mustAgencyGit(t, parent, "clone", "--branch", "topic", srv.URL+"/harvest.git", "second")
	second := filepath.Join(parent, "second")
	if got := mustAgencyGit(t, second, "rev-parse", "HEAD"); got != tip {
		t.Errorf("second clone HEAD = %q, want %q", got, tip)
	}
	for path, want := range map[string]string{"plan.md": "plant in march\n", "notes.md": "notes\n"} {
		if data, err := os.ReadFile(filepath.Join(second, path)); err != nil || string(data) != want {
			t.Errorf("second clone %s = %q, %v, want %q", path, data, err, want)
		}
	}

	mustAgencyGit(t, first, "checkout", "main")
	mustAgencyGit(t, first, "commit", "--allow-empty", "-m", "straight to main")
	out, err := agencyGit(t, first, "push", "origin", "main")
	if err == nil {
		t.Fatalf("push of a changed default branch succeeded:\n%s", out)
	}
	if !strings.Contains(out, "push to a merge request, not to the default branch") {
		t.Errorf("refusal did not carry the plain message:\n%s", out)
	}

	if out, err := agencyGit(t, parent, "clone", srv.URL+"/missing.git", "third"); err == nil || !strings.Contains(out, "not found") {
		t.Errorf("clone of an unknown repository = %v, %q, want a not found refusal", err, out)
	}
}
