package http

import (
	"context"
	"net/http"
	"slices"
	"strings"
	"testing"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	mwanachamaactor "github.com/aosanya/mwanachama-backend-actor"
	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"

	"wakalaserver/internal/agencies"
)

const declarationStepTitle = "Declare your interests"

func declarationPlan() []stepSpec {
	return []stepSpec{
		{title: declarationStepTitle, code: "WI-56-1", form: "Declaration of interests", role: "Council member", questions: []agencymodels.StepQuestion{
			{Code: "paid_office", Prompt: "Paid office elsewhere", AnswerType: agencymodels.AnswerYesNo, Required: true},
			{Code: "shares", Prompt: "Companies you hold a share in", AnswerType: agencymodels.AnswerFreeText},
			{Code: "gifts", Prompt: "Gifts received over the limit", AnswerType: agencymodels.AnswerFreeText},
		}},
		{title: "Review the register", form: "Register review", role: "Data officer", questions: []agencymodels.StepQuestion{
			{Prompt: "Note", AnswerType: agencymodels.AnswerFreeText, Required: true},
		}},
	}
}

type declarationWalk struct {
	stepRunWalk
	members map[string]string
	officer *http.Cookie
	holding map[string][]string
}

func newDeclarationWalk(t *testing.T) declarationWalk {
	t.Helper()
	return newDeclarationWalkOf(t, "", declarationPlan())
}

func newDeclarationWalkOf(t *testing.T, workflowCode string, plan []stepSpec) declarationWalk {
	t.Helper()
	w := declarationWalk{stepRunWalk: newStepRunWalkCoded(t, stepRunDB(t), workflowCode, plan), members: map[string]string{}, holding: map[string][]string{}}
	w.holdsOnTheDeclarations(t, "Council member", "add.*")
	w.holdsOnTheDeclarations(t, "Data officer", "view.*")
	for _, name := range []string{"Aranka Zoldhalmi", "Botond Kisretesi", "Csilla Vizmelleki"} {
		w.people[name] = w.seatAgent(t, name, "Council member")
	}
	w.officer = w.seatAgent(t, "Dorina Nagyligeti", "Data officer")
	return w
}

func (w declarationWalk) declarationRecord(t *testing.T) agencymodels.Record {
	t.Helper()
	for _, r := range w.draftRecords(t) {
		if r.Name == declarationStepTitle {
			return r
		}
	}
	t.Fatal("no record of the declaration step")
	return agencymodels.Record{}
}

func (w declarationWalk) holdsOnTheDeclarations(t *testing.T, role string, kinds ...string) {
	t.Helper()
	record := w.declarationRecord(t)
	roleID := w.roles[role]
	w.holding[roleID] = nil
	for _, kind := range kinds {
		w.holding[roleID] = append(w.holding[roleID], recordCode(record, kind))
	}
	w.deps.rolePermissionsOverride = func(ctx context.Context, id string) ([]string, error) {
		published, err := w.deps.cachedRolePermissions(withPartitionContext(ctx, w.instance), id)
		if err != nil {
			return nil, err
		}
		kept, narrowed := w.holding[id]
		if !narrowed {
			return published, nil
		}
		published = slices.DeleteFunc(published, func(code string) bool {
			return strings.HasPrefix(code, mwanachamaagency.RecordPermissionCode(record.Code, ""))
		})
		return append(published, kept...), nil
	}
}

func (w declarationWalk) seatAgent(t *testing.T, name, role string) *http.Cookie {
	t.Helper()
	ctx := context.Background()
	directory, err := w.deps.Registry.ActorManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	actor, err := directory.CreateActor(ctx, mwanachamaactor.Actor{DisplayName: name})
	if err != nil {
		t.Fatalf("CreateActor %s: %v", name, err)
	}
	w.members[name] = actor.ID
	path := "/instances/" + w.instance
	if rec := w.call(t, "POST", path+"/agents", map[string]any{"user_id": actor.ID}, w.owner); rec.Code != http.StatusCreated {
		t.Fatalf("owner adds %s: %d %s", name, rec.Code, rec.Body.String())
	}
	w.seatAs(t, actor.ID, w.roles[role])
	return w.cookieFor(t, actor.ID)
}

func (w declarationWalk) declare(t *testing.T, name, shares string) {
	t.Helper()
	answers := map[string]string{"Paid office elsewhere": "no", "Companies you hold a share in": shares, "Gifts received over the limit": "none"}
	if rec := w.submit(t, w.people[name], declarationStepTitle, answers, ""); rec.Code != http.StatusCreated {
		t.Fatalf("%s declares: %d %s", name, rec.Code, rec.Body.String())
	}
}

func (w declarationWalk) register(t *testing.T, as *http.Cookie) map[string]any {
	t.Helper()
	rec := w.call(t, "GET", "/instances/"+w.instance+"/declarations", nil, as)
	if rec.Code != http.StatusOK {
		t.Fatalf("declarations: %d %s", rec.Code, rec.Body.String())
	}
	return decodeObject(t, rec)
}

func objectsIn(t *testing.T, register map[string]any, key string) []map[string]any {
	t.Helper()
	raw, ok := register[key].([]any)
	if !ok {
		t.Fatalf("%s is not a list in %v", key, register)
	}
	out := make([]map[string]any, 0, len(raw))
	for _, item := range raw {
		out = append(out, item.(map[string]any))
	}
	return out
}

func namesIn(items []map[string]any) []string {
	out := []string{}
	for _, item := range items {
		out = append(out, item["name"].(string))
	}
	return out
}

func TestTheDataOfficerSeesWhoDeclaredWithAnswersAndWhoHasNot(t *testing.T) {
	w := newDeclarationWalk(t)
	w.declare(t, "Botond Kisretesi", "Retesi Malom Kft")
	w.declare(t, "Aranka Zoldhalmi", "none")

	register := w.register(t, w.officer)
	declared := objectsIn(t, register, "declared")
	if got := namesIn(declared); !slices.Equal(got, []string{"Botond Kisretesi", "Aranka Zoldhalmi"}) {
		t.Fatalf("declared = %v, want Botond then Aranka, oldest first", got)
	}
	first := declared[0]
	answers := promptKeyed(w.fieldPrompts(t), asMap(first["answers"]))
	if first["actor_id"] != w.members["Botond Kisretesi"] || first["row_id"] == "" || first["declared_on"] == "" || first["own"] != false ||
		answers["Companies you hold a share in"] != "Retesi Malom Kft" || answers["Paid office elsewhere"] != "no" {
		t.Errorf("the first declaration = %v", first)
	}
	notDeclared := objectsIn(t, register, "not_declared")
	if len(notDeclared) != 1 || notDeclared[0]["name"] != "Csilla Vizmelleki" || notDeclared[0]["actor_id"] != w.members["Csilla Vizmelleki"] {
		t.Errorf("not_declared = %v, want only Csilla", notDeclared)
	}
	if register["not_declared_count"] != float64(1) || register["total"] != float64(3) || register["can_read_all"] != true {
		t.Errorf("counts = %v", register)
	}
}

func TestTheOwnerSeesTheWholeRegister(t *testing.T) {
	w := newDeclarationWalk(t)
	w.declare(t, "Aranka Zoldhalmi", "none")

	register := w.register(t, w.owner)
	if register["can_read_all"] != true || len(objectsIn(t, register, "declared")) != 1 || register["not_declared_count"] != float64(2) || register["total"] != float64(3) {
		t.Errorf("the owner sees %v", register)
	}
}

func (w declarationWalk) seatIn(t *testing.T, name, role, groupID string) *http.Cookie {
	t.Helper()
	directory, err := w.deps.Registry.ActorManager(context.Background(), w.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	actor, err := directory.CreateActor(context.Background(), mwanachamaactor.Actor{DisplayName: name})
	if err != nil {
		t.Fatalf("CreateActor %s: %v", name, err)
	}
	w.members[name] = actor.ID
	w.people[name] = w.callerIn(t, actor.ID, role, groupID)
	return w.people[name]
}

func TestACouncilMemberHoldingNoViewCodeSeesNothingNotEvenTheirOwnDeclaration(t *testing.T) {
	w := newDeclarationWalk(t)
	w.declare(t, "Botond Kisretesi", "Retesi Malom Kft")
	w.declare(t, "Aranka Zoldhalmi", "none")

	for _, name := range []string{"Botond Kisretesi", "Csilla Vizmelleki"} {
		register := w.register(t, w.people[name])
		if len(objectsIn(t, register, "declared")) != 0 || len(objectsIn(t, register, "not_declared")) != 0 ||
			register["not_declared_count"] != float64(0) || register["total"] != float64(0) || register["can_read_all"] != false {
			t.Errorf("%s holds no view code and sees %v, want nothing", name, register)
		}
	}
}

func TestAReaderWhoseGroupSharesATagWithARowSeesThatRowAndNotTheOthers(t *testing.T) {
	w := newDeclarationWalk(t)
	council := w.groupCarrying(t, "Council", "council")
	w.seatIn(t, "Gabor Tarnoki", "Council member", council)
	w.declare(t, "Gabor Tarnoki", "Tarnoki Kft")
	w.declare(t, "Aranka Zoldhalmi", "none")
	reader := w.seatIn(t, "Hajnal Olaszi", "Data officer", council)

	register := w.register(t, reader)
	if got := namesIn(objectsIn(t, register, "declared")); !slices.Equal(got, []string{"Gabor Tarnoki"}) {
		t.Fatalf("declared = %v, want only the row that carries the tag of the reader's group", got)
	}
	if len(objectsIn(t, register, "not_declared")) != 0 || register["not_declared_count"] != float64(0) || register["can_read_all"] != false {
		t.Errorf("a reader limited by tag sees %v, want no not-declared list and can_read_all false", register)
	}
}

func TestAReaderWhoseGroupSharesNoTagWithTheRowsSeesNothing(t *testing.T) {
	w := newDeclarationWalk(t)
	w.declare(t, "Aranka Zoldhalmi", "none")
	elsewhere := w.groupCarrying(t, "Elsewhere", "elsewhere")
	reader := w.seatIn(t, "Hajnal Olaszi", "Data officer", elsewhere)

	register := w.register(t, reader)
	if len(objectsIn(t, register, "declared")) != 0 || register["can_read_all"] != false {
		t.Errorf("a reader sharing no tag sees %v, want no row", register)
	}
}

func TestAPersonWithViewCodesWhoHasNotAssumedAGroupSeesNothing(t *testing.T) {
	w := newDeclarationWalk(t)
	w.declare(t, "Aranka Zoldhalmi", "none")
	someGroup := w.groupCarrying(t, "Council", "council")
	directory, err := w.deps.Registry.ActorManager(context.Background(), w.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	actor, err := directory.CreateActor(context.Background(), mwanachamaactor.Actor{DisplayName: "Ibolya Fenyesi"})
	if err != nil {
		t.Fatalf("CreateActor: %v", err)
	}
	if err := w.deps.Registry.AddMember(context.Background(), w.instance, actor.ID, agencies.RoleAgent); err != nil {
		t.Fatalf("AddMember: %v", err)
	}
	w.grantSeat(t, actor.ID, someGroup, w.roles["Data officer"])

	register := w.register(t, w.cookieFor(t, actor.ID))
	if len(objectsIn(t, register, "declared")) != 0 || register["can_read_all"] != false {
		t.Errorf("a person with no assumed group sees %v, want nothing", register)
	}
}

func TestAReaderWithViewOfSomeFieldsSeesOnlyThoseFields(t *testing.T) {
	w := newDeclarationWalk(t)
	w.declare(t, "Botond Kisretesi", "Retesi Malom Kft")
	w.holdsOnTheDeclarations(t, "Data officer", "view.shares", "view.paid_office")

	declared := objectsIn(t, w.register(t, w.officer), "declared")
	if len(declared) != 1 {
		t.Fatalf("declared = %v, want Botond's row", declared)
	}
	got := map[string]string{}
	for _, f := range fieldsOf(t, declared[0]) {
		got[f.prompt] = f.value
	}
	if len(got) != 2 || got["Companies you hold a share in"] != "Retesi Malom Kft" || got["Paid office elsewhere"] != "no" {
		t.Errorf("fields = %v, want the two fields the reader may view and not the gifts", got)
	}
	answers := promptKeyed(w.fieldPrompts(t), asMap(declared[0]["answers"]))
	if _, leaked := answers["Gifts received over the limit"]; leaked || len(answers) != 2 {
		t.Errorf("answers = %v, want only the two fields the reader may view", answers)
	}
}

func TestAResidentWithoutAnyRoleSeesNothing(t *testing.T) {
	w := newDeclarationWalk(t)
	w.declare(t, "Aranka Zoldhalmi", "none")
	ctx := context.Background()
	directory, err := w.deps.Registry.ActorManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	neighbour, err := directory.CreateActor(ctx, mwanachamaactor.Actor{DisplayName: "Emese Tarnokvolgyi"})
	if err != nil {
		t.Fatalf("CreateActor: %v", err)
	}
	if err := w.deps.Registry.AddMember(ctx, w.instance, neighbour.ID, agencies.RoleResident); err != nil {
		t.Fatalf("AddMember: %v", err)
	}

	register := w.register(t, w.cookieFor(t, neighbour.ID))
	if len(objectsIn(t, register, "declared")) != 0 || len(objectsIn(t, register, "not_declared")) != 0 ||
		register["not_declared_count"] != float64(0) || register["total"] != float64(0) || register["can_read_all"] != false {
		t.Errorf("the resident sees %v, want nothing", register)
	}
}

func TestAStrangerToTheAgencyIsRefused(t *testing.T) {
	w := newDeclarationWalk(t)
	if rec := w.call(t, "GET", "/instances/"+w.instance+"/declarations", nil, w.cookieFor(t, "stranger")); rec.Code == http.StatusOK {
		t.Errorf("a stranger reads the register: %d %s", rec.Code, rec.Body.String())
	}
}

func TestAReplacedDeclarationShowsOnlyTheCorrectedRow(t *testing.T) {
	w := newDeclarationWalk(t)
	w.declare(t, "Aranka Zoldhalmi", "none")
	ctx := context.Background()
	mgr, err := w.deps.Registry.AgencyManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	records, err := mgr.ListRecords(ctx, w.draftID, mwanachamaagency.RecordFilter{})
	if err != nil {
		t.Fatalf("ListRecords: %v", err)
	}
	var register agencymodels.Record
	for _, r := range records {
		if r.Name == declarationStepTitle {
			register = r
		}
	}
	rows, err := mgr.ListRecordRows(ctx, w.draftID, mwanachamaagency.RecordRowFilter{RecordCode: register.Code})
	if err != nil || len(rows) != 1 {
		t.Fatalf("ListRecordRows = %v, %v", rows, err)
	}
	corrected, err := mgr.CreateRecordRow(ctx, agencymodels.RecordRow{
		DraftID: w.draftID, RecordID: register.ID, RoleID: addingRoleOf(t, mgr, w.draftID, register), AddedBy: rows[0].AddedBy,
		Replaces: rows[0].ID, Answers: map[string]string{"Paid office elsewhere": "yes", "Companies you hold a share in": "Zoldhalom Szolgaltato Zrt", "Gifts received over the limit": "none"},
	})
	if err != nil {
		t.Fatalf("CreateRecordRow: %v", err)
	}

	declared := objectsIn(t, w.register(t, w.officer), "declared")
	answers := promptKeyed(w.fieldPrompts(t), asMap(declared[0]["answers"]))
	if len(declared) != 1 || declared[0]["row_id"] != corrected.ID || answers["Companies you hold a share in"] != "Zoldhalom Szolgaltato Zrt" {
		t.Errorf("the officer sees %v, want only the corrected row", declared)
	}
}

func importedDeclarationPlan(stepCode string) []stepSpec {
	plan := declarationPlan()
	plan[0].code = stepCode
	return plan
}

func TestAnImportedAgencyWhoseStepCodesWereReMintedStillShowsTheRegister(t *testing.T) {
	w := newDeclarationWalkOf(t, "W-56", importedDeclarationPlan("WI-191"))
	w.declare(t, "Botond Kisretesi", "Retesi Malom Kft")

	register := w.register(t, w.officer)
	declared := objectsIn(t, register, "declared")
	if got := namesIn(declared); !slices.Equal(got, []string{"Botond Kisretesi"}) {
		t.Fatalf("declared = %v, want Botond on an agency whose declaration step is WI-191", got)
	}
	notDeclared := objectsIn(t, register, "not_declared")
	if len(notDeclared) != 2 || register["total"] != float64(3) || register["can_read_all"] != true {
		t.Errorf("the register = %v, want two still to declare of three", register)
	}
}

func TestAnAgencyWhoseDeclarationWorkflowIsNotW56AndWhoseStepCodeIsNotTheTemplatesAnswersAnEmptyRegister(t *testing.T) {
	w := newDeclarationWalkOf(t, "W-12", importedDeclarationPlan("WI-191"))
	register := w.register(t, w.owner)
	if len(objectsIn(t, register, "declared")) != 0 || register["total"] != float64(0) {
		t.Errorf("the register = %v, want the empty answer when the workflow is not the declaration one", register)
	}
}

func TestAnAgencyWithoutADeclarationStepAnswersAnEmptyRegister(t *testing.T) {
	w := referral(t)
	rec := w.call(t, "GET", "/instances/"+w.instance+"/declarations", nil, w.owner)
	if rec.Code != http.StatusOK {
		t.Fatalf("declarations: %d %s", rec.Code, rec.Body.String())
	}
	register := decodeObject(t, rec)
	if len(objectsIn(t, register, "declared")) != 0 || len(objectsIn(t, register, "not_declared")) != 0 ||
		register["not_declared_count"] != float64(0) || register["total"] != float64(0) || register["can_read_all"] != false {
		t.Errorf("the register = %v, want the empty answer", register)
	}
}

func TestTheDeclarationToolAnswersTheSameAsTheRoute(t *testing.T) {
	w := newDeclarationWalk(t)
	w.declare(t, "Aranka Zoldhalmi", "none")

	for _, who := range []struct {
		subject string
		as      *http.Cookie
	}{{w.members["Dorina Nagyligeti"], w.officer}, {w.members["Aranka Zoldhalmi"], w.people["Aranka Zoldhalmi"]}} {
		ctx := w.asSubject(who.subject)
		serverSide, clientSide := mcp.NewInMemoryTransports()
		session, err := newMCPServer(w.deps).Connect(ctx, serverSide, nil)
		if err != nil {
			t.Fatalf("connect server: %v", err)
		}
		t.Cleanup(func() { session.Close() })
		client, err := mcp.NewClient(&mcp.Implementation{Name: "test", Version: "1"}, nil).Connect(ctx, clientSide, nil)
		if err != nil {
			t.Fatalf("connect client: %v", err)
		}
		t.Cleanup(func() { client.Close() })
		out, err := client.CallTool(ctx, &mcp.CallToolParams{Name: "agency_list_declarations", Arguments: map[string]any{"instance_id": w.instance}})
		if err != nil || out.IsError {
			t.Fatalf("agency_list_declarations as %s: %v %v", who.subject, err, out)
		}
		got, _ := out.StructuredContent.(map[string]any)
		want := w.register(t, who.as)
		if got["can_read_all"] != want["can_read_all"] || got["total"] != want["total"] || got["not_declared_count"] != want["not_declared_count"] ||
			len(objectsIn(t, got, "declared")) != len(objectsIn(t, want, "declared")) {
			t.Errorf("the tool answered %v and the route %v", got, want)
		}
	}
}

type shownField struct{ key, prompt, value string }

func fieldsOf(t *testing.T, item map[string]any) []shownField {
	t.Helper()
	raw, ok := item["fields"].([]any)
	if !ok {
		t.Fatalf("fields is not a list in %v", item)
	}
	out := make([]shownField, 0, len(raw))
	for _, entry := range raw {
		f := asMap(entry)
		out = append(out, shownField{key: f["key"].(string), prompt: f["prompt"].(string), value: f["value"].(string)})
	}
	return out
}

func (w stepRunWalk) renameQuestion(t *testing.T, from, to string) {
	t.Helper()
	ctx := context.Background()
	m, err := w.deps.Registry.AgencyManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	records, err := m.ListRecords(ctx, w.draftID, mwanachamaagency.RecordFilter{})
	if err != nil {
		t.Fatalf("ListRecords: %v", err)
	}
	for _, r := range records {
		changed := false
		for i := range r.Questions {
			if r.Questions[i].Prompt == from {
				r.Questions[i].Prompt = to
				changed = true
			}
		}
		if changed {
			if _, err := m.UpdateRecord(ctx, r); err != nil {
				t.Fatalf("UpdateRecord: %v", err)
			}
		}
	}
}

func TestEachDeclaredAnswerCarriesItsKeyItsPromptAndItsValue(t *testing.T) {
	w := newDeclarationWalk(t)
	w.declare(t, "Botond Kisretesi", "Retesi Malom Kft")

	declared := objectsIn(t, w.register(t, w.officer), "declared")
	prompts := w.fieldPrompts(t)
	got := map[string]string{}
	for _, f := range fieldsOf(t, declared[0]) {
		if f.key == "" || prompts[f.key] != f.prompt {
			t.Errorf("field %v: key %q does not carry its prompt", f, f.key)
		}
		got[f.prompt] = f.value
	}
	if got["Companies you hold a share in"] != "Retesi Malom Kft" || got["Paid office elsewhere"] != "no" || len(got) != 3 {
		t.Errorf("fields = %v", got)
	}
}

func TestARenamedDeclarationQuestionShowsItsNewPromptOnTheOldAnswer(t *testing.T) {
	w := newDeclarationWalk(t)
	w.declare(t, "Botond Kisretesi", "Retesi Malom Kft")
	w.renameQuestion(t, "Companies you hold a share in", "Firms you own part of")

	declared := objectsIn(t, w.register(t, w.officer), "declared")
	got := map[string]string{}
	for _, f := range fieldsOf(t, declared[0]) {
		got[f.prompt] = f.value
	}
	if got["Firms you own part of"] != "Retesi Malom Kft" || got["Companies you hold a share in"] != "" {
		t.Errorf("fields = %v, want the new prompt on the old answer", got)
	}
}
