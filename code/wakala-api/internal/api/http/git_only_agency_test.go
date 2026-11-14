package http

import (
	"testing"
)

func TestAnAgencyThatRunsGitWithoutFormsListsGitAmongItsMounts(t *testing.T) {
	w := residentGateWalk(t)
	runsModules(t, w.instance, "comm", "taskmanager", "git", "catalog")

	view, err := w.deps.agencyMounts(asPerson("test-owner"), w.deps.Registry, w.instance)
	if err != nil {
		t.Fatalf("the owner lists the mounts: %v", err)
	}
	for _, module := range view.Modules {
		if module.Module == "git" {
			return
		}
	}
	t.Fatalf("an agency that runs git lists no git mount, listed %v", view.Modules)
}

func TestTheOwnerOfAnAgencyThatRunsGitWithoutFormsSeesTheRepositoryTools(t *testing.T) {
	w := newToolListWalk(t)
	runsModules(t, w.instance, "comm", "taskmanager", "git", "catalog")

	seen := w.toolsSeenBy(t, w.owner)

	for _, want := range []string{"forms_git_repository_list", "forms_git_repository_init", "forms_git_file_read"} {
		if !contains(seen, want) {
			t.Errorf("the owner of an agency that runs git sees no %s", want)
		}
	}
	if leaked := moduleToolsOutside(seen, "comm", "taskmanager", "git", "catalog", "forms"); len(leaked) != 0 {
		t.Errorf("an agency without forms sees %d tools of modules that are off, first %v", len(leaked), firstFive(leaked))
	}
}

func TestTheOwnerOfAnAgencyWithGitOffSeesNoRepositoryTool(t *testing.T) {
	w := newToolListWalk(t)
	runsModules(t, w.instance, "comm", "taskmanager")

	seen := w.toolsSeenBy(t, w.owner)

	if contains(seen, "forms_git_repository_list") {
		t.Error("an agency with git off sees forms_git_repository_list")
	}
}
