package http

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sort"
	"strings"
	"testing"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	"wakalaserver/modules/agency/models"
)

type sessionCookie struct{ cookie *http.Cookie }

func (s sessionCookie) RoundTrip(r *http.Request) (*http.Response, error) {
	r = r.Clone(r.Context())
	r.AddCookie(s.cookie)
	return http.DefaultTransport.RoundTrip(r)
}

type toolListWalk struct {
	designAgentWalk
	server *httptest.Server
}

func newToolListWalk(t *testing.T) toolListWalk {
	t.Helper()
	w := newDesignAgentWalk(t)
	server := httptest.NewServer(w.handler)
	t.Cleanup(server.Close)
	return toolListWalk{designAgentWalk: w, server: server}
}

func (w toolListWalk) toolsSeenBy(t *testing.T, cookie *http.Cookie) []string {
	t.Helper()
	ctx := context.Background()
	transport := &mcp.StreamableClientTransport{
		Endpoint:   w.server.URL + mcpPath,
		HTTPClient: &http.Client{Transport: sessionCookie{cookie: cookie}},
	}
	session, err := mcp.NewClient(&mcp.Implementation{Name: "tool-list", Version: "1"}, nil).Connect(ctx, transport, nil)
	if err != nil {
		t.Fatalf("connect over /mcp: %v", err)
	}
	t.Cleanup(func() { session.Close() })
	var names []string
	for tool, err := range session.Tools(ctx, nil) {
		if err != nil {
			t.Fatalf("list tools: %v", err)
		}
		names = append(names, tool.Name)
	}
	sort.Strings(names)
	return names
}

func moduleOf(toolName string) string {
	module, _, _ := strings.Cut(toolName, "_")
	if _, ok := models.CatalogEntry(module); ok {
		return module
	}
	return ""
}

func modulesOf(names []string) map[string]int {
	out := map[string]int{}
	for _, name := range names {
		if module := moduleOf(name); module != "" {
			out[module]++
		}
	}
	return out
}

func moduleToolsOutside(names []string, allowed ...string) []string {
	keep := map[string]bool{}
	for _, module := range allowed {
		keep[module] = true
	}
	var out []string
	for _, name := range names {
		if module := moduleOf(name); module != "" && !keep[module] && !toolsOfNoModule[name] {
			out = append(out, name)
		}
	}
	return out
}

func firstFive(names []string) []string {
	return names[:min(5, len(names))]
}

func contains(names []string, want string) bool {
	for _, name := range names {
		if name == want {
			return true
		}
	}
	return false
}

func total(counts map[string]int) int {
	n := 0
	for _, c := range counts {
		n += c
	}
	return n
}

func TestToolList_ASignedInStrangerSeesNoModuleTool(t *testing.T) {
	w := newToolListWalk(t)

	seen := w.toolsSeenBy(t, w.cookieFor(t, "stranger-with-no-agency"))

	if leaked := moduleToolsOutside(seen); len(leaked) != 0 {
		t.Fatalf("a stranger with no agency sees %d module tools, first %v", len(leaked), firstFive(leaked))
	}
}

func TestToolList_AStrangerStillSeesTheToolsThatRegisterAnAgency(t *testing.T) {
	w := newToolListWalk(t)

	seen := w.toolsSeenBy(t, w.cookieFor(t, "stranger-with-no-agency"))

	for _, want := range []string{"agency_create_instance", "agency_list_instances"} {
		if !contains(seen, want) {
			t.Errorf("a stranger cannot see %s", want)
		}
	}
}

func TestToolList_TheOwnerOfAnAgencyWithEveryModuleOnSeesEveryModuleTool(t *testing.T) {
	w := newToolListWalk(t)
	var every []string
	for _, entry := range models.ModuleCatalog {
		every = append(every, entry.Code)
	}
	runsModules(t, w.instance, every...)
	all, err := w.deps.listServerTools(context.Background())
	if err != nil {
		t.Fatalf("list server tools: %v", err)
	}

	seen := w.toolsSeenBy(t, w.owner)

	if got := total(modulesOf(seen)); got != len(all) {
		t.Fatalf("owner sees %d module tools, the server has %d", got, len(all))
	}
}

func TestToolList_TheOwnerOfAnAgencyWithOnlyFormsOnSeesNoMarketTool(t *testing.T) {
	w := newToolListWalk(t)
	runsModules(t, w.instance, "forms")

	seen := w.toolsSeenBy(t, w.owner)

	if leaked := moduleToolsOutside(seen, "forms"); len(leaked) != 0 {
		t.Fatalf("owner of an agency with only forms on sees %d tools of modules that are off, first %v", len(leaked), firstFive(leaked))
	}
	if modulesOf(seen)["forms"] == 0 {
		t.Fatalf("owner of an agency with forms on sees no forms tool")
	}
}

func TestToolList_AnAgentSeesOnlyTheModulesItsAgencyHasOn(t *testing.T) {
	w := newToolListWalk(t)
	runsModules(t, w.instance, "forms", "market")
	w.deps.rolePermissionsOverride = func(context.Context, string) ([]string, error) {
		return []string{"form.answer"}, nil
	}

	seen := w.toolsSeenBy(t, w.agent)

	if leaked := moduleToolsOutside(seen, "forms"); len(leaked) != 0 {
		t.Fatalf("an agent whose role holds only form.answer sees %d tools beyond forms, first %v", len(leaked), firstFive(leaked))
	}
	if modulesOf(seen)["forms"] == 0 {
		t.Fatalf("an agent whose role holds form.answer sees no forms tool")
	}
}

func TestToolList_AnAgentOfAnAgencyWithoutTheModuleSeesNoToolOfIt(t *testing.T) {
	w := newToolListWalk(t)
	runsModules(t, w.instance, "forms")
	w.deps.rolePermissionsOverride = func(context.Context, string) ([]string, error) {
		return []string{"form.answer", "report.publish"}, nil
	}

	seen := w.toolsSeenBy(t, w.agent)

	if got := modulesOf(seen)["market"]; got != 0 {
		t.Fatalf("an agent whose agency has market off sees %d market tools", got)
	}
}

func TestToolList_AnAgentWithNoPermissionSeesNoModuleTool(t *testing.T) {
	w := newToolListWalk(t)
	w.deps.rolePermissionsOverride = func(context.Context, string) ([]string, error) { return nil, nil }

	seen := w.toolsSeenBy(t, w.agent)

	if leaked := moduleToolsOutside(seen); len(leaked) != 0 {
		t.Fatalf("an agent whose role holds no permission sees %d module tools, first %v", len(leaked), firstFive(leaked))
	}
}

func TestToolList_AResidentSeesOnlyTheModulesTheirAgencyHasOn(t *testing.T) {
	w := newToolListWalk(t)
	runsModules(t, w.instance, "forms")
	if err := w.deps.Registry.AddMember(context.Background(), w.instance, "resident-of-forms-only", "resident"); err != nil {
		t.Fatalf("AddMember resident: %v", err)
	}

	seen := w.toolsSeenBy(t, w.cookieFor(t, "resident-of-forms-only"))

	if leaked := moduleToolsOutside(seen, "forms"); len(leaked) != 0 {
		t.Fatalf("a resident of an agency with only forms on sees %d tools of modules that are off, first %v", len(leaked), firstFive(leaked))
	}
	if modulesOf(seen)["forms"] == 0 {
		t.Fatalf("a resident of an agency with forms on sees no forms tool")
	}
}
