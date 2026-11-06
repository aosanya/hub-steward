package http

import (
	"context"
	"errors"
	"net/http"
	"sort"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	mwanachamaagency "wakalaserver/modules/agency"
	agencymodels "wakalaserver/modules/agency/models"
)

type openStep struct {
	ID           string                      `json:"id"`
	Title        string                      `json:"title"`
	Kind         string                      `json:"kind"`
	WorkflowID   string                      `json:"workflow_id"`
	WorkflowName string                      `json:"workflow_name"`
	OpensIn      string                      `json:"opens_in"`
	RoleID       string                      `json:"role_id"`
	RoleName     string                      `json:"role_name"`
	FormName     string                      `json:"form_name"`
	Questions    []agencymodels.StepQuestion `json:"questions"`
	State        string                      `json:"state,omitempty"`
	OrderID      string                      `json:"order_id,omitempty"`
	RecordCode   string                      `json:"record_code,omitempty"`
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
		Description: "List the live workflow steps whose role the caller holds in this agency: step id, title, kind, workflow id, name and opens_in (chat or form), role, form name and the form's questions with their answer types. Members only. With available true it lists only the form steps the caller can act on now.",
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
	if available {
		return d.callerAvailableSteps(ctx, instanceID)
	}
	return d.callerOpenSteps(ctx, instanceID)
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
	steps, err := m.ListWorkItems(ctx, held.DraftID, mwanachamaagency.WorkItemFilter{})
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
	sort.SliceStable(steps, func(i, j int) bool {
		if steps[i].WorkflowID != steps[j].WorkflowID {
			return steps[i].WorkflowID < steps[j].WorkflowID
		}
		return steps[i].Ordinality < steps[j].Ordinality
	})
	items := []openStep{}
	for _, s := range steps {
		role, ok := roleByID[s.RoleID]
		if s.Deleted || !ok {
			continue
		}
		questions := s.Questions
		if questions == nil {
			questions = []agencymodels.StepQuestion{}
		}
		workflow := workflows[s.WorkflowID]
		items = append(items, openStep{
			ID: s.ID, Title: s.Title, Kind: string(s.Kind), WorkflowID: s.WorkflowID, WorkflowName: workflow.Name, OpensIn: opensInOf(workflow),
			RoleID: role.ID, RoleName: role.Name, FormName: s.FormName, Questions: questions,
		})
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
