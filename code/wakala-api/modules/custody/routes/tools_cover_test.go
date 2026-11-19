package routes_test

import (
	"context"
	"encoding/json"
	"errors"
	"sort"
	"strings"
	"testing"

	"wakalaserver/modules/shared/dispatch"

	custody "wakalaserver/modules/custody"
	"wakalaserver/modules/custody/routes"
)

func toolsFor(t *testing.T, cm *custody.CustodyManager, m routes.Mount) map[string]routes.Tool {
	t.Helper()
	built, err := routes.BuildTools(cm, m)
	if err != nil {
		t.Fatalf("BuildTools: %v", err)
	}
	byName := map[string]routes.Tool{}
	for _, tool := range built {
		byName[tool.Name] = tool
	}
	return byName
}

func callTool(t *testing.T, tool routes.Tool, args string) (map[string]any, error) {
	t.Helper()
	out, err := tool.Invoke(context.Background(), json.RawMessage(args))
	if err != nil {
		return nil, err
	}
	raw, err := json.Marshal(out)
	if err != nil {
		t.Fatalf("marshal result: %v", err)
	}
	var body map[string]any
	if err := json.Unmarshal(raw, &body); err != nil {
		t.Fatalf("decode result %s: %v", raw, err)
	}
	return body, nil
}

func TestOnlyTheDeclaredConsentOperationsArePublishedAsTools(t *testing.T) {
	cm, _ := newManager(t, nil)
	var names []string
	for name := range toolsFor(t, cm, routes.Mount{}) {
		names = append(names, name)
	}
	sort.Strings(names)
	want := []string{
		"custody_agree_consent",
		"custody_get_in_force_consent",
		"custody_get_my_consent",
		"custody_list_consent_versions",
		"custody_publish_consent_version",
		"custody_withdraw_consent",
	}
	if strings.Join(names, ",") != strings.Join(want, ",") {
		t.Fatalf("tools = %v, want %v", names, want)
	}
}

func TestEveryToolCarriesItsActionTitleAndDescription(t *testing.T) {
	cm, _ := newManager(t, nil)
	for name, tool := range toolsFor(t, cm, routes.Mount{}) {
		if !strings.HasPrefix(tool.Action, "custody.") || tool.Title == "" || tool.Description == "" {
			t.Fatalf("%s: action %q title %q description empty %v", name, tool.Action, tool.Title, tool.Description == "")
		}
		if !json.Valid(tool.InputSchema) {
			t.Fatalf("%s: input schema is not JSON: %s", name, tool.InputSchema)
		}
	}
}

func TestAToolSchemaNeverOffersTheCallerAsAnArgument(t *testing.T) {
	cm, _ := newManager(t, nil)
	tools := toolsFor(t, cm, routes.Mount{})
	for _, name := range []string{"custody_withdraw_consent", "custody_get_my_consent", "custody_publish_consent_version"} {
		if strings.Contains(string(tools[name].InputSchema), "actor_id") || strings.Contains(string(tools[name].InputSchema), "published_by") {
			t.Fatalf("%s offers a caller field: %s", name, tools[name].InputSchema)
		}
	}
}

func TestAToolRefusesAnArgumentItDoesNotDeclare(t *testing.T) {
	cm, _ := newManager(t, nil)
	tools := toolsFor(t, cm, routes.Mount{Caller: callerIs("resident-1")})
	_, err := callTool(t, tools["custody_get_my_consent"], `{"actor_id":"someone-else"}`)
	if err == nil || !strings.Contains(err.Error(), `takes no argument "actor_id"`) {
		t.Fatalf("err = %v, want a refusal naming actor_id", err)
	}
}

func TestAToolAnswersForbiddenWhenTheAuthorizerRefuses(t *testing.T) {
	cm, _ := newManager(t, nil)
	var asked []string
	refuse := func(_ context.Context, action string) error {
		asked = append(asked, action)
		return errors.New("no")
	}
	tools := toolsFor(t, cm, routes.Mount{Caller: callerIs("resident-1"), Authorize: refuse})
	_, err := callTool(t, tools["custody_withdraw_consent"], `{}`)
	if !errors.Is(err, dispatch.ErrForbidden) {
		t.Fatalf("err = %v, want ErrForbidden", err)
	}
	if len(asked) != 1 || asked[0] != "custody.consent.withdraw" {
		t.Fatalf("asked %v", asked)
	}
}

func TestAgreeingThroughTheToolIsRefusedWhileNoSheetIsInForce(t *testing.T) {
	cm, _ := newManager(t, nil)
	tools := toolsFor(t, cm, routes.Mount{Caller: callerIs("resident-1")})
	_, err := callTool(t, tools["custody_agree_consent"], `{}`)
	if err == nil || !strings.Contains(err.Error(), "no mechanics version in force") {
		t.Fatalf("err = %v, want the no-mechanics refusal", err)
	}
}

func TestAgreeAndWithdrawThroughToolsRecordTheCallerAndMoveTheConsentGate(t *testing.T) {
	cm := steppingManager(t)
	publishMechanics(t, cm)
	ctx := context.Background()
	tools := toolsFor(t, cm, routes.Mount{Caller: callerIs("resident-1")})

	agreed, err := callTool(t, tools["custody_agree_consent"], `{}`)
	if err != nil {
		t.Fatalf("agree: %v", err)
	}
	if agreed["actor_id"] != "resident-1" || agreed["language"] != "en" {
		t.Fatalf("agreed = %v", agreed)
	}
	if err := cm.ConsentGate().Check(ctx, "resident-1"); err != nil {
		t.Fatalf("Check after agreeing = %v", err)
	}

	if _, err := callTool(t, tools["custody_withdraw_consent"], `{}`); err != nil {
		t.Fatalf("withdraw: %v", err)
	}
	if err := cm.ConsentGate().Check(ctx, "resident-1"); !errors.Is(err, custody.ErrConsentWithdrawn) {
		t.Fatalf("Check after withdrawing = %v, want ErrConsentWithdrawn", err)
	}
}

func TestTheInForceToolReadsThePublishedSheetAndRefusesBeforeAnyIsPublished(t *testing.T) {
	cm, _ := newManager(t, nil)
	tools := toolsFor(t, cm, routes.Mount{Caller: callerIs("resident-1")})
	if _, err := callTool(t, tools["custody_get_in_force_consent"], `{}`); err == nil {
		t.Fatalf("in-force with nothing published should be refused")
	}
	publishMechanics(t, cm)
	sheet, err := callTool(t, tools["custody_get_in_force_consent"], `{"scope":"mechanics","language":"en"}`)
	if err != nil {
		t.Fatalf("in-force: %v", err)
	}
	if sheet["version"] != "v1" || sheet["scope"] != "mechanics" {
		t.Fatalf("sheet = %v", sheet)
	}
}
