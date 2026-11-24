package http

import (
	"context"
	"net/http"
	"slices"
	"testing"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

func holderQuestions(required ...string) []agencymodels.StepQuestion {
	all := []string{"title", "issuer", "outcome"}
	out := make([]agencymodels.StepQuestion, 0, len(all))
	for _, code := range all {
		out = append(out, agencymodels.StepQuestion{Code: code, Prompt: code, Required: slices.Contains(required, code)})
	}
	return out
}

func recordCodesOf(action string, fields ...string) []string {
	out := make([]string, 0, len(fields))
	for _, field := range fields {
		out = append(out, mwanachamaagency.RecordPermissionCode("tender", action, field))
	}
	return out
}

func TestAGeneratedStepHolderRule(t *testing.T) {
	star := mwanachamaagency.RecordFieldStar
	cases := []struct {
		name      string
		questions []agencymodels.StepQuestion
		action    string
		granted   []string
		want      bool
	}{
		{"add star holds the add step", holderQuestions("title", "issuer"), "add", recordCodesOf("add", star), true},
		{"add for every required field holds the add step", holderQuestions("title", "issuer"), "add", recordCodesOf("add", "title", "issuer"), true},
		{"add for every required field and an optional one holds the add step", holderQuestions("title", "issuer"), "add", recordCodesOf("add", "title", "issuer", "outcome"), true},
		{"add for only some required fields does not hold the add step", holderQuestions("title", "issuer"), "add", recordCodesOf("add", "title"), false},
		{"add for only an optional field does not hold the add step of a record with required fields", holderQuestions("title"), "add", recordCodesOf("add", "outcome"), false},
		{"view star does not hold the add step", holderQuestions("title"), "add", recordCodesOf("view", star), false},
		{"edit star does not hold the add step", holderQuestions("title"), "add", recordCodesOf("edit", star), false},
		{"another record's add star does not hold the add step", holderQuestions("title"), "add", []string{mwanachamaagency.RecordPermissionCode("client", "add", star)}, false},
		{"no code does not hold the add step", holderQuestions("title"), "add", nil, false},
		{"a record with no required field is held by add star", holderQuestions(), "add", recordCodesOf("add", star), true},
		{"a record with no required field is held by one add field", holderQuestions(), "add", recordCodesOf("add", "outcome"), true},
		{"a record with no required field is not held by view", holderQuestions(), "add", recordCodesOf("view", star, "outcome"), false},
		{"a record with no required field is not held by an add code of a field it lacks", holderQuestions(), "add", recordCodesOf("add", "colour"), false},
		{"edit star holds the edit step", holderQuestions("title"), "edit", recordCodesOf("edit", star), true},
		{"one edit field holds the edit step", holderQuestions("title"), "edit", recordCodesOf("edit", "outcome"), true},
		{"add star does not hold the edit step", holderQuestions("title"), "edit", recordCodesOf("add", star), false},
		{"delete holds the delete step", holderQuestions("title"), "delete", []string{"record.tender.delete"}, true},
		{"edit star does not hold the delete step", holderQuestions("title"), "delete", recordCodesOf("edit", star), false},
		{"delete of another record does not hold the delete step", holderQuestions("title"), "delete", []string{"record.client.delete"}, false},
		{"an unknown action is held by nobody", holderQuestions("title"), "view", recordCodesOf("view", star), false},
	}
	for _, c := range cases {
		if got := roleHoldsGeneratedStep("tender", c.questions, c.action, c.granted); got != c.want {
			t.Errorf("%s: holds = %v, want %v", c.name, got, c.want)
		}
	}
}

type holdersWalk struct {
	rowStepWalk
	first, second string
}

func tenderHolderQuestions() []agencymodels.StepQuestion {
	return []agencymodels.StepQuestion{
		{Prompt: "Tender", AnswerType: agencymodels.AnswerFreeText, Required: true},
		{Prompt: "Client", AnswerType: agencymodels.AnswerFreeText, Required: true},
		{Prompt: "Notes", AnswerType: agencymodels.AnswerFreeText},
	}
}

func fieldCodeOfPrompt(t *testing.T, record agencymodels.Record, prompt string) string {
	t.Helper()
	for _, q := range record.Questions {
		if q.Prompt == prompt {
			return q.Code
		}
	}
	t.Fatalf("the record has no question %q", prompt)
	return ""
}

func newHoldersWalk(t *testing.T, grants func(t *testing.T, record agencymodels.Record) map[string][]string) holdersWalk {
	t.Helper()
	shape := func(w stepRunWalk, r *agencymodels.Record) {
		auditor, err := mustManager(t, w).CreateRole(context.Background(), agencymodels.Role{DraftID: w.draftID, Name: "Auditor"})
		if err != nil {
			t.Fatalf("CreateRole Auditor: %v", err)
		}
		w.roles["Auditor"] = auditor.ID
		r.Questions = tenderHolderQuestions()
	}
	walk := newRowStepWalkGranting(t, shape, func(record agencymodels.Record) map[string][]string { return grants(t, record) })
	return holdersWalk{rowStepWalk: walk, first: walk.groupCarrying(t, "Group one"), second: walk.groupCarrying(t, "Group two")}
}

func mustManager(t *testing.T, w stepRunWalk) mwanachamaagency.AgencyManager {
	t.Helper()
	mgr, err := w.deps.Registry.AgencyManager(context.Background(), w.instance)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	return mgr
}

func addGrants(t *testing.T, record agencymodels.Record) map[string][]string {
	star := mwanachamaagency.RecordFieldStar
	code := func(action, field string) string { return mwanachamaagency.RecordPermissionCode(record.Code, action, field) }
	return map[string][]string{
		"Coordinator": {code("add", star)},
		"Liaison":     {code("add", fieldCodeOfPrompt(t, record, "Tender")), code("add", fieldCodeOfPrompt(t, record, "Client"))},
		"Volunteer":   {code("view", star)},
		"Auditor":     {code("add", fieldCodeOfPrompt(t, record, "Tender"))},
	}
}

func (w holdersWalk) offered(t *testing.T, as *http.Cookie, title string) bool {
	t.Helper()
	return w.listed(t, as, title, "/my-open-steps?available=true") && w.listed(t, as, title, "/my-open-steps")
}

func (w holdersWalk) listed(t *testing.T, as *http.Cookie, title, path string) bool {
	t.Helper()
	rec := w.call(t, "GET", "/instances/"+w.instance+path, nil, as)
	if rec.Code != http.StatusOK {
		t.Fatalf("GET %s: %d %s", path, rec.Code, rec.Body.String())
	}
	for _, item := range decodeObjects(t, rec) {
		if item["title"] == title {
			return true
		}
	}
	return false
}

func TestEveryRoleThatHoldsAddForTheRequiredFieldsIsOfferedTheAddStepThroughTheAssumedGroup(t *testing.T) {
	w := newHoldersWalk(t, addGrants)
	byStar := w.callerIn(t, "p1", "Coordinator", w.first)
	byFields := w.callerIn(t, "p2", "Liaison", w.first)
	viewOnly := w.callerIn(t, "p3", "Volunteer", w.first)
	someFields := w.callerIn(t, "p5", "Auditor", w.first)
	elsewhere := w.callerIn(t, "p4", "Coordinator", w.second)

	for name, as := range map[string]*http.Cookie{"the role with add star": byStar, "the role with add for each required field": byFields, "the same role in another group": elsewhere} {
		if !w.offered(t, as, "Add a tender") {
			t.Errorf("%s is not offered Add a tender", name)
		}
	}
	for name, as := range map[string]*http.Cookie{"the role with view only": viewOnly, "the role with add for only some required fields": someFields} {
		if w.offered(t, as, "Add a tender") {
			t.Errorf("%s is offered Add a tender", name)
		}
	}
}

func TestAPersonWhoAssumesNoGroupIsOfferedNoGeneratedStep(t *testing.T) {
	w := newHoldersWalk(t, addGrants)
	as := w.callerIn(t, "p1", "Coordinator", w.first)
	w.assumeNothing(t, as)

	for _, path := range []string{"/my-open-steps?available=true", "/my-open-steps"} {
		rec := w.call(t, "GET", "/instances/"+w.instance+path, nil, as)
		if rec.Code == http.StatusOK && len(decodeObjects(t, rec)) > 0 {
			t.Errorf("a person with no assumed group is offered %v on %s", titles(decodeObjects(t, rec)), path)
		}
	}
}

func TestAPersonIsOfferedTheAddStepOnlyThroughTheSeatOfTheGroupAssumed(t *testing.T) {
	w := newHoldersWalk(t, addGrants)
	as := w.callerIn(t, "p6", "Volunteer", w.first)
	w.grantSeat(t, "p6", w.second, w.roles["Coordinator"])

	if w.offered(t, as, "Add a tender") {
		t.Error("a person assuming the group where the role has no add code is offered Add a tender")
	}
	w.assumeDirectly(t, as, "p6", w.second)
	if !w.offered(t, as, "Add a tender") {
		t.Error("the same person assuming the group of the seat with add is not offered Add a tender")
	}
}

func TestEditAndDeleteStepsAreHeldByEveryRoleThatCarriesTheirCodes(t *testing.T) {
	grants := func(t *testing.T, record agencymodels.Record) map[string][]string {
		star := mwanachamaagency.RecordFieldStar
		code := func(action, field string) string { return mwanachamaagency.RecordPermissionCode(record.Code, action, field) }
		return map[string][]string{
			"Coordinator": {code("edit", fieldCodeOfPrompt(t, record, "Notes")), code("delete", "")},
			"Liaison":     {code("edit", star)},
			"Volunteer":   {code("view", star)},
			"Auditor":     {code("delete", "")},
		}
	}
	w := newHoldersWalk(t, grants)
	coordinator := w.callerIn(t, "p1", "Coordinator", w.first)
	liaison := w.callerIn(t, "p2", "Liaison", w.first)
	volunteer := w.callerIn(t, "p3", "Volunteer", w.first)
	auditor := w.callerIn(t, "p5", "Auditor", w.first)

	want := map[string]map[string]bool{
		"Edit a tender":   {"coordinator": true, "liaison": true, "volunteer": false, "auditor": false},
		"Delete a tender": {"coordinator": true, "liaison": false, "volunteer": false, "auditor": true},
		"Add a tender":    {"coordinator": false, "liaison": false, "volunteer": false, "auditor": false},
	}
	people := map[string]*http.Cookie{"coordinator": coordinator, "liaison": liaison, "volunteer": volunteer, "auditor": auditor}
	for title, holders := range want {
		for who, expected := range holders {
			if got := w.offered(t, people[who], title); got != expected {
				t.Errorf("%s offered %q = %v, want %v", who, title, got, expected)
			}
		}
	}
}

func TestADesignedStepStaysWithItsOneRoleThroughTheAssumedGroupsSeat(t *testing.T) {
	w := newHoldersWalk(t, func(t *testing.T, record agencymodels.Record) map[string][]string {
		return map[string][]string{"Volunteer": addGrants(t, record)["Coordinator"]}
	})
	volunteer := w.callerIn(t, "p3", "Volunteer", w.first)
	coordinator := w.callerIn(t, "p1", "Coordinator", w.first)

	if !w.offered(t, volunteer, "Report a referral") {
		t.Error("the role of the designed step is not offered it")
	}
	if w.offered(t, coordinator, "Report a referral") {
		t.Error("a role that does not hold the designed step is offered it")
	}
}

func TestTheStepBoardRefusesAGeneratedStepToARoleWithoutItsCodes(t *testing.T) {
	w := newHoldersWalk(t, addGrants)
	holder := w.callerIn(t, "p2", "Liaison", w.first)
	partial := w.callerIn(t, "p5", "Auditor", w.first)
	document, step := w.publishedGeneratedStep(t, "add")
	board := stepRoleBoard{reg: w.deps.Registry, instanceID: w.instance}

	if err := board.requireHeld(w.sessionOf("p2", holder), document, step); err != nil {
		t.Errorf("the role holding add for every required field is refused: %v", err)
	}
	if err := board.requireHeld(w.sessionOf("p5", partial), document, step); err == nil {
		t.Error("the role holding add for only some required fields is let through the step board")
	}
}

func (w holdersWalk) sessionOf(subject string, as *http.Cookie) context.Context {
	ctx := withPartitionContext(accounts.WithID(context.Background(), subject), w.instance)
	return agencies.WithLoginSession(ctx, cookieSessionKeyOf(as.Value))
}

func (w holdersWalk) publishedGeneratedStep(t *testing.T, action string) (agencymodels.AgencyDocument, agencymodels.DocumentWorkItem) {
	t.Helper()
	publication, err := w.manager.GetPublicationForChannel(context.Background(), "")
	if err != nil {
		t.Fatalf("GetPublicationForChannel: %v", err)
	}
	for _, step := range publication.Document.WorkItems {
		if step.RowAction == action && step.RowRecord == w.record.Identity() {
			return publication.Document, step
		}
	}
	t.Fatalf("the publication has no %s step of %s", action, w.record.Identity())
	return agencymodels.AgencyDocument{}, agencymodels.DocumentWorkItem{}
}
