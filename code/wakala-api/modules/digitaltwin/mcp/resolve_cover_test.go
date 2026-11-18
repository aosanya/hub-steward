package mcp_test

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/modelcontextprotocol/go-sdk/mcp"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	digitaltwin "wakalaserver/modules/digitaltwin"
	digitaltwinmcp "wakalaserver/modules/digitaltwin/mcp"
	"wakalaserver/modules/digitaltwin/routes"
	"wakalaserver/modules/shared/dispatch"
	"wakalaserver/modules/shared/spec"
)

func newTwin(t *testing.T) digitaltwin.TwinManager {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	s, err := digitaltwin.SpecFor("app")
	if err != nil {
		t.Fatalf("spec: %v", err)
	}
	if err := spec.Migrate(db, s); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	tm, err := digitaltwin.NewTwinManager(db, s)
	if err != nil {
		t.Fatalf("manager: %v", err)
	}
	return tm
}

type resolverLog struct {
	asked []string
}

func connect(t *testing.T, resolve digitaltwinmcp.TwinResolver, mount routes.Mount) *mcp.ClientSession {
	t.Helper()
	ctx := t.Context()
	server := mcp.NewServer(&mcp.Implementation{Name: "twin", Version: "1"}, nil)
	digitaltwinmcp.RegisterResolvedTools(server, resolve, mount)
	serverSide, clientSide := mcp.NewInMemoryTransports()
	ss, err := server.Connect(ctx, serverSide, nil)
	if err != nil {
		t.Fatalf("connect server: %v", err)
	}
	t.Cleanup(func() { ss.Close() })
	cs, err := mcp.NewClient(&mcp.Implementation{Name: "probe", Version: "1"}, nil).Connect(ctx, clientSide, nil)
	if err != nil {
		t.Fatalf("connect client: %v", err)
	}
	t.Cleanup(func() { cs.Close() })
	return cs
}

func openMount() routes.Mount {
	return routes.Mount{
		Authorize: func(context.Context, string) error { return nil },
		Caller:    func(context.Context) string { return "caller-1" },
		Device:    func(context.Context) string { return "device-1" },
	}
}

func call(t *testing.T, cs *mcp.ClientSession, tool string, args map[string]any) *mcp.CallToolResult {
	t.Helper()
	res, err := cs.CallTool(t.Context(), &mcp.CallToolParams{Name: tool, Arguments: args})
	if err != nil {
		t.Fatalf("call %s: %v", tool, err)
	}
	return res
}

func textOf(res *mcp.CallToolResult) string {
	var b strings.Builder
	for _, c := range res.Content {
		if tc, ok := c.(*mcp.TextContent); ok {
			b.WriteString(tc.Text)
		}
	}
	return b.String()
}

func TestOnlyServedToolsAreRegisteredAndEachRequiresTheInstance(t *testing.T) {
	cs := connect(t, func(context.Context, string) (digitaltwin.TwinManager, error) { return newTwin(t), nil }, openMount())
	listed, err := cs.ListTools(t.Context(), nil)
	if err != nil {
		t.Fatalf("list tools: %v", err)
	}
	if len(listed.Tools) == 0 {
		t.Fatal("no tools registered")
	}
	names := map[string]bool{}
	for _, tool := range listed.Tools {
		names[tool.Name] = true
		raw, _ := json.Marshal(tool.InputSchema)
		var schema struct {
			Required   []string       `json:"required"`
			Properties map[string]any `json:"properties"`
		}
		if err := json.Unmarshal(raw, &schema); err != nil {
			t.Fatalf("%s schema: %v", tool.Name, err)
		}
		if _, ok := schema.Properties["instance_id"]; !ok {
			t.Errorf("%s has no instance_id property", tool.Name)
		}
		found := false
		for _, r := range schema.Required {
			found = found || r == "instance_id"
		}
		if !found {
			t.Errorf("%s does not require instance_id: %v", tool.Name, schema.Required)
		}
	}
	for name := range names {
		if strings.Contains(name, "link") || strings.Contains(name, "metric") || strings.Contains(name, "observation") {
			t.Errorf("unserved tool %s was registered", name)
		}
	}
}

func TestACallWithoutAnInstanceIsRefusedBeforeTheResolverIsAsked(t *testing.T) {
	log := &resolverLog{}
	cs := connect(t, func(_ context.Context, id string) (digitaltwin.TwinManager, error) {
		log.asked = append(log.asked, id)
		return newTwin(t), nil
	}, openMount())
	for name, args := range map[string]map[string]any{
		"missing":      {},
		"empty":        {"instance_id": ""},
		"not a string": {"instance_id": 7},
	} {
		res := call(t, cs, "digitaltwin_address_list", args)
		if !res.IsError {
			t.Errorf("%s: want a refusal, got %q", name, textOf(res))
		}
		if !strings.Contains(textOf(res), digitaltwinmcp.ErrInstanceRequired.Error()) {
			t.Errorf("%s: refusal text = %q", name, textOf(res))
		}
	}
	if len(log.asked) != 0 {
		t.Errorf("resolver was asked for %v", log.asked)
	}
}

func TestAResolverRefusalReachesTheCallerAsAnErrorResult(t *testing.T) {
	cs := connect(t, func(_ context.Context, id string) (digitaltwin.TwinManager, error) {
		return nil, errors.New("no such agency " + id)
	}, openMount())
	res := call(t, cs, "digitaltwin_address_list", map[string]any{"instance_id": "ghost"})
	if !res.IsError || textOf(res) != "no such agency ghost" {
		t.Errorf("isError=%v text=%q", res.IsError, textOf(res))
	}
}

func TestAnAddressCreatedInOneInstanceIsListedThereAndNotInAnother(t *testing.T) {
	twins := map[string]digitaltwin.TwinManager{"north": newTwin(t), "south": newTwin(t)}
	cs := connect(t, func(_ context.Context, id string) (digitaltwin.TwinManager, error) {
		tm, ok := twins[id]
		if !ok {
			return nil, errors.New("unknown agency")
		}
		return tm, nil
	}, openMount())

	created := call(t, cs, "digitaltwin_address_create", map[string]any{
		"instance_id": "north", "street": "Kenyatta Avenue", "number": "12",
	})
	if created.IsError {
		t.Fatalf("create refused: %s", textOf(created))
	}
	if !strings.HasSuffix(textOf(created), "completed") {
		t.Errorf("create text = %q", textOf(created))
	}

	north := call(t, cs, "digitaltwin_address_list", map[string]any{"instance_id": "north"})
	if north.IsError {
		t.Fatalf("list refused: %s", textOf(north))
	}
	if textOf(north) != "Found 1 item(s)" {
		t.Errorf("north text = %q", textOf(north))
	}
	body, _ := json.Marshal(north.StructuredContent)
	var shaped struct {
		Items []struct {
			Street string `json:"street"`
			Number string `json:"number"`
		} `json:"items"`
	}
	if err := json.Unmarshal(body, &shaped); err != nil {
		t.Fatalf("structured content: %v", err)
	}
	if len(shaped.Items) != 1 || shaped.Items[0].Street != "Kenyatta Avenue" || shaped.Items[0].Number != "12" {
		t.Errorf("north items = %s", body)
	}

	south := call(t, cs, "digitaltwin_address_list", map[string]any{"instance_id": "south"})
	if textOf(south) != "Found 0 item(s)" {
		t.Errorf("south text = %q", textOf(south))
	}
}

func TestACreateMissingTheRequiredStreetIsRefusedByTheManager(t *testing.T) {
	cs := connect(t, func(context.Context, string) (digitaltwin.TwinManager, error) { return newTwin(t), nil }, openMount())
	res := call(t, cs, "digitaltwin_address_create", map[string]any{"instance_id": "north", "number": "4"})
	if !res.IsError {
		t.Errorf("want a refusal, got %q", textOf(res))
	}
}

func TestAnAuthorizerRefusalStopsTheCallBeforeAnythingIsWritten(t *testing.T) {
	tm := newTwin(t)
	denied := openMount()
	denied.Authorize = func(_ context.Context, action string) error {
		if action == "digitaltwin.address.create" {
			return errors.New("not permitted: " + action)
		}
		return nil
	}
	cs := connect(t, func(context.Context, string) (digitaltwin.TwinManager, error) { return tm, nil }, denied)
	res := call(t, cs, "digitaltwin_address_create", map[string]any{
		"instance_id": "north", "street": "Moi Avenue", "number": "1",
	})
	if !res.IsError || textOf(res) != dispatch.ErrForbidden.Error() {
		t.Errorf("isError=%v text=%q", res.IsError, textOf(res))
	}
	stored, err := tm.ListAddresses(t.Context(), digitaltwin.AddressFilter{})
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(stored) != 0 {
		t.Errorf("a refused call wrote %d address(es)", len(stored))
	}
}
