package http

import (
	"context"
	"errors"
	"net/http"
	"sort"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
)

type openStep struct {
	ID            string                      `json:"id"`
	Title         string                      `json:"title"`
	Description   string                      `json:"description"`
	Prompt        string                      `json:"prompt,omitempty"`
	Kind          string                      `json:"kind"`
	WorkflowID    string                      `json:"workflow_id"`
	WorkflowName  string                      `json:"workflow_name"`
	OpensIn       string                      `json:"opens_in"`
	RoleID        string                      `json:"role_id"`
	RoleName      string                      `json:"role_name"`
	FormName      string                      `json:"form_name"`
	Questions     []agencymodels.StepQuestion `json:"questions"`
	State         string                      `json:"state,omitempty"`
	OrderID       string                      `json:"order_id,omitempty"`
	RecordCode    string                      `json:"record_code,omitempty"`
	RowID         string                      `json:"row_id,omitempty"`
	SubjectRecord string                      `json:"subject_record,omitempty"`
	RowAction     string                      `json:"row_action,omitempty"`
	Generated     bool                        `json:"generated,omitempty"`
	ReplacedBy    string                      `json:"replaced_by,omitempty"`
	Earlier       []earlierStep               `json:"earlier,omitempty"`
	Approval      bool                        `json:"approval,omitempty"`
	ApprovalLimit *stepApprovalLimit          `json:"approval_limit,omitempty"`
	SendBack      *sendBackPrompts            `json:"send_back,omitempty"`
	SentBack      *sentBackNote               `json:"sent_back,omitempty"`
}

type openSteps struct {
	Items []openStep `json:"items"`
}

type mcpOpenStepsParams struct {
	InstanceID string `json:"instance_id" jsonschema:"the Agency Instance"`
	Available  bool   `json:"available,omitempty" jsonschema:"true lists only the form steps the caller can act on now: a workflow's first step, and a later step whose run is waiting for the caller's role, each with its state and order_id"`
}

const callerOpenStepsAction = "instance.my_open_steps.read"

func (d *Deps) registerCallerOpenStepsRoute(mux *http.ServeMux, auth callers) {
	mux.HandleFunc("GET /instances/{instanceID}/my-open-steps", auth.require(func(w http.ResponseWriter, r *http.Request) {
		out, err := d.openStepsFor(r.Context(), r.PathValue("instanceID"), r.URL.Query().Get("available") == "true")
		if err != nil {
			writeRecordErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, out.Items)
	}))
}

func (d *Deps) registerCallerOpenStepsMCPTool(server *mcp.Server) {
	mcp.AddTool(server, &mcp.Tool{
		Name:        "agency_list_my_open_steps",
		Title:       "List My Open Steps",
		Description: "List the live workflow steps whose role the caller holds in this agency: step id, title, the work item's prompt, kind, workflow id, name and opens_in (chat or form), role, form name and the form's questions with their answer types. Members only. A step the member approves in their own name carries approval true; sending it stores who approved and when. A step of a generated workflow (the Add, Edit and Delete every record has, RC-1.add and so on) carries generated true, its row_action, and replaced_by, the code of the designed workflow that stands in for it; list those after the designed ones and leave out a replaced one. A step that can be sent back carries send_back, the prompts of its decision and reason questions, and agency_send_back_step sends it back; a step a run reopened carries sent_back, the sender's reason, the sender's role, the time and the answers already given. With available true it lists only the form steps the caller can act on now.",
	}, d.mcpListMyOpenSteps)
}

func (d *Deps) mcpListMyOpenSteps(ctx context.Context, _ *mcp.CallToolRequest, p mcpOpenStepsParams) (*mcp.CallToolResult, openSteps, error) {
	out, err := d.openStepsFor(ctx, p.InstanceID, p.Available)
	if err != nil {
		return nil, openSteps{}, err
	}
	return textResult("Found %d open step(s)", len(out.Items)), out, nil
}

func (d *Deps) openStepsFor(ctx context.Context, instanceID string, available bool) (openSteps, error) {
	read := d.callerOpenSteps
	if available {
		read = d.callerAvailableSteps
	}
	listed, err := read(ctx, instanceID)
	if err != nil {
		return openSteps{}, err
	}
	return d.withSubjects(ctx, instanceID, listed)
}

func (d *Deps) callerOpenSteps(ctx context.Context, instanceID string) (openSteps, error) {
	if err := d.requireAgentMay(ctx, instanceID, callerOpenStepsAction); err != nil {
		return openSteps{}, err
	}
	reg := d.Registry
	m, err := agencyOfAnyone(ctx, reg, instanceID)
	if err != nil {
		return openSteps{}, err
	}
	held, err := heldAgencyRoles(ctx, reg, instanceID, m)
	if err != nil {
		if errors.Is(err, errNoLiveVersion) {
			return openSteps{Items: []openStep{}}, nil
		}
		return openSteps{}, err
	}
	if len(held.Roles) == 0 {
		return openSteps{Items: []openStep{}}, nil
	}
	roleIDs := make([]string, 0, len(held.Roles))
	for _, r := range held.Roles {
		roleIDs = append(roleIDs, r.ID)
	}
	steps, err := m.ListWorkItems(ctx, held.DraftID, mwanachamaagency.WorkItemFilter{RoleIDs: roleIDs})
	if err != nil {
		return openSteps{}, err
	}
	workflows, err := liveWorkflows(ctx, m, held.DraftID)
	if err != nil {
		return openSteps{}, err
	}
	roleByID := make(map[string]agencymodels.Role, len(held.Roles))
	for _, r := range held.Roles {
		roleByID[r.ID] = r
	}
	generated, rowStepRole, err := d.rowStepsOpenToCaller(ctx, instanceID, m, held)
	if err != nil {
		return openSteps{}, err
	}
	steps = append(steps, generated...)
	sort.SliceStable(steps, func(i, j int) bool {
		if steps[i].WorkflowID != steps[j].WorkflowID {
			return steps[i].WorkflowID < steps[j].WorkflowID
		}
		return steps[i].Ordinality < steps[j].Ordinality
	})
	items := []openStep{}
	for _, s := range steps {
		role, ok := roleByID[stepActorRoleID(s)]
		if s.RowRecord != "" && s.RoleID == "" {
			role, ok = rowStepRole[s.ID], true
		}
		if s.Deleted || !ok {
			continue
		}
		questions := s.Questions
		if questions == nil {
			questions = []agencymodels.StepQuestion{}
		}
		workflow := workflows[s.WorkflowID]
		items = append(items, openStep{
			ID: s.ID, Title: s.Title, Description: s.Description, Prompt: s.Prompt, Kind: string(s.Kind), WorkflowID: s.WorkflowID, WorkflowName: workflow.Name, OpensIn: opensInOf(workflow),
			RoleID: role.ID, RoleName: role.Name, FormName: s.FormName, Questions: questions, Approval: isApprovalStep(s),
			RowAction: s.RowAction, Generated: workflow.Generated, ReplacedBy: workflow.ReplacedBy, SendBack: sendBackPromptsOf(s),
		})
	}
	if err := d.showApprovalLimits(ctx, instanceID, items); err != nil {
		return openSteps{}, err
	}
	return openSteps{Items: items}, nil
}

func liveWorkflows(ctx context.Context, m mwanachamaagency.AgencyManager, draftID string) (map[string]agencymodels.Workflow, error) {
	listed, err := m.ListWorkflows(ctx, draftID, mwanachamaagency.WorkflowFilter{})
	if err != nil {
		return nil, err
	}
	live := make(map[string]agencymodels.Workflow, len(listed))
	for _, w := range listed {
		if !w.Deleted {
			live[w.ID] = w
		}
	}
	return live, nil
}

func opensInOf(w agencymodels.Workflow) string {
	if w.IsChat() {
		return string(agencymodels.OpensInChat)
	}
	return string(agencymodels.OpensInForm)
}
