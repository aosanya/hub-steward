package http

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

const initializeBody = `{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"lazy","version":"1"}}}`

func countMCPServerBuilds(t *testing.T) *atomic.Int64 {
	t.Helper()
	var builds atomic.Int64
	original := buildMCPServer
	buildMCPServer = func(d *Deps) *mcp.Server {
		builds.Add(1)
		return original(d)
	}
	t.Cleanup(func() { buildMCPServer = original })
	return &builds
}

func initializeOverMCP(server *httptest.Server, cookie *http.Cookie) (int, error) {
	req, err := http.NewRequest(http.MethodPost, server.URL+mcpPath, strings.NewReader(initializeBody))
	if err != nil {
		return 0, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json, text/event-stream")
	req.AddCookie(cookie)
	resp, err := server.Client().Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	return resp.StatusCode, nil
}

func readGolden(t *testing.T, name string) []string {
	t.Helper()
	raw, err := os.ReadFile(filepath.Join("testdata", "mcp_lazy", name))
	if err != nil {
		t.Fatalf("read golden %s: %v", name, err)
	}
	return strings.Fields(string(raw))
}

func TestNewRouterReturnsWithoutBuildingTheMCPServer(t *testing.T) {
	deps, _ := stepRunDeps(t, stepRunDB(t))
	builds := countMCPServerBuilds(t)

	NewRouter(deps)

	if got := builds.Load(); got != 0 {
		t.Fatalf("NewRouter built the MCP server %d times, want 0", got)
	}
}

func TestMCPServerIsNotBuiltByRequestsThatNeverReachIt(t *testing.T) {
	builds := countMCPServerBuilds(t)
	w := newToolListWalk(t)

	status, err := initializeOverMCP(w.server, &http.Cookie{Name: "none", Value: "none"})
	if err != nil {
		t.Fatalf("anonymous initialize: %v", err)
	}
	if status != http.StatusUnauthorized {
		t.Fatalf("anonymous initialize over /mcp: %d, want 401", status)
	}
	if got := builds.Load(); got != 0 {
		t.Fatalf("setting up a walk and refusing an anonymous request built the MCP server %d times, want 0", got)
	}
}

func TestTwentyConcurrentFirstMCPRequestsBuildTheServerOnce(t *testing.T) {
	builds := countMCPServerBuilds(t)
	w := newToolListWalk(t)
	if got := builds.Load(); got != 0 {
		t.Fatalf("walk setup built the MCP server %d times before any /mcp request, want 0", got)
	}

	const callers = 20
	statuses := make([]int, callers)
	failures := make([]error, callers)
	start := make(chan struct{})
	var wg sync.WaitGroup
	for i := range callers {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			statuses[i], failures[i] = initializeOverMCP(w.server, w.owner)
		}()
	}
	close(start)
	wg.Wait()

	for i := range callers {
		if failures[i] != nil {
			t.Fatalf("caller %d: %v", i, failures[i])
		}
		if statuses[i] != http.StatusOK {
			t.Errorf("caller %d initialize over /mcp: %d, want 200", i, statuses[i])
		}
	}
	const fullServerPlusTheOwnersFilteredServer = 2
	if got := builds.Load(); got != fullServerPlusTheOwnersFilteredServer {
		t.Fatalf("%d concurrent first requests built the MCP server %d times, want %d", callers, got, fullServerPlusTheOwnersFilteredServer)
	}
}

func TestTwentyConcurrentCallersOfTheFullServerShareOneBuild(t *testing.T) {
	deps, _ := stepRunDeps(t, stepRunDB(t))
	builds := countMCPServerBuilds(t)
	servers := newMCPServers(deps)
	if got := builds.Load(); got != 0 {
		t.Fatalf("newMCPServers built the MCP server %d times, want 0", got)
	}

	const callers = 20
	seen := make([]*mcp.Server, callers)
	start := make(chan struct{})
	var wg sync.WaitGroup
	for i := range callers {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			seen[i] = servers.fullServer()
		}()
	}
	close(start)
	wg.Wait()

	if got := builds.Load(); got != 1 {
		t.Fatalf("%d concurrent callers built the full MCP server %d times, want 1", callers, got)
	}
	for i, server := range seen {
		if server != seen[0] {
			t.Fatalf("caller %d got a different server from caller 0", i)
		}
	}
}

func TestMCPToolListOverTheRouterIsTheGoldenFromBeforeTheLazyBuild(t *testing.T) {
	w := newToolListWalk(t)
	for name, cookie := range map[string]*http.Cookie{"owner-tools.txt": w.owner, "agent-tools.txt": w.agent} {
		want := readGolden(t, name)
		got := w.toolsSeenBy(t, cookie)
		if !slices.Equal(got, want) {
			t.Errorf("%s: tool list changed: %d tools now, %d in the golden; added %v, removed %v", name, len(got), len(want), addedTo(want, got), addedTo(got, want))
		}
	}
}
