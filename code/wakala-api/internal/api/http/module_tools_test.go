package http

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	"wakalaserver/modules/agency/models"
)

func runsModules(t *testing.T, instance string, codes ...string) {
	t.Helper()
	set := mountedSet{modules: map[string]bool{}, mounts: map[string][]models.ModuleMount{}}
	for _, code := range codes {
		set.modules[code] = true
	}
	agencyMountedSets.put(instance, set)
	t.Cleanup(func() { agencyMountedSets.forget(instance) })
}

func moduleToolsOf(t *testing.T, w stepRunWalk, path string) []moduleToolView {
	t.Helper()
	rec := w.call(t, "GET", path, nil, w.owner)
	if rec.Code != http.StatusOK {
		t.Fatalf("GET %s = %d %s", path, rec.Code, rec.Body)
	}
	var view agencyModuleToolsView
	if err := json.Unmarshal(rec.Body.Bytes(), &view); err != nil {
		t.Fatalf("GET %s body %q: %v", path, rec.Body, err)
	}
	return view.Tools
}

func TestModuleToolsListsOnlyTheToolsOfTheModulesTheAgencyHasOn(t *testing.T) {
	w := newStepRunWalk(t, nil)
	runsModules(t, w.instance, "market", "forms")
	tools := moduleToolsOf(t, w, "/instances/"+w.instance+"/module-tools")

	byModule := map[string]int{}
	for _, tool := range tools {
		byModule[tool.Module]++
		if tool.Description == "" || strings.Contains(tool.Description, "\n") {
			t.Errorf("%s has description %q, want one line", tool.Name, tool.Description)
		}
		if !strings.HasPrefix(tool.Name, tool.Module+"_") {
			t.Errorf("%s is listed under module %s", tool.Name, tool.Module)
		}
	}
	for module := range byModule {
		if module != "market" && module != "forms" {
			t.Errorf("a tool of module %s is listed while it is off", module)
		}
	}
	if len(tools) == 0 {
		t.Fatalf("no tools listed for market and forms")
	}
}

func TestModuleToolsFollowsTheModulesThatAreSwitchedOn(t *testing.T) {
	w := newStepRunWalk(t, nil)
	runsModules(t, w.instance, "forms")
	path := "/instances/" + w.instance + "/module-tools"
	for _, tool := range moduleToolsOf(t, w, path) {
		if tool.Module != "forms" {
			t.Fatalf("with only forms on, %s is listed under %s", tool.Name, tool.Module)
		}
	}
	runsModules(t, w.instance, "forms", "market")
	seen := map[string]bool{}
	for _, tool := range moduleToolsOf(t, w, path) {
		seen[tool.Module] = true
	}
	if !seen["market"] {
		t.Fatalf("market switched on but not listed: %v", seen)
	}
}
