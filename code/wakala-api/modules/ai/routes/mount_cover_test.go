package routes_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	ai "wakalaserver/modules/ai"
	"wakalaserver/modules/ai/routes"
	"wakalaserver/modules/shared/dispatch"
)

const coverAgency = "agency-9"

var errNotYours = errors.New("not yours")

func coverManager(t *testing.T) ai.Manager {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	s, err := ai.SpecFor("cover")
	if err != nil {
		t.Fatal(err)
	}
	if err := ai.Provision(db, s); err != nil {
		t.Fatal(err)
	}
	m, err := ai.NewManager(db, s, ai.WithMasterKey([]byte("0123456789abcdef0123456789abcdef")))
	if err != nil {
		t.Fatal(err)
	}
	return m
}

func coverServer(t *testing.T, mount routes.Mount) (*httptest.Server, ai.Manager) {
	t.Helper()
	m := coverManager(t)
	table, err := routes.BuildFor(m, mount)
	if err != nil {
		t.Fatal(err)
	}
	mux := http.NewServeMux()
	for _, r := range table {
		mux.HandleFunc(r.Pattern(""), r.Handler)
	}
	server := httptest.NewServer(mux)
	t.Cleanup(server.Close)
	return server, m
}

func call(t *testing.T, server *httptest.Server, method, path, body string) (int, string) {
	t.Helper()
	req, err := http.NewRequest(method, server.URL+"/agencies/"+coverAgency+path, bytes.NewBufferString(body))
	if err != nil {
		t.Fatal(err)
	}
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(res.Body)
	return res.StatusCode, string(raw)
}

func TestTheServerOwnedAccountFieldsAreAllReadOnly(t *testing.T) {
	fields := routes.Fields()
	want := []string{"id", "agency_id", "key_set", "default", "last_test_result", "last_tested_at", "last_test_prompt", "last_test_reply", "last_test_ms", "created_at", "updated_at"}
	if len(fields) != len(want) {
		t.Fatalf("%d fields, want %d: %v", len(fields), len(want), fields)
	}
	for _, name := range want {
		doc, ok := fields["Account."+name]
		if !ok || !doc.ReadOnly {
			t.Fatalf("Account.%s is %+v, want a read-only field", name, doc)
		}
	}
	if _, ok := fields["Account.name"]; ok {
		t.Fatalf("a caller-written field is listed as read-only")
	}
}

func TestEveryNamedSentinelIsADistinctError(t *testing.T) {
	seen := map[error]string{}
	for name, err := range routes.Sentinels {
		if err == nil || err.Error() == "" {
			t.Fatalf("sentinel %s has no error", name)
		}
		if other, dup := seen[err]; dup {
			t.Fatalf("sentinels %s and %s are the same error", name, other)
		}
		seen[err] = name
	}
	for _, name := range []string{"ErrAccountNotFound", "ErrLimitReached", "ErrAssistantLimit", "ErrChatModelUnavailable", "ErrNoMasterKey", "ErrModelRateLimited"} {
		if routes.Sentinels[name] == nil {
			t.Fatalf("sentinel %s is missing", name)
		}
	}
}

func TestTheRouteTableCarriesEveryActionOnceWithAHandler(t *testing.T) {
	m := coverManager(t)
	table := routes.Routes(m)
	if len(table) < 30 {
		t.Fatalf("%d routes, want the whole table", len(table))
	}
	actions := map[string]bool{}
	for _, r := range table {
		if r.Method == "" || !strings.HasPrefix(r.Path, "/agencies/{agencyID}/") || r.Handler == nil || r.Action == "" {
			t.Fatalf("route %+v is incomplete", r)
		}
		if actions[r.Action] {
			t.Fatalf("action %s is on two routes", r.Action)
		}
		actions[r.Action] = true
	}
	for _, want := range []string{"ai.account.create", "ai.account.chat", "ai.assistant_limits.set", "ai.assistant_usage.mine", "ai.chat_model.pick", "ai.limits.check"} {
		if !actions[want] {
			t.Fatalf("no route for %s", want)
		}
	}
	built, err := routes.Build(m)
	if err != nil || len(built) != len(table) {
		t.Fatalf("Build gave %d routes and %v, want the same %d as Routes", len(built), err, len(table))
	}
}

func TestNoActionIsAnonymousSoEveryRouteIsGated(t *testing.T) {
	m := coverManager(t)
	split := routes.Split(m, routes.Mount{})
	if len(split.Anonymous) != 0 || len(split.Gated) != len(routes.Routes(m)) {
		t.Fatalf("split has %d anonymous and %d gated routes, want none anonymous and all gated", len(split.Anonymous), len(split.Gated))
	}
}

func TestEveryRouteActionHasAToolWithAnObjectSchema(t *testing.T) {
	m := coverManager(t)
	tools := routes.Tools(m)
	names := map[string]bool{}
	byAction := map[string]bool{}
	for _, tool := range tools {
		if tool.Name == "" || !strings.HasPrefix(tool.Name, "ai_") || tool.Action == "" || (tool.Invoke == nil && tool.Handle == nil) {
			t.Fatalf("tool %+v is incomplete", tool)
		}
		if names[tool.Name] {
			t.Fatalf("tool name %s is used twice", tool.Name)
		}
		names[tool.Name] = true
		byAction[tool.Action] = true
		var schema struct {
			Type string `json:"type"`
		}
		if err := json.Unmarshal(tool.InputSchema, &schema); err != nil || schema.Type != "object" {
			t.Fatalf("tool %s schema %s is not an object schema (%v)", tool.Name, tool.InputSchema, err)
		}
	}
	for _, r := range routes.Routes(m) {
		if !byAction[r.Action] {
			t.Fatalf("route action %s has no tool", r.Action)
		}
	}
	built, err := routes.BuildTools(m)
	if err != nil || len(built) != len(tools) || len(routes.ToolsFor(m, routes.Mount{})) != len(tools) {
		t.Fatalf("BuildTools gave %d tools and %v, want %d", len(built), err, len(tools))
	}
}

func TestAnUnknownAccountIsNotFoundAndAnEmptyListIsEmpty(t *testing.T) {
	server, _ := coverServer(t, routes.Mount{})
	if status, _ := call(t, server, http.MethodGet, "/accounts/nope", ""); status != http.StatusNotFound {
		t.Fatalf("reading an unknown account gave %d, want 404", status)
	}
	status, body := call(t, server, http.MethodGet, "/accounts", "")
	if status != http.StatusOK || strings.TrimSpace(body) != "[]" {
		t.Fatalf("listing no accounts gave %d %q, want 200 and an empty list", status, body)
	}
}

func TestAnAccountWithoutANameOrProviderIsRefusedAndNothingIsSaved(t *testing.T) {
	server, m := coverServer(t, routes.Mount{})
	status, _ := call(t, server, http.MethodPost, "/accounts", `{}`)
	if status < 400 || status >= 500 {
		t.Fatalf("creating an empty account gave %d, want a client refusal", status)
	}
	if accounts, err := m.ListAccounts(context.Background(), coverAgency); err != nil || len(accounts) != 0 {
		t.Fatalf("%d accounts saved after the refusal (%v)", len(accounts), err)
	}
}

func TestACreatedAccountIsReadBackWithoutAKeyAndKeyedThroughItsOwnRoute(t *testing.T) {
	server, _ := coverServer(t, routes.Mount{})
	status, body := call(t, server, http.MethodPost, "/accounts", `{"name":"Main","provider":"openai_compatible","base_url":"http://127.0.0.1:1","model_name":"m","status":"enabled","chat_enabled":true}`)
	if status != http.StatusCreated && status != http.StatusOK {
		t.Fatalf("creating gave %d %s", status, body)
	}
	var created struct {
		ID string `json:"id"`
	}
	if err := json.Unmarshal([]byte(body), &created); err != nil || created.ID == "" {
		t.Fatalf("created body %s has no id (%v)", body, err)
	}
	status, body = call(t, server, http.MethodGet, "/accounts/"+created.ID, "")
	if status != http.StatusOK || strings.Contains(body, "api_key") || !strings.Contains(body, `"key_set":false`) {
		t.Fatalf("reading gave %d %s, want key_set false and no key", status, body)
	}
	if status, _ := call(t, server, http.MethodPut, "/accounts/"+created.ID+"/key", `{"key":"   "}`); status < 400 || status >= 500 {
		t.Fatalf("a blank key gave %d, want a client refusal", status)
	}
	status, _ = call(t, server, http.MethodPut, "/accounts/"+created.ID+"/key", `{"key":"sk-cover-secret-0001"}`)
	if status != http.StatusOK && status != http.StatusNoContent {
		t.Fatalf("setting the key gave %d", status)
	}
	status, body = call(t, server, http.MethodGet, "/accounts/"+created.ID, "")
	if status != http.StatusOK || strings.Contains(body, "sk-cover-secret-0001") || !strings.Contains(body, `"key_set":true`) {
		t.Fatalf("reading after keying gave %d %s, want key_set true and the key never shown", status, body)
	}
}

func TestTheAuthorizerSeesTheActionAndAVetoStopsTheRouteAndTheTool(t *testing.T) {
	var asked []string
	mount := routes.Mount{Authorize: func(_ context.Context, action string) error {
		asked = append(asked, action)
		return dispatch.ErrForbidden
	}}
	server, _ := coverServer(t, mount)
	status, _ := call(t, server, http.MethodGet, "/accounts", "")
	if status != http.StatusForbidden {
		t.Fatalf("a vetoed route gave %d, want 403", status)
	}
	if len(asked) != 1 || asked[0] != "ai.account.list" {
		t.Fatalf("the authorizer was asked %v, want ai.account.list once", asked)
	}
	var list dispatch.Tool
	for _, tool := range routes.ToolsFor(coverManager(t), mount) {
		if tool.Name == "ai_list_accounts" {
			list = tool
		}
	}
	if list.Name == "" {
		t.Fatal("no ai_list_accounts tool")
	}
	if _, err := list.Invoke(context.Background(), json.RawMessage(`{"agencyID":"`+coverAgency+`"}`)); err == nil {
		t.Fatal("a vetoed tool ran")
	}
	if len(asked) != 2 || asked[1] != "ai.account.list" {
		t.Fatalf("the authorizer was asked %v, want the tool to ask for ai.account.list too", asked)
	}
}

func TestAToolListsTheAgencysAccountsAndRefusesATypedStrangeArgument(t *testing.T) {
	m := coverManager(t)
	if _, err := m.CreateAccount(context.Background(), coverAgency, ai.Account{Name: "Main", Provider: "openai_compatible", BaseURL: "http://127.0.0.1:1", ModelName: "m", Status: "enabled", ChatEnabled: true}); err != nil {
		t.Fatal(err)
	}
	for _, tool := range routes.ToolsFor(m, routes.Mount{}) {
		if tool.Name != "ai_list_accounts" {
			continue
		}
		out, err := tool.Invoke(context.Background(), json.RawMessage(`{"agencyID":"`+coverAgency+`"}`))
		if err != nil {
			t.Fatal(err)
		}
		raw, _ := json.Marshal(out)
		if !strings.Contains(string(raw), `"name":"Main"`) {
			t.Fatalf("the tool answered %s, want the Main account", raw)
		}
		other, err := tool.Invoke(context.Background(), json.RawMessage(`{"agencyID":"someone-else"}`))
		if err != nil {
			t.Fatal(err)
		}
		if raw, _ := json.Marshal(other); strings.Contains(string(raw), "Main") {
			t.Fatalf("another agency's call saw %s", raw)
		}
		return
	}
	t.Fatal("no ai_list_accounts tool")
}
