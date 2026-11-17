package http

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"testing"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	"wakalaserver/internal/agencies"
)

const (
	personRaisedItemsCode   = "person_raised_items.read"
	personRaisedItemsAction = "catalog.raised_item.list_of_person"
	personSendsAction       = "forms.submission.list_of_person"
	personRaisedItemsTool   = "forms_catalog_raised_item_list_of_person"
	personSendsTool         = "forms_submission_list_of_person"
)

func isRefusal(rec *httptest.ResponseRecorder) bool {
	return rec.Code == http.StatusForbidden || rec.Code == http.StatusNotFound
}

type personReadsWalk struct {
	designAgentWalk
	residentA, residentB string
	residentACookie      *http.Cookie
}

func newPersonReadsWalk(t *testing.T) personReadsWalk {
	t.Helper()
	w := personReadsWalk{designAgentWalk: newDesignAgentWalk(t), residentA: "resident-a", residentB: "resident-b"}
	runsModules(t, w.instance, "forms")
	for _, resident := range []string{w.residentA, w.residentB} {
		if err := w.deps.Registry.AddMember(context.Background(), w.instance, resident, agencies.RoleResident); err != nil {
			t.Fatalf("AddMember %s: %v", resident, err)
		}
	}
	w.residentACookie = w.cookieFor(t, w.residentA)
	for _, item := range []map[string]any{
		{"title": "Broken street lamp", "topic": "Lighting", "raised_by": w.residentA, "channel": "phone", "publishable": true},
		{"title": "Pothole on the high street", "topic": "Roads", "raised_by": w.residentA, "channel": "phone", "publishable": true},
		{"title": "Noise after midnight", "topic": "Noise", "raised_by": w.residentB, "channel": "phone", "publishable": true},
	} {
		if rec := w.call(t, "POST", w.base+"/forms-catalog/raised-items/filed", item, w.owner); rec.Code != http.StatusCreated {
			t.Fatalf("staff files %v: %d %s", item["title"], rec.Code, rec.Body.String())
		}
	}
	return w
}

func (w personReadsWalk) itemsOfPerson(t *testing.T, person string, as *http.Cookie) *httptest.ResponseRecorder {
	t.Helper()
	return w.call(t, "GET", w.base+"/forms-catalog/raised-items/by-person?raised_by="+person, nil, as)
}

func (w personReadsWalk) sendsOfPerson(t *testing.T, person string, as *http.Cookie) *httptest.ResponseRecorder {
	t.Helper()
	return w.call(t, "GET", w.base+"/forms/submissions?member_id="+person, nil, as)
}

func titlesInBody(t *testing.T, rec *httptest.ResponseRecorder) []string {
	t.Helper()
	var rows []struct {
		Title string `json:"title"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &rows); err != nil {
		t.Fatalf("body is not a list of items: %q (%v)", rec.Body.String(), err)
	}
	var titles []string
	for _, row := range rows {
		titles = append(titles, row.Title)
	}
	slices.Sort(titles)
	return titles
}

func TestPersonRaisedItems_StaffHoldingTheCodeReadsOneResidentsItemsAndNobodyElses(t *testing.T) {
	w := newPersonReadsWalk(t)
	givesTheRole(t, w.designAgentWalk, personRaisedItemsCode)
	rec := w.itemsOfPerson(t, w.residentA, w.agent)
	if rec.Code != http.StatusOK {
		t.Fatalf("a holder of %s reading the items of %s: %d %s, want 200", personRaisedItemsCode, w.residentA, rec.Code, rec.Body.String())
	}
	if got, want := titlesInBody(t, rec), []string{"Broken street lamp", "Pothole on the high street"}; !slices.Equal(got, want) {
		t.Errorf("items of %s = %v, want %v", w.residentA, got, want)
	}
	if other := w.itemsOfPerson(t, w.residentB, w.agent); other.Code != http.StatusOK || !slices.Equal(titlesInBody(t, other), []string{"Noise after midnight"}) {
		t.Errorf("items of %s: %d %s, want that resident's one item", w.residentB, other.Code, other.Body.String())
	}
}

func TestPersonRaisedItems_TheOwnerReadsThemAndAnEmptyPersonIsRefused(t *testing.T) {
	w := newPersonReadsWalk(t)
	if rec := w.itemsOfPerson(t, w.residentA, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("owner reading the items of %s: %d %s, want 200", w.residentA, rec.Code, rec.Body.String())
	}
	if rec := w.itemsOfPerson(t, "", w.owner); rec.Code != http.StatusBadRequest {
		t.Errorf("owner reading the items of nobody: %d %s, want 400", rec.Code, rec.Body.String())
	}
}

func TestPersonRaisedItems_AgentWithoutTheCodeIsRefusedWhileOwnerReads(t *testing.T) {
	w := newPersonReadsWalk(t)
	givesTheRole(t, w.designAgentWalk, "service.read", "late_matters.read", "board.manage")
	if owner := w.itemsOfPerson(t, w.residentA, w.owner); owner.Code != http.StatusOK {
		t.Fatalf("owner reading the items of %s: %d %s, want 200", w.residentA, owner.Code, owner.Body.String())
	}
	rec := w.itemsOfPerson(t, w.residentA, w.agent)
	if !isRefusal(rec) || strings.Contains(rec.Body.String(), "Broken street lamp") {
		t.Errorf("an agent without %s: %d %s, want a refusal that shows no item", personRaisedItemsCode, rec.Code, rec.Body.String())
	}
}

func TestPersonRaisedItems_AResidentWithoutTheCodeIsRefusedEvenForTheirOwnId(t *testing.T) {
	w := newPersonReadsWalk(t)
	if owner := w.itemsOfPerson(t, w.residentA, w.owner); owner.Code != http.StatusOK {
		t.Fatalf("owner reading the items of %s: %d %s, want 200", w.residentA, owner.Code, owner.Body.String())
	}
	for _, person := range []string{w.residentA, w.residentB} {
		rec := w.itemsOfPerson(t, person, w.residentACookie)
		if !isRefusal(rec) || strings.Contains(rec.Body.String(), "Broken street lamp") || strings.Contains(rec.Body.String(), "Noise after midnight") {
			t.Errorf("a resident reading the items of %s: %d %s, want a refusal that shows no item", person, rec.Code, rec.Body.String())
		}
	}
}

func TestPersonRaisedItems_ToolIsGatedLikeTheRoute(t *testing.T) {
	args := func(w personReadsWalk) map[string]any {
		return map[string]any{"instance_id": w.instance, "raised_by": w.residentA}
	}
	without := newPersonReadsWalk(t)
	givesTheRole(t, without.designAgentWalk, "service.read")
	if out := without.mcpCall(t, "agent-chat", personRaisedItemsTool, args(without)); !out.IsError || !refusedAsUnknown(toolErrorText(out)) {
		t.Errorf("an agent without %s calling %s: error=%v %s, want the refusal", personRaisedItemsCode, personRaisedItemsTool, out.IsError, toolErrorText(out))
	}
	holding := newPersonReadsWalk(t)
	givesTheRole(t, holding.designAgentWalk, personRaisedItemsCode)
	out := holding.mcpCall(t, "agent-chat", personRaisedItemsTool, args(holding))
	if out.IsError || !strings.Contains(personToolBody(out), "Broken street lamp") || strings.Contains(personToolBody(out), "Noise after midnight") {
		t.Errorf("an agent holding %s calling %s: error=%v %s, want that resident's items alone", personRaisedItemsCode, personRaisedItemsTool, out.IsError, personToolBody(out))
	}
}

func personToolBody(out *mcp.CallToolResult) string {
	structured, _ := json.Marshal(out.StructuredContent)
	return string(structured) + toolErrorText(out)
}

func TestPersonSends_StaffHoldingFormResultsReadsAPersonsSendsAcrossForms(t *testing.T) {
	w := newPersonReadsWalk(t)
	givesTheRole(t, w.designAgentWalk, "form.results")
	rec := w.sendsOfPerson(t, w.residentA, w.agent)
	if rec.Code != http.StatusOK {
		t.Fatalf("a holder of form.results reading the sends of %s: %d %s, want 200", w.residentA, rec.Code, rec.Body.String())
	}
	var rows []map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &rows); err != nil {
		t.Fatalf("body is not a list of sends: %q (%v)", rec.Body.String(), err)
	}
	if rec := w.sendsOfPerson(t, "", w.agent); rec.Code != http.StatusBadRequest {
		t.Errorf("a holder reading the sends of nobody: %d %s, want 400", rec.Code, rec.Body.String())
	}
}

func TestPersonSends_AgentWithoutFormResultsIsRefusedWhileOwnerReads(t *testing.T) {
	w := newPersonReadsWalk(t)
	givesTheRole(t, w.designAgentWalk, "form.compose", personRaisedItemsCode)
	if owner := w.sendsOfPerson(t, w.residentA, w.owner); owner.Code != http.StatusOK {
		t.Fatalf("owner reading the sends of %s: %d %s, want 200", w.residentA, owner.Code, owner.Body.String())
	}
	if rec := w.sendsOfPerson(t, w.residentA, w.agent); !isRefusal(rec) {
		t.Errorf("an agent without form.results reading the sends of %s: %d %s, want a refusal", w.residentA, rec.Code, rec.Body.String())
	}
}

func TestPersonSends_AResidentIsRefusedEvenForTheirOwnId(t *testing.T) {
	w := newPersonReadsWalk(t)
	if owner := w.sendsOfPerson(t, w.residentA, w.owner); owner.Code != http.StatusOK {
		t.Fatalf("owner reading the sends of %s: %d %s, want 200", w.residentA, owner.Code, owner.Body.String())
	}
	for _, person := range []string{w.residentA, w.residentB} {
		if rec := w.sendsOfPerson(t, person, w.residentACookie); !isRefusal(rec) {
			t.Errorf("a resident reading the sends of %s: %d %s, want a refusal", person, rec.Code, rec.Body.String())
		}
	}
}

func TestPersonSends_ToolIsGatedLikeTheRoute(t *testing.T) {
	args := func(w personReadsWalk) map[string]any {
		return map[string]any{"instance_id": w.instance, "member_id": w.residentA}
	}
	without := newPersonReadsWalk(t)
	givesTheRole(t, without.designAgentWalk, "form.compose")
	if out := without.mcpCall(t, "agent-chat", personSendsTool, args(without)); !out.IsError || !refusedAsUnknown(personToolBody(out)) {
		t.Errorf("an agent without form.results calling %s: error=%v %s, want the refusal", personSendsTool, out.IsError, personToolBody(out))
	}
	holding := newPersonReadsWalk(t)
	givesTheRole(t, holding.designAgentWalk, "form.results")
	if out := holding.mcpCall(t, "agent-chat", personSendsTool, args(holding)); out.IsError {
		t.Errorf("an agent holding form.results calling %s: %s", personSendsTool, personToolBody(out))
	}
}

func TestResidentRole_HoldsNeitherPersonRead(t *testing.T) {
	for _, action := range []string{personRaisedItemsAction, personSendsAction} {
		if !permissionsAllow([]string{personRaisedItemsCode, "form.results"}, action) {
			t.Errorf("no permission in the catalog carries %s, so no role can hold it yet", action)
		}
		if slices.Contains(residentFormsActions, action) {
			t.Errorf("residentFormsActions holds %s: %v", action, residentFormsActions)
		}
		if slices.Contains(residentRoleFormsActions, action) {
			t.Errorf("residentRoleFormsActions holds %s: %v", action, residentRoleFormsActions)
		}
		for _, scope := range []string{formsScope, catalogScope} {
			if residentMay(scope, action) {
				t.Errorf("a resident may %s on %s", action, scope)
			}
		}
		if slices.Contains(everyResidentAction(), action) {
			t.Errorf("the resident role is seeded with %s", action)
		}
	}
}
