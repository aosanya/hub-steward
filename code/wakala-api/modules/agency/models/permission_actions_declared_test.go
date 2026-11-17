package models

import (
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"testing"
)

var operationActionPattern = regexp.MustCompile(`"action":\s*"([^"]+)"`)

func declaredOperationActions(t *testing.T) map[string]bool {
	t.Helper()
	files, err := filepath.Glob("../../*/*.operations.json")
	if err != nil || len(files) == 0 {
		t.Fatalf("no operations files found: %v", err)
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
