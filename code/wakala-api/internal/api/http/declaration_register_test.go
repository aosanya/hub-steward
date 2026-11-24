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

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

const declarationStepTitle = "Declare your interests"

func declarationPlan() []stepSpec {
	return []stepSpec{
		{title: declarationStepTitle, code: "WI-56-1", form: "Declaration of interests", role: "Council member", questions: []agencymodels.StepQuestion{
			{Prompt: "Paid office elsewhere", AnswerType: agencymodels.AnswerYesNo, Required: true},
			{Prompt: "Companies you hold a share in", AnswerType: agencymodels.AnswerFreeText},
			{Prompt: "Gifts received over the limit", AnswerType: agencymodels.AnswerFreeText},
		}},
		{title: "Review the register", form: "Register review", role: "Data officer", questions: []agencymodels.StepQuestion{
			{Prompt: "Note", AnswerType: agencymodels.AnswerFreeText},
		}},
	}
}

type declarationWalk struct {
	stepRunWalk
	members map[string]string
	officer *http.Cookie
}

func newDeclarationWalk(t *testing.T) declarationWalk {
	t.Helper()
	return newDeclarationWalkOf(t, "", declarationPlan())
}

func newDeclarationWalkOf(t *testing.T, workflowCode string, plan []stepSpec) declarationWalk {
	t.Helper()
	w := declarationWalk{stepRunWalk: newStepRunWalkCoded(t, stepRunDB(t), workflowCode, plan), members: map[string]string{}}
	held := map[string][]string{w.roles["Data officer"]: {"declaration.read"}}
	w.deps.rolePermissionsOverride = func(_ context.Context, roleID string) ([]string, error) {
		return held[roleID], nil
	}
	for _, name := range []string{"Aranka Zoldhalmi", "Botond Kisretesi", "Csilla Vizmelleki"} {
		w.people[name] = w.seatAgent(t, name, "Council member")
	}
	w.officer = w.seatAgent(t, "Dorina Nagyligeti", "Data officer")
	return w
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
	if rec := w.call(t, "PUT", path+"/members/"+actor.ID+"/agency-role", map[string]any{"agency_role_id": w.roles[role]}, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("owner seats %s as %s: %d %s", name, role, rec.Code, rec.Body.String())
	}
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

func TestACouncilMemberWithoutThePermissionSeesOnlyTheirOwnDeclaration(t *testing.T) {
	w := newDeclarationWalk(t)
	w.declare(t, "Botond Kisretesi", "Retesi Malom Kft")
	w.declare(t, "Aranka Zoldhalmi", "none")

	register := w.register(t, w.people["Botond Kisretesi"])
	declared := objectsIn(t, register, "declared")
	if len(declared) != 1 || declared[0]["name"] != "Botond Kisretesi" || declared[0]["own"] != true {
		t.Errorf("Botond sees %v, want only his own row", declared)
	}
	if got := objectsIn(t, register, "not_declared"); len(got) != 0 {
		t.Errorf("not_declared = %v, want none", got)
	}
	if register["not_declared_count"] != float64(0) || register["total"] != float64(0) || register["can_read_all"] != false {
		t.Errorf("counts = %v", register)
	}

	silent := w.register(t, w.people["Csilla Vizmelleki"])
	if got := objectsIn(t, silent, "declared"); len(got) != 0 || silent["can_read_all"] != false {
		t.Errorf("Csilla has not declared and sees %v", silent)
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
		DraftID: w.draftID, RecordID: register.ID, RoleID: register.RoleID, AddedBy: rows[0].AddedBy,
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
		ctx := accounts.WithID(context.Background(), who.subject)
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

func TestTheDeclarationReadPermissionHoldsNoWriteAction(t *testing.T) {
	read, ok := agencymodels.LookupPermission("declaration.read")
	if !ok {
		t.Fatal("the catalogue has no declaration.read permission")
	}
	if read.Locked || len(read.Actions) != 1 || read.Actions[0] != "instance.declaration.list" {
		t.Fatalf("declaration.read = %+v, want one unlocked action instance.declaration.list", read)
	}
	for _, action := range read.Actions {
		if !strings.HasSuffix(action, ".list") && !strings.HasSuffix(action, ".read") {
			t.Errorf("declaration.read holds the non-read action %s", action)
		}
	}
}
