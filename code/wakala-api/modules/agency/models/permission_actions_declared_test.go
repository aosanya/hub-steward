package models

import (
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"testing"
)

var operationActionPattern = regexp.MustCompile(`"action":\s*"([^"]+)"`)

func importedModuleDirs(t *testing.T) []string {
	t.Helper()
	out, err := exec.Command("go", "list", "-m", "-f", "{{.Path}} {{.Dir}}", "all").Output()
	if err != nil {
		t.Fatalf("listing imported modules: %v", err)
	}
	var dirs []string
	for _, line := range strings.Split(string(out), "\n") {
		path, dir, found := strings.Cut(line, " ")
		if found && dir != "" && strings.HasPrefix(path, "github.com/aosanya/mwanachama-backend-") {
			dirs = append(dirs, dir)
		}
	}
	return dirs
}

func declaredOperationActions(t *testing.T) map[string]bool {
	t.Helper()
	files, err := filepath.Glob("../../*/*.operations.json")
	if err != nil {
		t.Fatalf("no operations files found: %v", err)
	}
	for _, dir := range importedModuleDirs(t) {
		imported, err := filepath.Glob(filepath.Join(dir, "*.operations.json"))
		if err != nil {
			t.Fatal(err)
		}
		files = append(files, imported...)
	}
	if len(files) == 0 {
		t.Fatal("no operations files found")
	}
	out := map[string]bool{}
	for _, f := range files {
		raw, err := os.ReadFile(f)
		if err != nil {
			t.Fatal(err)
		}
		for _, m := range operationActionPattern.FindAllSubmatch(raw, -1) {
			out[string(m[1])] = true
		}
	}
	return out
}

func requirePermissionCarries(t *testing.T, code string, actions ...string) {
	t.Helper()
	declared := declaredOperationActions(t)
	p, ok := LookupPermission(code)
	if !ok {
		t.Fatalf("catalogue lacks %s", code)
	}
	for _, a := range actions {
		if !declared[a] {
			t.Errorf("%s is named for %s but no operations file declares it", a, code)
		}
		if !slices.Contains(p.Actions, a) {
			t.Errorf("%s lacks action %s, has %v", code, a, p.Actions)
		}
	}
}
