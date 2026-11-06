package reviewruns

import (
	"context"
	"encoding/json"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/modelcontextprotocol/go-sdk/mcp"
	"gorm.io/gorm"

	mwanachamaagency "wakalaserver/modules/agency"
	agencymcp "wakalaserver/modules/agency/mcp"
	agencymodels "wakalaserver/modules/agency/models"
)

type carryDesk struct {
	t        *testing.T
	mgr      mwanachamaagency.AgencyManager
	caller   *MCPCaller
	draftID  string
	farmer   agencymodels.Role
	adviser  agencymodels.Role
	order    agencymodels.Workflow
	chatOnly agencymodels.Workflow
	chatHold agencymodels.Workflow
	chatStep agencymodels.WorkItem
}

func newCarryDesk(t *testing.T) *carryDesk {
	t.Helper()
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	t.Cleanup(cancel)
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("gorm.Open: %v", err)
	}
	s, err := mwanachamaagency.SpecFor("carrytest")
	if err != nil {
		t.Fatalf("SpecFor: %v", err)
	}
	if err := mwanachamaagency.Provision(db, s); err != nil {
		t.Fatalf("Provision: %v", err)
	}
	mgr, err := mwanachamaagency.NewAgencyManager(db, s)
	if err != nil {
		t.Fatalf("NewAgencyManager: %v", err)
	}
	if _, err := mgr.CreateAgency(ctx, agencymodels.Agency{Name: "Farmers"}); err != nil {
		t.Fatalf("CreateAgency: %v", err)
	}
	draft, err := mgr.CreateDraft(ctx, "seed", "", "")
	if err != nil {
		t.Fatalf("CreateDraft: %v", err)
	}
	d := &carryDesk{t: t, mgr: mgr, draftID: draft.ID}
	d.caller = &MCPCaller{Register: func(server *mcp.Server) {
		agencymcp.RegisterTools(server, func(context.Context, string) (mwanachamaagency.AgencyManager, error) { return mgr, nil })
	}}
	d.farmer = d.role(ctx, "Farmer")
	d.adviser = d.role(ctx, "Adviser")
	d.order = d.workflow(ctx, agencymodels.Workflow{Name: "Group order", Description: "A member joins the group order.", Ordinality: 1})
	d.chatOnly = d.workflow(ctx, agencymodels.Workflow{Name: "Buy inputs", Description: "A member buys inputs in a chat.", Ordinality: 7, EventFlows: "input_bought", OpensIn: agencymodels.OpensInChat})
	d.chatHold = d.workflow(ctx, agencymodels.Workflow{Name: "Ask the adviser", Description: "A member asks the adviser.", Ordinality: 9, EventFlows: "advice_given", OpensIn: agencymodels.OpensInChat})
	step, err := mgr.CreateWorkItem(ctx, agencymodels.WorkItem{
		DraftID: d.draftID, WorkflowID: d.chatHold.ID, Title: "Chat with the adviser", Description: "The adviser answers.",
		Ordinality: 1, Prompt: "Help the member.", Kind: agencymodels.StepKindChat, RoleID: d.farmer.ID,
		AgentRoleID: d.adviser.ID, Topic: "Choosing seed", OpeningLine: "What are you planting?",
		Prompts: []string{"Which seed suits clay?", "When do I sow?"}, Tools: []string{"market_ask", "market_search"},
		StartWorkflowIDs: []string{d.order.ID},
	})
	if err != nil {
		t.Fatalf("CreateWorkItem: %v", err)
	}
	d.chatStep = step
	return d
}

func (d *carryDesk) role(ctx context.Context, name string) agencymodels.Role {
	d.t.Helper()
	role, err := d.mgr.CreateRole(ctx, agencymodels.Role{DraftID: d.draftID, Name: name})
	if err != nil {
		d.t.Fatalf("CreateRole %s: %v", name, err)
	}
	return role
}

func (d *carryDesk) workflow(ctx context.Context, w agencymodels.Workflow) agencymodels.Workflow {
	d.t.Helper()
	w.DraftID = d.draftID
	made, err := d.mgr.CreateWorkflow(ctx, w)
	if err != nil {
		d.t.Fatalf("CreateWorkflow %s: %v", w.Name, err)
	}
	return made
}

func (d *carryDesk) tool(tool string, args map[string]any) (map[string]any, error) {
	d.t.Helper()
	with := map[string]any{"instance_id": "carrytest"}
	for key, value := range args {
		with[key] = value
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	body, err := d.caller.Call(ctx, tool, with)
	if err != nil {
		return nil, err
	}
	var out map[string]any
	if err := json.Unmarshal(body, &out); err != nil {
		d.t.Fatalf("%s sent back %s: %v", tool, body, err)
	}
	return out, nil
}

func (d *carryDesk) read(tool, idKey, id string) map[string]any {
	d.t.Helper()
	out, err := d.tool(tool, map[string]any{idKey: id})
	if err != nil {
		d.t.Fatalf("%s: %v", tool, err)
	}
	return out
}

func (d *carryDesk) workflowRead(id string) map[string]any {
	d.t.Helper()
	return d.read("agency_get_workflow", "workflow_id", id)
}

func (d *carryDesk) stepRead(id string) map[string]any {
	d.t.Helper()
	return d.read("agency_get_work_item", "work_item_id", id)
}

func (d *carryDesk) reviewed(tool string, arguments map[string]any) Finding {
	d.t.Helper()
	answer, err := json.Marshal(map[string]any{
		"summary":  "Three workflows were read. One finding.",
		"findings": []any{map[string]any{"title": "Fix it", "detail": "Fix it.", "tool": tool, "arguments": arguments, "fate": "new"}},
	})
	if err != nil {
		d.t.Fatal(err)
	}
	reviewer := NewWorkflowsReviewer(&fakeModel{answer: Completion{Text: string(answer)}}, NewWorkflowsReader(d.mgr))
	got, err := reviewer.Review(context.Background(), AreaInput{ReviewID: "rv-1", Area: AreaWorkflows, DraftID: d.draftID})
	if err != nil || len(got.Findings) != 1 {
		d.t.Fatalf("%+v %v", got, err)
	}
	return got.Findings[0]
}

func (d *carryDesk) applied(f Finding) error {
	d.t.Helper()
	_, err := d.tool(f.Tool, f.Arguments)
	return err
}

func (d *carryDesk) renameArguments(w agencymodels.Workflow, renamed string) map[string]any {
	return map[string]any{
		"workflow_id": w.ID, "code": w.Code, "name": renamed, "description": w.Description,
		"ordinality": w.Ordinality, "event_flows": w.EventFlows,
	}
}

func (d *carryDesk) renamed(w agencymodels.Workflow, renamed string) (before, after map[string]any) {
	d.t.Helper()
	before = d.workflowRead(w.ID)
	f := d.reviewed("agency_update_workflow", map[string]any{"workflow_id": w.ID, "name": renamed})
	if err := d.applied(f); err != nil {
		d.t.Fatalf("the rename the reviewer offered was refused: %v\narguments: %v", err, f.Arguments)
	}
	return before, d.workflowRead(w.ID)
}

func (d *carryDesk) stepArguments(s agencymodels.WorkItem, title string) map[string]any {
	return map[string]any{
		"work_item_id": s.ID, "workflow_id": s.WorkflowID, "title": title, "description": s.Description,
		"ordinality": s.Ordinality, "prompt": s.Prompt, "kind": string(s.Kind), "role_id": s.RoleID,
		"run_workflow_id": "", "form_name": "", "recipient_role_id": "", "sent_step_id": "",
		"otherwise_step_id": "", "time_limit_minutes": 0, "cancel_workflow_id": "",
	}
}

func (d *carryDesk) stepRetitled(title string) (before, after map[string]any) {
	d.t.Helper()
	before = d.stepRead(d.chatStep.ID)
	f := d.reviewed("agency_update_work_item", d.stepArguments(d.chatStep, title))
	if err := d.applied(f); err != nil {
		d.t.Fatalf("the step update the reviewer offered was refused: %v\narguments: %v", err, f.Arguments)
	}
	return before, d.stepRead(d.chatStep.ID)
}

func requireKept(t *testing.T, field string, before, after map[string]any) {
	t.Helper()
	if isBlank(before[field]) {
		t.Fatalf("the fixture holds no %s to keep: %v", field, before)
	}
	if !reflect.DeepEqual(before[field], after[field]) {
		t.Errorf("%s was %v and is now %v", field, before[field], after[field])
	}
}

func isBlank(value any) bool {
	switch v := value.(type) {
	case nil:
		return true
	case string:
		return v == ""
	case float64:
		return v == 0
	case []any:
		return len(v) == 0
	}
	return false
}

var keysTheAgencyOwns = []string{"id", "code", "created_at", "last_updated", "deleted"}

var derivedKeysTheStoreDoesNotHold = []string{"default", "in_use", "version", "orders_under_way", "order_versions", "action"}

type toolInput struct {
	properties map[string]bool
	required   []string
}

func (d *carryDesk) inputOf(tool string) toolInput {
	d.t.Helper()
	session, err := d.caller.connected()
	if err != nil {
		d.t.Fatal(err)
	}
	listed, err := session.ListTools(context.Background(), &mcp.ListToolsParams{})
	if err != nil {
		d.t.Fatal(err)
	}
	for _, candidate := range listed.Tools {
		if candidate.Name != tool {
			continue
		}
		text, err := json.Marshal(candidate.InputSchema)
		if err != nil {
			d.t.Fatal(err)
		}
		var schema struct {
			Properties map[string]json.RawMessage `json:"properties"`
			Required   []string                   `json:"required"`
		}
		if err := json.Unmarshal(text, &schema); err != nil {
			d.t.Fatal(err)
		}
		input := toolInput{properties: map[string]bool{}, required: schema.Required}
		for key := range schema.Properties {
			input.properties[key] = true
		}
		return input
	}
	d.t.Fatalf("the agency registers no tool %s", tool)
	return toolInput{}
}

func (d *carryDesk) requireAccepted(tool string, f Finding) {
	d.t.Helper()
	input := d.inputOf(tool)
	for key := range f.Arguments {
		if !input.properties[key] {
			d.t.Errorf("%s does not accept %q: %v", tool, key, f.Arguments)
		}
	}
	for _, key := range input.required {
		if _, sent := f.Arguments[key]; !sent && key != "instance_id" {
			d.t.Errorf("%s requires %q: %v", tool, key, f.Arguments)
		}
	}
}

func TestReviewerRenameKeepsTheOpensInOfAChatWorkflow(t *testing.T) {
	d := newCarryDesk(t)
	before, after := d.renamed(d.chatOnly, "Buy the inputs")
	if after["name"] != "Buy the inputs" {
		t.Fatalf("the name is %v", after["name"])
	}
	requireKept(t, "opens_in", before, after)
}

func TestReviewerRenameKeepsTheOrdinalityOfAWorkflow(t *testing.T) {
	d := newCarryDesk(t)
	before, after := d.renamed(d.chatOnly, "Buy the inputs")
	requireKept(t, "ordinality", before, after)
}

func TestReviewerRenameKeepsTheEventFlowsOfAWorkflow(t *testing.T) {
	d := newCarryDesk(t)
	before, after := d.renamed(d.chatOnly, "Buy the inputs")
	requireKept(t, "event_flows", before, after)
}

func TestReviewerRenameKeepsTheDescriptionOfAWorkflow(t *testing.T) {
	d := newCarryDesk(t)
	before, after := d.renamed(d.chatOnly, "Buy the inputs")
	requireKept(t, "description", before, after)
}

func TestReviewerRenameOfAWorkflowThatHoldsAChatStepIsNotRefused(t *testing.T) {
	d := newCarryDesk(t)
	before, after := d.renamed(d.chatHold, "Ask the adviser a question")
	if after["name"] != "Ask the adviser a question" {
		t.Fatalf("the name is %v", after["name"])
	}
	requireKept(t, "opens_in", before, after)
}

func TestReviewerRenameThatRepeatsTheFieldsTheOldPromptListedIsNotRefused(t *testing.T) {
	d := newCarryDesk(t)
	before := d.workflowRead(d.chatOnly.ID)
	f := d.reviewed("agency_update_workflow", d.renameArguments(d.chatOnly, "Buy the inputs"))
	if err := d.applied(f); err != nil {
		t.Fatalf("refused: %v\narguments: %v", err, f.Arguments)
	}
	after := d.workflowRead(d.chatOnly.ID)
	if after["name"] != "Buy the inputs" {
		t.Fatalf("the name is %v", after["name"])
	}
	for _, field := range []string{"opens_in", "ordinality", "event_flows", "description"} {
		requireKept(t, field, before, after)
	}
}

func TestReviewerRenameSendsNoCodeAndNoKeyTheAgencyOwns(t *testing.T) {
	d := newCarryDesk(t)
	f := d.reviewed("agency_update_workflow", d.renameArguments(d.chatOnly, "Buy the inputs"))
	for _, owned := range keysTheAgencyOwns {
		if _, sent := f.Arguments[owned]; sent {
			t.Errorf("the rename sends %q, which the agency owns: %v", owned, f.Arguments)
		}
	}
	if f.Arguments["workflow_id"] != d.chatOnly.ID || f.Arguments["name"] != "Buy the inputs" || f.Arguments["draft_id"] != d.draftID {
		t.Errorf("the rename does not name its workflow, draft and new name: %v", f.Arguments)
	}
}

func TestReviewerOffersNoFixForAWorkflowThatIsNotInTheDraft(t *testing.T) {
	d := newCarryDesk(t)
	f := d.reviewed("agency_update_workflow", map[string]any{"workflow_id": "wf-gone", "code": "W-9", "name": "Buy the inputs"})
	if f.Tool != "" || len(f.Arguments) != 0 || f.Then != "" {
		t.Errorf("a fix is offered for a workflow the draft does not hold: %s %v %s", f.Tool, f.Arguments, f.Then)
	}
	if !strings.Contains(f.Detail, "not a workflow of this draft") {
		t.Errorf("the detail does not say why: %q", f.Detail)
	}
}

func TestReviewerOffersNoFixForAStepThatIsNotInTheDraft(t *testing.T) {
	d := newCarryDesk(t)
	f := d.reviewed("agency_update_work_item", map[string]any{"work_item_id": "wi-gone", "title": "Chat now"})
	if f.Tool != "" || len(f.Arguments) != 0 {
		t.Errorf("a fix is offered for a step the draft does not hold: %s %v", f.Tool, f.Arguments)
	}
	if !strings.Contains(f.Detail, "not a step of this draft") {
		t.Errorf("the detail does not say why: %q", f.Detail)
	}
}

func TestReviewerLeavesAFindingWithoutAnUpdateToolAsItIs(t *testing.T) {
	d := newCarryDesk(t)
	args := map[string]any{"draft_id": d.draftID, "workflow_id": d.order.ID, "objective_id": "o-1"}
	f := d.reviewed("agency_link_workflow_objective", args)
	if !reflect.DeepEqual(f.Arguments, args) {
		t.Errorf("%v", f.Arguments)
	}
}

func TestReviewerStepUpdateKeepsTheAgentOfAChatStep(t *testing.T) {
	d := newCarryDesk(t)
	before, after := d.stepRetitled("Chat with the adviser now")
	if after["title"] != "Chat with the adviser now" {
		t.Fatalf("the title is %v", after["title"])
	}
	requireKept(t, "agent_role_id", before, after)
}

func TestReviewerStepUpdateKeepsTheTopicOfAChatStep(t *testing.T) {
	d := newCarryDesk(t)
	before, after := d.stepRetitled("Chat with the adviser now")
	requireKept(t, "topic", before, after)
}

func TestReviewerStepUpdateKeepsTheOpeningLineOfAChatStep(t *testing.T) {
	d := newCarryDesk(t)
	before, after := d.stepRetitled("Chat with the adviser now")
	requireKept(t, "opening_line", before, after)
}

func TestReviewerStepUpdateKeepsThePromptsOfAChatStep(t *testing.T) {
	d := newCarryDesk(t)
	before, after := d.stepRetitled("Chat with the adviser now")
	requireKept(t, "prompts", before, after)
}

func TestReviewerStepUpdateKeepsTheToolsOfAChatStep(t *testing.T) {
	d := newCarryDesk(t)
	before, after := d.stepRetitled("Chat with the adviser now")
	requireKept(t, "tools", before, after)
}

func TestReviewerStepUpdateKeepsTheWorkflowsAChatStepStarts(t *testing.T) {
	d := newCarryDesk(t)
	before, after := d.stepRetitled("Chat with the adviser now")
	requireKept(t, "start_workflow_ids", before, after)
}

func TestReviewerStepUpdateNamesTheDraftTheToolRequires(t *testing.T) {
	d := newCarryDesk(t)
	f := d.reviewed("agency_update_work_item", d.stepArguments(d.chatStep, "Chat with the adviser now"))
	if f.Arguments["draft_id"] != d.draftID || f.Arguments["work_item_id"] != d.chatStep.ID || f.Arguments["workflow_id"] != d.chatHold.ID {
		t.Errorf("%v", f.Arguments)
	}
	for _, owned := range keysTheAgencyOwns {
		if _, sent := f.Arguments[owned]; sent {
			t.Errorf("the step update sends %q, which the agency owns", owned)
		}
	}
}

func (d *carryDesk) bareStep() agencymodels.WorkItem {
	d.t.Helper()
	bare, err := d.mgr.CreateWorkItem(context.Background(), agencymodels.WorkItem{DraftID: d.draftID, WorkflowID: d.order.ID, Title: "Read the rules", Ordinality: 1})
	if err != nil {
		d.t.Fatal(err)
	}
	return bare
}

func (d *carryDesk) storedLineOf(step agencymodels.WorkItem) string {
	d.t.Helper()
	text, err := NewWorkflowsReader(d.mgr).Read(context.Background(), d.draftID)
	if err != nil {
		d.t.Fatal(err)
	}
	for _, line := range strings.Split(text, "\n") {
		if strings.Contains(line, "step as stored") && strings.Contains(line, `"id":"`+step.ID+`"`) {
			return line
		}
	}
	d.t.Fatalf("the draft text holds no stored line for %s:\n%s", step.ID, text)
	return ""
}

func TestReviewerStepUpdateOfAStepWithNoKindSendsNoKind(t *testing.T) {
	d := newCarryDesk(t)
	bare := d.bareStep()
	f := d.reviewed("agency_update_work_item", map[string]any{"work_item_id": bare.ID, "title": "Read the group rules"})
	if _, sent := f.Arguments["kind"]; sent {
		t.Errorf("%v", f.Arguments)
	}
	if err := d.applied(f); err != nil {
		t.Fatalf("refused: %v\narguments: %v", err, f.Arguments)
	}
	if got := d.stepRead(bare.ID)["title"]; got != "Read the group rules" {
		t.Errorf("the title is %v", got)
	}
}

func TestReviewerStepUpdateThatSendsAnEmptyKindForAStepWithNoKindIsNotRefused(t *testing.T) {
	d := newCarryDesk(t)
	bare := d.bareStep()
	f := d.reviewed("agency_update_work_item", map[string]any{"work_item_id": bare.ID, "title": "Read the group rules", "kind": "", "role_id": ""})
	if _, sent := f.Arguments["kind"]; sent {
		t.Errorf("the update still sends the empty kind: %v", f.Arguments)
	}
	if err := d.applied(f); err != nil {
		t.Fatalf("refused: %v\narguments: %v", err, f.Arguments)
	}
	if got := d.stepRead(bare.ID)["title"]; got != "Read the group rules" {
		t.Errorf("the title is %v", got)
	}
}

func TestWorkflowsReaderShowsNoEmptyKindOnAStoredStepWithNoKind(t *testing.T) {
	d := newCarryDesk(t)
	line := d.storedLineOf(d.bareStep())
	if strings.Contains(line, `"kind"`) {
		t.Errorf("the model is shown a kind for a step that has none: %s", line)
	}
}

func TestWorkflowsReaderShowsTheKindOfAStoredStepThatHasOne(t *testing.T) {
	d := newCarryDesk(t)
	line := d.storedLineOf(d.chatStep)
	if !strings.Contains(line, `"kind":"chat"`) {
		t.Errorf("%s", line)
	}
}

func TestReviewerStepUpdateThatSendsNullCarriesTheStoredValue(t *testing.T) {
	d := newCarryDesk(t)
	before := d.stepRead(d.chatStep.ID)
	f := d.reviewed("agency_update_work_item", map[string]any{"work_item_id": d.chatStep.ID, "title": "Chat with the adviser now", "topic": nil, "prompts": nil})
	if err := d.applied(f); err != nil {
		t.Fatalf("refused: %v\narguments: %v", err, f.Arguments)
	}
	after := d.stepRead(d.chatStep.ID)
	if after["title"] != "Chat with the adviser now" {
		t.Fatalf("the title is %v", after["title"])
	}
	for _, field := range []string{"topic", "prompts"} {
		requireKept(t, field, before, after)
	}
}

func TestReviewerWorkflowUpdateThatSendsNullCarriesTheStoredValue(t *testing.T) {
	d := newCarryDesk(t)
	before := d.workflowRead(d.chatOnly.ID)
	f := d.reviewed("agency_update_workflow", map[string]any{"workflow_id": d.chatOnly.ID, "name": "Buy the inputs", "description": nil, "event_flows": nil})
	if err := d.applied(f); err != nil {
		t.Fatalf("refused: %v\narguments: %v", err, f.Arguments)
	}
	after := d.workflowRead(d.chatOnly.ID)
	if after["name"] != "Buy the inputs" {
		t.Fatalf("the name is %v", after["name"])
	}
	for _, field := range []string{"description", "event_flows", "opens_in"} {
		requireKept(t, field, before, after)
	}
}

type editingModel struct {
	fakeModel
	whileThinking func()
}

func (m *editingModel) Complete(ctx context.Context, system, user string) (Completion, error) {
	m.whileThinking()
	return m.fakeModel.Complete(ctx, system, user)
}

func TestReviewerRenameCarriesWhatADesignerWroteWhileTheModelWasThinking(t *testing.T) {
	d := newCarryDesk(t)
	answer, err := json.Marshal(map[string]any{
		"summary": "Three workflows were read. One finding.",
		"findings": []any{map[string]any{
			"title": "Fix it", "detail": "Fix it.", "tool": "agency_update_workflow", "fate": "new",
			"arguments": map[string]any{"workflow_id": d.chatOnly.ID, "name": "Buy the inputs"},
		}},
	})
	if err != nil {
		t.Fatal(err)
	}
	model := &editingModel{fakeModel: fakeModel{answer: Completion{Text: string(answer)}}}
	model.whileThinking = func() {
		edited := d.chatOnly
		edited.Description = "A member buys inputs in a chat, written by the designer meanwhile."
		if _, err := d.mgr.UpdateWorkflow(context.Background(), edited); err != nil {
			t.Fatalf("UpdateWorkflow: %v", err)
		}
	}
	got, err := NewWorkflowsReviewer(model, NewWorkflowsReader(d.mgr)).Review(context.Background(), AreaInput{ReviewID: "rv-1", Area: AreaWorkflows, DraftID: d.draftID})
	if err != nil || len(got.Findings) != 1 {
		t.Fatalf("%+v %v", got, err)
	}
	if err := d.applied(got.Findings[0]); err != nil {
		t.Fatalf("refused: %v\narguments: %v", err, got.Findings[0].Arguments)
	}
	after := d.workflowRead(d.chatOnly.ID)
	if after["name"] != "Buy the inputs" {
		t.Fatalf("the name is %v", after["name"])
	}
	if after["description"] != "A member buys inputs in a chat, written by the designer meanwhile." {
		t.Errorf("the designer's edit was overwritten: %v", after["description"])
	}
}

func TestReviewerStepUpdateKeepsTheWorkflowAndDraftOfTheStoredStepWhateverTheModelSends(t *testing.T) {
	d := newCarryDesk(t)
	args := d.stepArguments(d.chatStep, "Chat with the adviser now")
	args["workflow_id"] = d.order.ID
	args["draft_id"] = "draft-elsewhere"
	f := d.reviewed("agency_update_work_item", args)
	if f.Arguments["workflow_id"] != d.chatHold.ID || f.Arguments["draft_id"] != d.draftID {
		t.Fatalf("the update names workflow %v and draft %v: %v", f.Arguments["workflow_id"], f.Arguments["draft_id"], f.Arguments)
	}
	if err := d.applied(f); err != nil {
		t.Fatalf("refused: %v\narguments: %v", err, f.Arguments)
	}
	if got := d.stepRead(d.chatStep.ID)["workflow_id"]; got != d.chatHold.ID {
		t.Errorf("the step moved to workflow %v", got)
	}
}

func TestReviewerWorkflowUpdateKeepsTheDraftOfTheStoredWorkflowWhateverTheModelSends(t *testing.T) {
	d := newCarryDesk(t)
	f := d.reviewed("agency_update_workflow", map[string]any{"workflow_id": d.chatOnly.ID, "draft_id": "draft-elsewhere", "name": "Buy the inputs"})
	if f.Arguments["draft_id"] != d.draftID {
		t.Errorf("the update names draft %v", f.Arguments["draft_id"])
	}
}

func TestWorkflowsPromptDoesNotOfferTheWorkflowOfAStepToTheUpdateTool(t *testing.T) {
	var offered []string
	for _, line := range strings.Split(workflowsSystemPrompt, "\n") {
		if strings.HasPrefix(line, "- agency_update_work_item") {
			offered = append(offered, line)
		}
	}
	if len(offered) != 1 {
		t.Fatalf("the prompt holds %d lines for the step update tool", len(offered))
	}
	if strings.Contains(offered[0], `"workflow_id"`) || strings.Contains(offered[0], "work_item_id, workflow_id") {
		t.Errorf("the prompt lists workflow_id as an argument to change: %s", offered[0])
	}
}

func TestReviewerWorkflowUpdateSendsOnlyKeysTheUpdateToolAccepts(t *testing.T) {
	d := newCarryDesk(t)
	f := d.reviewed("agency_update_workflow", map[string]any{"workflow_id": d.chatOnly.ID, "name": "Buy the inputs"})
	d.requireAccepted("agency_update_workflow", f)
}

func TestReviewerStepUpdateSendsOnlyKeysTheUpdateToolAccepts(t *testing.T) {
	d := newCarryDesk(t)
	f := d.reviewed("agency_update_work_item", map[string]any{"work_item_id": d.chatStep.ID, "title": "Chat with the adviser now"})
	d.requireAccepted("agency_update_work_item", f)
}

func TestReviewerUpdatesCarryNoDerivedKeyTheStoreDoesNotHold(t *testing.T) {
	d := newCarryDesk(t)
	updates := map[string]Finding{
		"agency_update_workflow":  d.reviewed("agency_update_workflow", map[string]any{"workflow_id": d.chatOnly.ID, "name": "Buy the inputs"}),
		"agency_update_work_item": d.reviewed("agency_update_work_item", map[string]any{"work_item_id": d.chatStep.ID, "title": "Chat with the adviser now"}),
	}
	for tool, f := range updates {
		for _, derived := range derivedKeysTheStoreDoesNotHold {
			if _, sent := f.Arguments[derived]; sent {
				t.Errorf("%s carries %q, which no stored row holds: %v", tool, derived, f.Arguments)
			}
		}
	}
}

func TestReviewerUpdatesDropEveryKeyTheAgencyOwnsThatTheModelSends(t *testing.T) {
	d := newCarryDesk(t)
	workflow := map[string]any{"workflow_id": d.chatOnly.ID, "name": "Buy the inputs"}
	step := map[string]any{"work_item_id": d.chatStep.ID, "title": "Chat with the adviser now"}
	for _, owned := range keysTheAgencyOwns {
		workflow[owned] = "x"
		step[owned] = "x"
	}
	workflow["deleted"], step["deleted"] = false, false
	for tool, sent := range map[string]map[string]any{"agency_update_workflow": workflow, "agency_update_work_item": step} {
		f := d.reviewed(tool, sent)
		for _, owned := range keysTheAgencyOwns {
			if _, kept := f.Arguments[owned]; kept {
				t.Errorf("%s still sends %q: %v", tool, owned, f.Arguments)
			}
		}
		if err := d.applied(f); err != nil {
			t.Errorf("%s refused: %v\narguments: %v", tool, err, f.Arguments)
		}
	}
}

func TestReviewerOwnedKeysAreTheBlueprintFieldsTheUpdateToolsLeaveOut(t *testing.T) {
	d := newCarryDesk(t)
	blueprint, err := mwanachamaagency.Blueprint()
	if err != nil {
		t.Fatal(err)
	}
	for role, tool := range map[string]string{workflowRole: "agency_update_workflow", workItemRole: "agency_update_work_item"} {
		keys, err := objectKeysOf(blueprint, role)
		if err != nil {
			t.Fatal(err)
		}
		object, _ := blueprint.Object(role)
		accepted := d.inputOf(tool).properties
		for _, field := range object.Fields {
			if left := !accepted[field.Name]; left != keys.readOnly[field.Name] {
				t.Errorf("%s: the tool leaves out %q = %v but the reviewer treats it as read-only = %v", role, field.Name, left, keys.readOnly[field.Name])
			}
		}
	}
}

func TestWorkflowsPromptNeverOffersACodeToTheUpdateTool(t *testing.T) {
	for _, line := range strings.Split(workflowsSystemPrompt, "\n") {
		if strings.Contains(line, "agency_update_workflow") && strings.Contains(line, "Arguments: workflow_id, code") {
			t.Errorf("the prompt offers a code to the update tool: %s", line)
		}
	}
}

func (d *carryDesk) cancelWorkflow() agencymodels.Workflow {
	d.t.Helper()
	return d.workflow(context.Background(), agencymodels.Workflow{
		Name: "Cancel an order", Description: "A member cancels an order.", Ordinality: 11, EventFlows: "order_cancelled", CancelsOrder: true,
	})
}

func TestReviewerRenameKeepsTheCancelsOrderOfACancelWorkflow(t *testing.T) {
	d := newCarryDesk(t)
	before, after := d.renamed(d.cancelWorkflow(), "Call off an order")
	if after["name"] != "Call off an order" {
		t.Fatalf("the name is %v", after["name"])
	}
	requireKept(t, "cancels_order", before, after)
}

func TestReviewerRenameThatRepeatsTheFieldsKeepsTheCancelsOrderOfACancelWorkflow(t *testing.T) {
	d := newCarryDesk(t)
	cancel := d.cancelWorkflow()
	before := d.workflowRead(cancel.ID)
	f := d.reviewed("agency_update_workflow", d.renameArguments(cancel, "Call off an order"))
	if err := d.applied(f); err != nil {
		t.Fatalf("refused: %v\narguments: %v", err, f.Arguments)
	}
	requireKept(t, "cancels_order", before, d.workflowRead(cancel.ID))
}
