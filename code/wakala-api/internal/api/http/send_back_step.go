package http

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"slices"
	"strings"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"

	"wakalaserver/internal/accounts"
)

const (
	sendBackStepTool   = "agency_send_back_step"
	sendBackStepAction = "instance.step.send_back"
	sendBackAuditText  = "sent a step back"

	sendBackMissingName = "set your name in your profile before sending a step back"
)

var (
	errStepNotYours       = errors.New("this step is not for your role")
	errNoStepToSendBackTo = errors.New("this run has no earlier step to send it back to")
)

type sendBackRequest struct {
	OrderID string `json:"order_id"`
	Reason  string `json:"reason"`
	SendKey string `json:"send_key,omitempty"`
}

type sendBackResult struct {
	StepID   string `json:"step_id"`
	OrderID  string `json:"order_id"`
	RoleName string `json:"role_name"`
}

type sendBackPrompts struct {
	Decision string `json:"decision"`
	Reason   string `json:"reason"`
}

type sentBackNote struct {
	Reason   string            `json:"reason"`
	RoleName string            `json:"role_name"`
	At       string            `json:"at"`
	Answers  map[string]string `json:"answers,omitempty"`
}

type mcpSendBackStepParams struct {
	InstanceID string `json:"instance_id" jsonschema:"the Agency Instance"`
	StepID     string `json:"step_id" jsonschema:"the step's id, as agency_list_my_open_steps names it; only a step that carries send_back can be sent back"`
	OrderID    string `json:"order_id" jsonschema:"the run the step belongs to, as agency_list_my_open_steps names it on a waiting step"`
	Reason     string `json:"reason" jsonschema:"why the work goes back, in the sender's own words; it is shown to the member who gets the earlier step again"`
	SendKey    string `json:"send_key,omitempty" jsonschema:"a key made once per opening of the form"`
}

func previousStepOf(chain []formStep, run stepRun, index int) int {
	for i := index - 1; i >= 0; i-- {
		if chain[i].step.Kind == agencymodels.StepKindFillForm && run.done[i] {
			return i
		}
	}
	return -1
}

func sentBackFrom(chain []formStep, run stepRun, index int) int {
	for i := index + 1; i < len(chain); i++ {
		if !run.done[i] && !run.skipped[i] {
			return i
		}
	}
	return -1
}

func canBeSentBack(step agencymodels.WorkItem) bool {
	return step.Kind == agencymodels.StepKindFillForm && step.SendBackDecision != "" && step.SendBackReason != ""
}

func sendBackPromptsOf(step agencymodels.WorkItem) *sendBackPrompts {
	if !canBeSentBack(step) {
		return nil
	}
	return &sendBackPrompts{Decision: step.SendBackDecision, Reason: step.SendBackReason}
}

func sentBackNoteOf(chain []formStep, run stepRun, index int, roles []agencymodels.Role) *sentBackNote {
	if index < 0 || index >= len(run.sentBack) || run.sentBack[index] == nil {
		return nil
	}
	row := run.sentBack[index]
	note := &sentBackNote{Reason: row.ReturnedReason, At: row.ReturnedOn, Answers: row.Answers}
	if sender := sentBackFrom(chain, run, index); sender >= 0 {
		note.RoleName = roleNameOf(roles, chain[sender].record.RoleID)
	}
	return note
}

func roleNameOf(roles []agencymodels.Role, roleID string) string {
	for _, r := range roles {
		if r.ID == roleID {
			return r.Name
		}
	}
	return ""
}

func (d *Deps) registerSendBackStepRoute(mux *http.ServeMux, auth callers) {
	mux.HandleFunc("POST /instances/{instanceID}/steps/{stepID}/send-back", auth.require(func(w http.ResponseWriter, r *http.Request) {
		var req sendBackRequest
		if err := readJSON(r, &req); err != nil {
			writeErr(w, http.StatusBadRequest, "invalid request body")
			return
		}
		out, err := d.sendBackStep(r.Context(), r.PathValue("instanceID"), r.PathValue("stepID"), req)
		if err != nil {
			writeStepErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, out)
	}))
}

func (d *Deps) registerSendBackStepMCPTool(server *mcp.Server) {
	mcp.AddTool(server, &mcp.Tool{
		Name:        sendBackStepTool,
		Title:       "Send a Step Back",
		Description: "Send a live workflow step back one step: the run reopens the previous step of the workflow for the role that holds it, with the sender's reason attached, and the sending step's own answers are not saved. Only a member who holds the step's role may send it back, and only a step that carries send_back in agency_list_my_open_steps, whose run is waiting for it. The previous step is the nearest earlier form step the run has sent; its answers stay with it and fill its form again, and when it is sent again the run reaches the sending step once more. Answers the step reopened, the role it went to and the run.",
	}, d.mcpSendBackStep)
}

func (d *Deps) mcpSendBackStep(ctx context.Context, _ *mcp.CallToolRequest, p mcpSendBackStepParams) (*mcp.CallToolResult, sendBackResult, error) {
	out, err := d.sendBackStep(ctx, p.InstanceID, p.StepID, sendBackRequest{OrderID: p.OrderID, Reason: p.Reason, SendKey: p.SendKey})
	if err != nil {
		return nil, sendBackResult{}, err
	}
	return textResult("Sent the run %s back to %s", out.OrderID, out.RoleName), out, nil
}

func (d *Deps) sendBackStep(ctx context.Context, instanceID, stepID string, req sendBackRequest) (sendBackResult, error) {
	if err := d.requireAgentMay(ctx, instanceID, sendBackStepAction); err != nil {
		return sendBackResult{}, err
	}
	m, err := agencyOfAnyone(ctx, d.Registry, instanceID)
	if err != nil {
		return sendBackResult{}, err
	}
	draftID, err := liveDraftOf(ctx, m)
	if err != nil {
		return sendBackResult{}, err
	}
	steps, err := m.ListWorkItems(ctx, draftID, mwanachamaagency.WorkItemFilter{})
	if err != nil {
		return sendBackResult{}, err
	}
	at := slices.IndexFunc(steps, func(s agencymodels.WorkItem) bool { return s.ID == stepID && !s.Deleted })
	if at < 0 || !canBeSentBack(steps[at]) {
		return sendBackResult{}, errStepNotFound
	}
	step := steps[at]
	held, err := heldAgencyRoles(ctx, d.Registry, instanceID, m)
	if err != nil {
		return sendBackResult{}, err
	}
	if !slices.ContainsFunc(held.Roles, func(r agencymodels.Role) bool { return r.ID == stepActorRoleID(step) }) {
		return sendBackResult{}, errStepNotYours
	}
	reason := strings.TrimSpace(req.Reason)
	if reason == "" {
		return sendBackResult{}, badRowError("a step sent back says why: reason is empty")
	}
	if req.OrderID == "" {
		return sendBackResult{}, badRowError("order_id names the run this step belongs to")
	}
	records, err := m.ListRecords(ctx, held.DraftID, mwanachamaagency.RecordFilter{})
	if err != nil {
		return sendBackResult{}, err
	}
	chain := formStepsByWorkflow(steps, records)[step.WorkflowID]
	index := slices.IndexFunc(chain, func(l formStep) bool { return l.step.ID == step.ID })
	if index < 0 {
		return sendBackResult{}, errStepNoRegister
	}
	name, err := d.callerName(ctx, instanceID)
	if err != nil {
		return sendBackResult{}, err
	}
	if name == "" {
		return sendBackResult{}, badRowError(sendBackMissingName)
	}
	release := d.stepSendLocks().acquire(instanceID + "\x00" + req.OrderID)
	defer release()
	target, err := d.returnedStepOf(ctx, m, chain, index, req.OrderID, name, reason)
	if err != nil {
		return sendBackResult{}, err
	}
	d.auditSendBack(ctx, instanceID, req.OrderID)
	roles, err := m.ListRoles(ctx, held.DraftID, mwanachamaagency.RoleFilter{})
	if err != nil {
		return sendBackResult{}, err
	}
	return sendBackResult{StepID: chain[target].step.ID, OrderID: req.OrderID, RoleName: roleNameOf(roles, chain[target].record.RoleID)}, nil
}

func (d *Deps) returnedStepOf(ctx context.Context, m mwanachamaagency.AgencyManager, chain []formStep, index int, orderID, returnedBy, reason string) (int, error) {
	runs, err := runsOf(ctx, m, chain)
	if err != nil {
		return -1, err
	}
	at := slices.IndexFunc(runs, func(r stepRun) bool { return r.orderID == orderID && r.next() == index })
	if at < 0 {
		return -1, errStepNotWaiting
	}
	target := previousStepOf(chain, runs[at], index)
	if target < 0 {
		return -1, errNoStepToSendBackTo
	}
	rows, err := currentRowsOfRun(ctx, m, chain[target].record.Code, orderID)
	if err != nil {
		return -1, err
	}
	for _, row := range rows {
		if _, err := m.ReturnRecordRow(ctx, row.ID, returnedBy, reason); err != nil {
			return -1, err
		}
	}
	return target, nil
}

func currentRowsOfRun(ctx context.Context, m mwanachamaagency.AgencyManager, recordCode, orderID string) ([]agencymodels.RecordRow, error) {
	drafts, err := draftsOfEveryPublication(ctx, m)
	if err != nil {
		return nil, err
	}
	current, err := currentRowsOfRecord(ctx, m, drafts, recordCode)
	if err != nil {
		return nil, err
	}
	return slices.DeleteFunc(current, func(row agencymodels.RecordRow) bool { return row.OrderID != orderID }), nil
}

func (d *Deps) auditSendBack(ctx context.Context, instanceID, orderID string) {
	if d.Audit == nil {
		return
	}
	if _, err := d.Audit.Record(ctx, instanceID, accounts.IDFromContext(ctx), sendBackAuditText, orderID); err != nil {
		slog.Warn("a step sent back left no audit entry", "instance", instanceID, "run", orderID, "err", err)
	}
}
