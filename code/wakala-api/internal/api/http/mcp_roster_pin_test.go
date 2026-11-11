package http

import (
	"context"
	"os"
	"path/filepath"
	"slices"
	"sort"
	"strings"
	"testing"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	catalog "wakalaserver/modules/catalog"
	"wakalaserver/modules/shared/spec"
)

const rosterDir = "testdata/mcp_roster"

type optionalMounts struct {
	name    string
	catalog bool
	reports bool
	ai      bool
}

var rosterConfigurations = []optionalMounts{
	{name: "no-mounts"},
	{name: "catalog", catalog: true},
	{name: "reports", reports: true},
	{name: "ai", ai: true},
	{name: "catalog-reports", catalog: true, reports: true},
	{name: "catalog-reports-ai", catalog: true, reports: true, ai: true},
}

var pinnedRosterCounts = map[string]int{
	"no-mounts":          687,
	"catalog":            752,
	"reports":            751,
	"ai":                 721,
	"catalog-reports":    816,
	"catalog-reports-ai": 850,
}

func rosterCatalogManager(t *testing.T, name string) catalog.CatalogManager {
	t.Helper()
	s, err := catalog.SpecFor("roster"+name, "")
	if err != nil {
		t.Fatalf("catalog SpecFor: %v", err)
	}
	db := gateTestDB(t, name)
	if err := spec.Migrate(db, s); err != nil {
		t.Fatalf("catalog Migrate: %v", err)
	}
	manager, err := catalog.NewCatalogManager(db, s)
	if err != nil {
		t.Fatalf("NewCatalogManager: %v", err)
	}
	return manager
}

func rosterFor(t *testing.T, mounts optionalMounts) []string {
	t.Helper()
	deps, _ := stepRunDeps(t, stepRunDB(t))
	if mounts.catalog {
		deps.Catalog = rosterCatalogManager(t, "catalog")
	}
	if mounts.reports {
		deps.Reports = rosterCatalogManager(t, "reports")
	}
	if mounts.ai {
		withAITools(deps)
	}
	ctx := context.Background()
	serverSide, clientSide := mcp.NewInMemoryTransports()
	serverSession, err := newMCPServer(deps).Connect(ctx, serverSide, nil)
	if err != nil {
		t.Fatalf("connect server: %v", err)
	}
	t.Cleanup(func() { serverSession.Close() })
	client, err := mcp.NewClient(&mcp.Implementation{Name: "roster", Version: "1"}, nil).Connect(ctx, clientSide, nil)
	if err != nil {
		t.Fatalf("connect client: %v", err)
	}
	t.Cleanup(func() { client.Close() })
	var names []string
	for tool, err := range client.Tools(ctx, nil) {
		if err != nil {
			t.Fatalf("list tools: %v", err)
		}
		names = append(names, tool.Name)
	}
	sort.Strings(names)
	return names
}

func readRosterFile(t *testing.T, name string) []string {
	t.Helper()
	raw, err := os.ReadFile(filepath.Join(rosterDir, name))
	if err != nil {
		t.Fatalf("read %s: %v (set ROSTER_UPDATE=1 to write it)", name, err)
	}
	return strings.Fields(string(raw))
}

func writeRosterFile(t *testing.T, name string, names []string) {
	t.Helper()
	if err := os.MkdirAll(rosterDir, 0o755); err != nil {
		t.Fatalf("make %s: %v", rosterDir, err)
	}
	body := strings.Join(names, "\n") + "\n"
	if err := os.WriteFile(filepath.Join(rosterDir, name), []byte(body), 0o644); err != nil {
		t.Fatalf("write %s: %v", name, err)
	}
}

func addedTo(base, roster []string) []string {
	var added []string
	for _, name := range roster {
		if !slices.Contains(base, name) {
			added = append(added, name)
		}
	}
	return added
}

func TestEveryMountConfigurationListsExactlyItsPinnedMCPTools(t *testing.T) {
	update := os.Getenv("ROSTER_UPDATE") == "1"
	base := rosterFor(t, rosterConfigurations[0])
	if update {
		writeRosterFile(t, "no-mounts.txt", base)
	}
	if want := readRosterFile(t, "no-mounts.txt"); !slices.Equal(base, want) {
		t.Errorf("no-mounts: tools appeared %v, vanished %v", addedTo(want, base), addedTo(base, want))
	}
	for _, mounts := range rosterConfigurations {
		roster := rosterFor(t, mounts)
		if got, want := len(roster), pinnedRosterCounts[mounts.name]; got != want {
			t.Errorf("%s lists %d tools, pinned %d", mounts.name, got, want)
		}
		if mounts.name == "no-mounts" {
			continue
		}
		added := addedTo(base, roster)
		if update {
			writeRosterFile(t, mounts.name+".added.txt", added)
		}
		want := readRosterFile(t, mounts.name+".added.txt")
		if !slices.Equal(added, want) {
			t.Errorf("%s: tools appeared %v, vanished %v", mounts.name, addedTo(want, added), addedTo(added, want))
		}
		if gone := addedTo(roster, base); len(gone) != 0 {
			t.Errorf("%s: mounting dropped base tools %v", mounts.name, gone)
		}
	}
}
