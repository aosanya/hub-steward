package http

import (
	"strings"
	"testing"
)

func TestGitMCP_ACallerMistakeIsNamedNotCalledAnInternalError(t *testing.T) {
	w := designAgentWalk{stepRunWalk: newStepRunWalk(t, nil)}

	cases := []struct {
		name string
		tool string
		args map[string]any
		want string
	}{
		{"blob search with no query", "forms_git_blob_search", map[string]any{"instance_id": w.instance}, "query"},
		{"fetch of a branch that does not exist", "forms_git_fetch_start", map[string]any{"instance_id": w.instance, "branchID": "no-such-branch"}, "branch"},
		{"merge request with no title", "forms_git_merge_request_create", map[string]any{"instance_id": w.instance, "source_branch_id": "b-1", "repository_id": "r-1"}, "title"},
		{"merge request with no source branch", "forms_git_merge_request_create", map[string]any{"instance_id": w.instance, "title": "Add a page", "repository_id": "r-1"}, "source"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			out := w.mcpCall(t, "test-owner", c.tool, c.args)
			if !out.IsError {
				t.Fatalf("%s answered without an error", c.tool)
			}
			text := toolErrorText(out)
			if strings.Contains(text, "internal error") {
				t.Errorf("%s: %q calls a caller's mistake an internal error", c.tool, text)
			}
			if !strings.Contains(strings.ToLower(text), c.want) {
				t.Errorf("%s: %q does not name %q", c.tool, text, c.want)
			}
		})
	}
}
