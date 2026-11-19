package models

import (
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

var siblingModulesWithOperations = map[string]string{
	"github.com/aosanya/mwanachama-backend-taskmanager": "taskmanager.operations.json",
	"github.com/aosanya/mwanachama-backend-accounting":  "accounting.operations.json",
}

func siblingOperationsFiles(t *testing.T) []string {
	t.Helper()
	var files []string
	for module, file := range siblingModulesWithOperations {
		cmd := exec.Command("go", "list", "-m", "-f", "{{.Dir}}", module)
		cmd.Dir = "../.."
		out, err := cmd.Output()
		if err != nil {
			t.Fatalf("go list -m %s: %v", module, err)
		}
		files = append(files, filepath.Join(strings.TrimSpace(string(out)), file))
	}
	return files
}
