package accountingtools_test

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	accounting "github.com/aosanya/mwanachama-backend-accounting"

	"wakalaserver/internal/accountingtools"
)

func connectResolved(t *testing.T, resolve accountingtools.LedgerResolver) *mcp.ClientSession {
	t.Helper()
	ctx := context.Background()
	server := mcp.NewServer(&mcp.Implementation{Name: "accounting", Version: "1"}, nil)
	accountingtools.RegisterResolvedTools(server, resolve, accountingtools.Mount{})
	serverSide, clientSide := mcp.NewInMemoryTransports()
	serverSession, err := server.Connect(ctx, serverSide, nil)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { serverSession.Close() })
	client, err := mcp.NewClient(&mcp.Implementation{Name: "test", Version: "1"}, nil).Connect(ctx, clientSide, nil)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { client.Close() })
	return client
}

func call(t *testing.T, c *mcp.ClientSession, name string, args map[string]any) *mcp.CallToolResult {
	t.Helper()
	res, err := c.CallTool(context.Background(), &mcp.CallToolParams{Name: name, Arguments: args})
	if err != nil {
		t.Fatal(err)
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

func staticLedger(repo accounting.LedgerRepository) accountingtools.LedgerResolver {
	return func(context.Context, string) (accounting.LedgerRepository, error) { return repo, nil }
}

func TestEveryResolvedToolAdvertisesARequiredInstanceId(t *testing.T) {
	client := connectResolved(t, staticLedger(ledgerOnMemory(t)))
	count := 0
	for tool, err := range client.Tools(context.Background(), nil) {
		if err != nil {
			t.Fatal(err)
		}
		count++
		raw, _ := json.Marshal(tool.InputSchema)
		var schema struct {
			Properties map[string]struct {
				Type string `json:"type"`
			} `json:"properties"`
			Required []string `json:"required"`
		}
		if err := json.Unmarshal(raw, &schema); err != nil {
			t.Fatal(err)
		}
		if schema.Properties["instance_id"].Type != "string" {
			t.Fatalf("%s has no string instance_id property", tool.Name)
		}
		found := false
		for _, r := range schema.Required {
			found = found || r == "instance_id"
		}
		if !found {
			t.Fatalf("%s does not require instance_id: %v", tool.Name, schema.Required)
		}
	}
	if count == 0 {
		t.Fatal("no tools registered")
	}
}

func TestACallWithoutAnInstanceIdIsRefusedAndNeverResolves(t *testing.T) {
	resolved := false
	client := connectResolved(t, func(context.Context, string) (accounting.LedgerRepository, error) {
		resolved = true
		return ledgerOnMemory(t), nil
	})
	for name, args := range map[string]map[string]any{
		"missing":  {},
		"empty":    {"instance_id": ""},
		"not text": {"instance_id": 7},
	} {
		res := call(t, client, "accounting_account_list", args)
		if !res.IsError || !strings.Contains(textOf(res), accountingtools.ErrInstanceRequired.Error()) {
			t.Fatalf("%s: got error=%v text=%q", name, res.IsError, textOf(res))
		}
	}
	if resolved {
		t.Fatal("the resolver ran without an instance id")
	}
}

func TestAResolverFailureComesBackAsARefusalWithItsMessage(t *testing.T) {
	client := connectResolved(t, func(context.Context, string) (accounting.LedgerRepository, error) {
		return nil, errors.New("no such agency")
	})
	res := call(t, client, "accounting_account_list", map[string]any{"instance_id": "ghost"})
	if !res.IsError || textOf(res) != "no such agency" {
		t.Fatalf("got error=%v text=%q", res.IsError, textOf(res))
	}
}

func TestTheResolverReceivesTheInstanceIdAndItsLedgerIsTheOneRead(t *testing.T) {
	north, south := ledgerOnMemory(t), ledgerOnMemory(t)
	ctx := context.Background()
	if _, err := north.OpenAccount(ctx, accounting.Account{Code: "1000", Name: "North cash", Category: "cash", HolderID: "n", Type: accounting.AccountTypeAsset}); err != nil {
		t.Fatal(err)
	}
	var asked []string
	client := connectResolved(t, func(_ context.Context, id string) (accounting.LedgerRepository, error) {
		asked = append(asked, id)
		if id == "north" {
			return north, nil
		}
		return south, nil
	})
	northRes := call(t, client, "accounting_account_list", map[string]any{"instance_id": "north"})
	southRes := call(t, client, "accounting_account_list", map[string]any{"instance_id": "south"})
	if northRes.IsError || southRes.IsError {
		t.Fatalf("errors: %q %q", textOf(northRes), textOf(southRes))
	}
	if len(asked) != 2 || asked[0] != "north" || asked[1] != "south" {
		t.Fatalf("resolver asked %v", asked)
	}
	northItems := northRes.StructuredContent.(map[string]any)["items"].([]any)
	southItems := southRes.StructuredContent.(map[string]any)["items"].([]any)
	if len(northItems) != 1 || len(southItems) != 0 {
		t.Fatalf("north %d south %d items", len(northItems), len(southItems))
	}
	if textOf(northRes) != "Found 1 item(s)" || textOf(southRes) != "Found 0 item(s)" {
		t.Fatalf("texts %q %q", textOf(northRes), textOf(southRes))
	}
}

func TestAToolRefusalFromTheLedgerIsReportedAsAnErrorResult(t *testing.T) {
	client := connectResolved(t, staticLedger(ledgerOnMemory(t)))
	res := call(t, client, "accounting_budget_read", map[string]any{"instance_id": "x", "budget_id": "does-not-exist"})
	if !res.IsError || textOf(res) == "" {
		t.Fatalf("got error=%v text=%q", res.IsError, textOf(res))
	}
}
