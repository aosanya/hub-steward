package http

import (
	"context"
	"encoding/json"
	"net/http"
	"slices"
	"testing"

	mwanachamaactor "github.com/aosanya/mwanachama-backend-actor"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"

	"wakalaserver/internal/agencies"
)

type consultantPoolWalk struct {
	stepRunWalk
	pool     string
	resident string
}

type consultant struct {
	name, kind, expertise, countries, languages, band, freeFrom, status string
}

var consultantPoolOfEight = []consultant{
	{"Zawadi Ndwiga", "Outside expert", "Financial inclusion; Sustainable finance", "Kenya; Tanzania", "English; French; Swahili", "B", "2027-02-15", "Active"},
	{"Baraka Otieno", "Staff", "Financial inclusion", "Kenya; Uganda", "English; Swahili", "A", "2027-01-10", "Active"},
	{"Imani Kasongo", "Outside expert", "Financial inclusion", "Kenya; Rwanda", "English; French", "C", "2027-04-05", "Active"},
	{"Neema Sawe", "Outside expert", "Banking and central banking", "Kenya", "English; French", "B", "2027-02-01", "Active"},
	{"Jabari Mushi", "Outside expert", "Financial inclusion; Food security", "Kenya; Senegal", "English; French", "D", "2027-03-01", "Active"},
	{"Tendai Moyo", "Staff", "Financial inclusion", "Ethiopia", "English; French", "A", "2027-02-20", "Active"},
	{"Rehema Kimaro", "Outside expert", "Financial inclusion", "Kenya", "English; French; Arabic", "C", "2027-02-10", "Retired"},
	{"Salim Abdalla", "Staff", "Financial inclusion; Sustainable finance", "Kenya", "English; French", "B", "2026-12-01", "Active"},
}

func consultantPool(t *testing.T) consultantPoolWalk {
	t.Helper()
	w := referral(t)
	ctx := context.Background()
	mgr, err := w.deps.Registry.AgencyManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	workflow, err := mgr.CreateWorkflow(ctx, agencymodels.Workflow{DraftID: w.draftID, Name: "Consultant pool"})
	if err != nil {
		t.Fatalf("CreateWorkflow: %v", err)
	}
	goal, err := mgr.CreateGoal(ctx, agencymodels.Goal{DraftID: w.draftID, Title: "Every project finds its experts"})
	if err != nil {
		t.Fatalf("CreateGoal: %v", err)
	}
	objective, err := mgr.CreateObjective(ctx, agencymodels.Objective{DraftID: w.draftID, GoalID: goal.ID, Title: "Know the pool"})
	if err != nil {
		t.Fatalf("CreateObjective: %v", err)
	}
	if _, err := mgr.CreateWorkflowObjective(ctx, agencymodels.WorkflowObjective{DraftID: w.draftID, WorkflowID: workflow.ID, ObjectiveID: objective.ID}); err != nil {
		t.Fatalf("CreateWorkflowObjective: %v", err)
	}
	if _, err := mgr.CreateWorkItem(ctx, agencymodels.WorkItem{DraftID: w.draftID, WorkflowID: workflow.ID, Title: "Tell the leads", Ordinality: 1, Kind: agencymodels.StepKindNotify, FormName: "Notice", Questions: []agencymodels.StepQuestion{{Prompt: "Message", AnswerType: agencymodels.AnswerFreeText}}}); err != nil {
		t.Fatalf("CreateWorkItem: %v", err)
	}
	pool, err := mgr.CreateRecord(ctx, agencymodels.Record{
		DraftID: w.draftID, WorkflowID: workflow.ID, Name: "Consultants", RoleID: w.roles["Coordinator"], FormName: "Consultant",
		Questions: []agencymodels.StepQuestion{
			{Prompt: "Name", AnswerType: agencymodels.AnswerFreeText, Required: true},
			{Prompt: "Staff or outside", AnswerType: agencymodels.AnswerSingleChoice, Required: true, Options: []string{"Staff", "Outside expert"}},
			{Prompt: "Expertise areas", AnswerType: agencymodels.AnswerMultiSelect, Required: true, Options: []string{"Financial inclusion", "Sustainable finance", "Banking and central banking", "Food security"}},
			{Prompt: "Countries", AnswerType: agencymodels.AnswerMultiSelect, Required: true, Options: []string{"Kenya", "Tanzania", "Uganda", "Rwanda", "Senegal", "Ethiopia"}},
			{Prompt: "Languages", AnswerType: agencymodels.AnswerMultiSelect, Required: true, Options: []string{"English", "French", "Swahili", "Arabic"}},
			{Prompt: "Band", AnswerType: agencymodels.AnswerSingleChoice, Required: true, Options: []string{"A", "B", "C", "D"}},
			{Prompt: "Free from", AnswerType: agencymodels.AnswerDate, Required: true},
			{Prompt: "Status", AnswerType: agencymodels.AnswerSingleChoice, Required: true, Options: []string{"Active", "Retired"}},
		},
	})
	if err != nil {
		t.Fatalf("CreateRecord consultants: %v", err)
	}
	w.publish(t)
	agencyMountedSets.forget(w.instance)

	um, err := w.deps.Registry.ActorManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	person, err := um.CreateActor(ctx, mwanachamaactor.Actor{DisplayName: "Resident"})
	if err != nil {
		t.Fatalf("CreateActor: %v", err)
	}
	if err := w.deps.Registry.AddMember(ctx, w.instance, person.ID, agencies.RoleResident); err != nil {
		t.Fatalf("AddMember: %v", err)
	}
	walk := consultantPoolWalk{stepRunWalk: w, pool: pool.Code, resident: person.ID}
	for _, c := range consultantPoolOfEight {
		walk.add(t, c)
	}
	return walk
}

func (p consultantPoolWalk) add(t *testing.T, c consultant) {
	t.Helper()
	answers := map[string]string{
		"Name": c.name, "Staff or outside": c.kind, "Expertise areas": c.expertise, "Countries": c.countries,
		"Languages": c.languages, "Band": c.band, "Free from": c.freeFrom, "Status": c.status,
	}
	rec := p.call(t, "POST", "/instances/"+p.instance+"/live-records/"+p.pool+"/rows", map[string]any{"answers": answers}, p.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("adding %s: %d %s", c.name, rec.Code, rec.Body.String())
	}
}

type poolCondition = map[string]string

func (p consultantPoolWalk) search(t *testing.T, subject string, where ...poolCondition) ([]string, string) {
	t.Helper()
	args := map[string]any{"instance_id": p.instance, "record_code": p.pool}
	if where != nil {
		args["where"] = where
	}
	out := designAgentWalk{stepRunWalk: p.stepRunWalk}.mcpCall(t, subject, listLiveRecordRowsTool, args)
	if out.IsError {
		return nil, toolErrorText(out)
	}
	encoded, err := json.Marshal(out.StructuredContent)
	if err != nil {
		t.Fatalf("structured content does not encode: %v", err)
	}
	var body struct {
		Items []agencymodels.RecordRow `json:"items"`
	}
	if err := json.Unmarshal(encoded, &body); err != nil {
		t.Fatalf("structured content %s does not carry items: %v", encoded, err)
	}
	names := []string{}
	for _, row := range body.Items {
		names = append(names, p.promptsOfRow(t, row)["Name"])
	}
	slices.Sort(names)
	return names, ""
}

func (p consultantPoolWalk) found(t *testing.T, what string, where []poolCondition, want ...string) {
	t.Helper()
	got, refused := p.search(t, "test-owner", where...)
	if refused != "" {
		t.Errorf("%s: refused with %q", what, refused)
		return
	}
	slices.Sort(want)
	expectBusinesses(t, what, got, want...)
}

func poolIs(question, value string) poolCondition {
	return poolCondition{"question": question, "operator": "is", "value": value}
}

func poolContains(question, value string) poolCondition {
	return poolCondition{"question": question, "operator": "contains", "value": value}
}

func poolOnOrBefore(question, value string) poolCondition {
	return poolCondition{"question": question, "operator": "on_or_before", "value": value}
}

func poolOnOrAfter(question, value string) poolCondition {
	return poolCondition{"question": question, "operator": "on_or_after", "value": value}
}

func marchSearch() []poolCondition {
	return []poolCondition{
		poolContains("Expertise areas", "Financial inclusion"),
		poolContains("Countries", "Kenya"),
		poolContains("Languages", "French"),
		poolOnOrBefore("Free from", "2027-03-01"),
		poolIs("Status", "Active"),
	}
}

func TestPoolSearch_TheWorkedSearchOverEightConsultantsReturnsTheThreeTheDesignNames(t *testing.T) {
	p := consultantPool(t)

	p.found(t, "no condition keeps all eight", nil, "Zawadi Ndwiga", "Baraka Otieno", "Imani Kasongo", "Neema Sawe", "Jabari Mushi", "Tendai Moyo", "Rehema Kimaro", "Salim Abdalla")
	p.found(t, "the five conditions", marchSearch(), "Zawadi Ndwiga", "Jabari Mushi", "Salim Abdalla")

	steps := [][]poolCondition{marchSearch()[:1], marchSearch()[:2], marchSearch()[:3], marchSearch()[:4]}
	left := [][]string{
		{"Zawadi Ndwiga", "Baraka Otieno", "Imani Kasongo", "Jabari Mushi", "Tendai Moyo", "Rehema Kimaro", "Salim Abdalla"},
		{"Zawadi Ndwiga", "Baraka Otieno", "Imani Kasongo", "Jabari Mushi", "Rehema Kimaro", "Salim Abdalla"},
		{"Zawadi Ndwiga", "Imani Kasongo", "Jabari Mushi", "Rehema Kimaro", "Salim Abdalla"},
		{"Zawadi Ndwiga", "Jabari Mushi", "Rehema Kimaro", "Salim Abdalla"},
	}
	for i, where := range steps {
		p.found(t, "after condition "+string(rune('1'+i)), where, left[i]...)
	}

	reversed := slices.Clone(marchSearch())
	slices.Reverse(reversed)
	p.found(t, "the same conditions in the other order", reversed, "Zawadi Ndwiga", "Jabari Mushi", "Salim Abdalla")
}

func TestPoolSearch_ContainsOnAMultiSelectMatchesOneWholeOption(t *testing.T) {
	p := consultantPool(t)

	p.found(t, "a word inside an option is not an option", []poolCondition{poolContains("Expertise areas", "finance")})
	p.found(t, "the start of an option is not an option", []poolCondition{poolContains("Expertise areas", "Financial")})
	p.found(t, "a whole option", []poolCondition{poolContains("Expertise areas", "Sustainable finance")}, "Zawadi Ndwiga", "Salim Abdalla")
	p.found(t, "a whole option in another letter case", []poolCondition{poolContains("Expertise areas", "sustainable FINANCE")}, "Zawadi Ndwiga", "Salim Abdalla")
	p.found(t, "an option that is the first of a list and the last of another", []poolCondition{poolContains("Countries", "Rwanda")}, "Imani Kasongo")
	p.found(t, "contains on a free text answer stays a substring", []poolCondition{poolContains("Name", "zawadi")}, "Zawadi Ndwiga")
}

func TestPoolSearch_TheDayOperatorsCompareWrittenDaysAndIncludeTheDayItself(t *testing.T) {
	p := consultantPool(t)

	p.found(t, "on or before a day", []poolCondition{poolOnOrBefore("Free from", "2027-02-01")}, "Baraka Otieno", "Neema Sawe", "Salim Abdalla")
	p.found(t, "on or after a day", []poolCondition{poolOnOrAfter("Free from", "2027-03-01")}, "Jabari Mushi", "Imani Kasongo")
	p.found(t, "a window of two days", []poolCondition{poolOnOrAfter("Free from", "2027-02-10"), poolOnOrBefore("Free from", "2027-02-20")}, "Zawadi Ndwiga", "Tendai Moyo", "Rehema Kimaro")
	p.found(t, "a day nobody is free before", []poolCondition{poolOnOrBefore("Free from", "2026-11-30")})
}

func TestPoolSearch_AConditionThatCannotBeReadIsRefusedNotIgnored(t *testing.T) {
	p := consultantPool(t)
	refused := map[string]poolCondition{
		"a question the record does not ask": poolIs("Colour", "red"),
		"an operator that does not exist":    {"question": "Status", "operator": "resembles", "value": "Active"},
		"no operator":                        {"question": "Status", "value": "Active"},
		"no value":                           poolIs("Status", " "),
		"a day operator with a word":         poolOnOrBefore("Free from", "March"),
		"a day operator with another layout": poolOnOrBefore("Free from", "01/03/2027"),
	}
	for name, condition := range refused {
		if names, why := p.search(t, "test-owner", condition); why == "" {
			t.Errorf("%s: want a refusal, got %v", name, names)
		}
	}
}

func TestPoolSearch_ACallerWhoDoesNotAddRowsIsNotShownThePoolBySearching(t *testing.T) {
	p := consultantPool(t)

	names, why := p.search(t, p.resident, marchSearch()...)
	if why != "" {
		t.Fatalf("a member's search was refused with %q, want an empty list", why)
	}
	expectBusinesses(t, "a member who does not hold the adding role", names)
	names, why = p.search(t, p.resident)
	if why != "" || len(names) != 0 {
		t.Errorf("a member with no condition sees %v (%s), want nothing", names, why)
	}
}
