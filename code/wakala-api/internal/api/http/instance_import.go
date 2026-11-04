package http

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	mwanachamaagency "wakalaserver/modules/agency"
	"wakalaserver/modules/agency/models"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

// maxImportBytes caps the uploaded document. The mined templates run well
// under 100 KB; this is a ceiling on a route that accepts a whole file,
// not a size any real export is expected to approach.
const maxImportBytes = 4 << 20

type importAgency struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type importRole struct {
	ID          string   `json:"id"`
	Code        string   `json:"code"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Permissions []string `json:"permissions"`
}

type importGoal struct {
	ID          string `json:"id"`
	Code        string `json:"code"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Ordinality  int    `json:"ordinality"`
}

type importObjective struct {
	ID          string `json:"id"`
	Code        string `json:"code"`
	GoalID      string `json:"goal_id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Ordinality  int    `json:"ordinality"`
}

type importWorkflow struct {
	ID          string `json:"id"`
	Code        string `json:"code"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Ordinality  int    `json:"ordinality"`
	EventFlows  string `json:"event_flows"`
}

type importWorkItem struct {
	ID               string                `json:"id"`
	Code             string                `json:"code"`
	WorkflowID       string                `json:"workflow_id"`
	ObjectiveID      string                `json:"objective_id"`
	Title            string                `json:"title"`
	Description      string                `json:"description"`
	Ordinality       int                   `json:"ordinality"`
	Prompt           string                `json:"prompt"`
	Kind             models.StepKind       `json:"kind"`
	RoleID           string                `json:"role_id"`
	RunWorkflowID    string                `json:"run_workflow_id"`
	FormName         string                `json:"form_name"`
	Questions        []models.StepQuestion `json:"questions"`
	Tool             string                `json:"tool"`
	RecipientRoleID  string                `json:"recipient_role_id"`
	SentStepID       string                `json:"sent_step_id"`
	Routes           []models.StepRoute    `json:"routes"`
	OtherwiseStepID  string                `json:"otherwise_step_id"`
	TimeLimitMinutes int                   `json:"time_limit_minutes"`
	CancelWorkflowID string                `json:"cancel_workflow_id"`
}

type importRecord struct {
	ID         string                `json:"id"`
	Code       string                `json:"code"`
	WorkflowID string                `json:"workflow_id"`
	Name       string                `json:"name"`
	RoleID     string                `json:"role_id"`
	FormName   string                `json:"form_name"`
	Questions  []models.StepQuestion `json:"questions"`
}

type importWorkflowObjective struct {
	WorkflowID  string `json:"workflow_id"`
	ObjectiveID string `json:"objective_id"`
}

type importRoleAssignment struct {
	WorkItemID string `json:"work_item_id"`
	RoleID     string `json:"role_id"`
	Label      string `json:"label"`
}

type importStatement struct {
	ID   string `json:"id"`
	Code string `json:"code"`
	Text string `json:"text"`
}

type importControl struct {
	ID           string                 `json:"id"`
	Code         string                 `json:"code"`
	Text         string                 `json:"text"`
	Action       string                 `json:"action"`
	CondField    string                 `json:"cond_field"`
	CondOperator models.ControlOperator `json:"cond_operator"`
	CondValue    string                 `json:"cond_value"`
	OnBreach     models.ControlOnBreach `json:"on_breach"`
	WorkflowID   string                 `json:"workflow_id"`
	Severity     models.ControlSeverity `json:"severity"`
}

type importRisk struct {
	ID       string `json:"id"`
	Code     string `json:"code"`
	Title    string `json:"title"`
	TopEvent string `json:"top_event"`
	Hazard   string `json:"hazard"`
	Owner    string `json:"owner"`
}

type importRiskPathway struct {
	ID       string          `json:"id"`
	Code     string          `json:"code"`
	RiskID   string          `json:"risk_id"`
	Side     models.RiskSide `json:"side"`
	Title    string          `json:"title"`
	Scenario string          `json:"scenario"`
}

type importAttachment struct {
	ControlID   string `json:"control_id"`
	ControlCode string `json:"control_code"`
	ValueID     string `json:"value_id"`
	ValueCode   string `json:"value_code"`
	RuleID      string `json:"rule_id"`
	RuleCode    string `json:"rule_code"`
	TargetType  string `json:"target_type"`
	TargetID    string `json:"target_id"`
	TargetCode  string `json:"target_code"`
}

type importModule struct {
	ID      string `json:"id"`
	Code    string `json:"code"`
	Enabled bool   `json:"enabled"`
}

type importTemplate struct {
	Archetype string `json:"archetype"`
}

type importRequest struct {
	Name               string                    `json:"name"`
	Template           importTemplate            `json:"_template"`
	Agency             importAgency              `json:"agency"`
	Roles              []importRole              `json:"roles"`
	Goals              []importGoal              `json:"goals"`
	Objectives         []importObjective         `json:"objectives"`
	Workflows          []importWorkflow          `json:"workflows"`
	WorkflowObjectives []importWorkflowObjective `json:"workflow_objectives"`
	WorkItems          []importWorkItem          `json:"work_items"`
	RoleAssignments    []importRoleAssignment    `json:"role_assignments"`
	Controls           []importControl           `json:"controls"`
	ControlAttachments []importAttachment        `json:"control_attachments"`
	Values             []importStatement         `json:"values"`
	Rules              []importStatement         `json:"rules"`
	ValueAttachments   []importAttachment        `json:"value_attachments"`
	RuleAttachments    []importAttachment        `json:"rule_attachments"`
	Modules            []importModule            `json:"modules"`
	Records            []importRecord            `json:"records"`
	Risks              []importRisk              `json:"risks"`
	RiskPathways       []importRiskPathway       `json:"risk_pathways"`
}

// importResult reports the new Instance plus a per-section count of what
// landed and every entry that did not.
type importResult struct {
	Instance agencies.Instance `json:"instance"`
	DraftID  string            `json:"draft_id"`
	Created  map[string]int    `json:"created"`
	Errors   []string          `json:"errors,omitempty"`
}

// refMap resolves a document's reference — an id or a Code, whichever the
// section uses — to the id the import just minted for that entity.
type refMap map[string]string

func (m refMap) add(id, code, newID string) {
	if id != "" {
		m[id] = newID
	}
	if code != "" {
		m[code] = newID
	}
}

func (m refMap) resolve(ref string) (string, bool) {
	id, ok := m[ref]
	return id, ok
}

// importer accumulates one import's remapping tables and failures.
type importer struct {
	mgr mwanachamaagency.AgencyManager
	// draftID is the open Draft every imported row belongs to (WK25):
	// the library has no live scope, so every Create* needs one.
	draftID string
	result  importResult

	roles      refMap
	goals      refMap
	objectives refMap
	workflows  refMap
	workItems  refMap
	controls   refMap
	risks      refMap
}

func newImporter(mgr mwanachamaagency.AgencyManager, draftID string) *importer {
	return &importer{
		mgr:        mgr,
		draftID:    draftID,
		result:     importResult{Created: map[string]int{}},
		roles:      refMap{},
		goals:      refMap{},
		objectives: refMap{},
		workflows:  refMap{},
		workItems:  refMap{},
		controls:   refMap{},
		risks:      refMap{},
	}
}

func (im *importer) fail(format string, args ...any) {
	im.result.Errors = append(im.result.Errors, fmt.Sprintf(format, args...))
}

func (im *importer) counted(section string) {
	im.result.Created[section]++
}

// target resolves an attachment's target to a real id, by Code or id.
func (im *importer) target(targetType, ref string) (string, error) {
	var m refMap
	switch models.TargetType(targetType) {
	case models.TargetTypeRole:
		m = im.roles
	case models.TargetTypeGoal:
		m = im.goals
	case models.TargetTypeObjective:
		m = im.objectives
	case models.TargetTypeWorkflow:
		m = im.workflows
	case models.TargetTypeWorkItem:
		m = im.workItems
	default:
		return "", fmt.Errorf("unknown target_type %q", targetType)
	}
	id, ok := m.resolve(ref)
	if !ok {
		return "", fmt.Errorf("unknown %s %q", targetType, ref)
	}
	return id, nil
}

func (im *importer) apply(ctx context.Context, in importRequest) {
	for _, r := range in.Roles {
		created, err := im.mgr.CreateRole(ctx, models.Role{DraftID: im.draftID, Name: r.Name, Description: r.Description, Permissions: r.Permissions})
		if err != nil {
			im.fail("role %q: %v", r.Name, err)
			continue
		}
		im.roles.add(r.ID, r.Code, created.ID)
		im.counted("roles")
	}

	for _, g := range in.Goals {
		created, err := im.mgr.CreateGoal(ctx, models.Goal{DraftID: im.draftID,
			Title:       g.Title,
			Description: g.Description,
			Ordinality:  g.Ordinality,
		})
		if err != nil {
			im.fail("goal %q: %v", g.Title, err)
			continue
		}
		im.goals.add(g.ID, g.Code, created.ID)
		im.counted("goals")
	}

	for _, o := range in.Objectives {
		goalID, ok := im.goals.resolve(o.GoalID)
		if !ok {
			im.fail("objective %q: unknown goal %q", o.Title, o.GoalID)
			continue
		}
		created, err := im.mgr.CreateObjective(ctx, models.Objective{DraftID: im.draftID,
			GoalID:      goalID,
			Title:       o.Title,
			Description: o.Description,
			Ordinality:  o.Ordinality,
		})
		if err != nil {
			im.fail("objective %q: %v", o.Title, err)
			continue
		}
		im.objectives.add(o.ID, o.Code, created.ID)
		im.counted("objectives")
	}

	for _, w := range in.Workflows {
		created, err := im.mgr.CreateWorkflow(ctx, models.Workflow{DraftID: im.draftID,
			Name:        w.Name,
			Description: w.Description,
			Ordinality:  w.Ordinality,
			EventFlows:  w.EventFlows,
		})
		if err != nil {
			im.fail("workflow %q: %v", w.Name, err)
			continue
		}
		im.workflows.add(w.ID, w.Code, created.ID)
		im.counted("workflows")
	}

	im.applyWorkItems(ctx, in)
	im.applyRecords(ctx, in)

	im.applyWorkflowObjectives(ctx, in)

	for _, ra := range in.RoleAssignments {
		if ra.WorkItemID == "" {
			continue
		}
		roleID, ok := im.roles.resolve(ra.RoleID)
		if !ok {
			im.fail("role assignment: unknown role %q", ra.RoleID)
			continue
		}
		workItemID, ok := im.workItems.resolve(ra.WorkItemID)
		if !ok {
			im.fail("role assignment: unknown work item %q", ra.WorkItemID)
			continue
		}
		if _, err := im.mgr.CreateRoleAssignment(ctx, models.RoleAssignment{DraftID: im.draftID,
			RoleID:     roleID,
			WorkItemID: workItemID,
			Label:      models.RACILabel(ra.Label),
		}); err != nil {
			im.fail("role assignment %s on %s: %v", ra.Label, ra.WorkItemID, err)
			continue
		}
		im.counted("role_assignments")
	}

	for _, c := range in.controls() {
		workflowID := ""
		if c.WorkflowID != "" {
			resolved, ok := im.workflows.resolve(c.WorkflowID)
			if !ok {
				im.fail("control %q: unknown workflow %q", c.Code, c.WorkflowID)
				continue
			}
			workflowID = resolved
		}
		created, err := im.mgr.CreateControl(ctx, models.Control{
			DraftID: im.draftID, Text: c.Text, Action: c.Action,
			CondField: c.CondField, CondOperator: c.CondOperator, CondValue: c.CondValue,
			OnBreach: c.OnBreach, WorkflowID: workflowID, Severity: c.Severity,
		})
		if err != nil {
			im.fail("control %q: %v", c.Code, err)
			continue
		}
		im.controls.add(c.ID, c.Code, created.ID)
		im.counted("controls")
	}

	for _, r := range in.Risks {
		created, err := im.mgr.CreateRisk(ctx, models.Risk{DraftID: im.draftID, Title: r.Title, TopEvent: r.TopEvent, Hazard: r.Hazard, Owner: r.Owner})
		if err != nil {
			im.fail("risk %q: %v", r.Code, err)
			continue
		}
		im.risks.add(r.ID, r.Code, created.ID)
		im.counted("risks")
	}

	for _, p := range in.RiskPathways {
		riskID, ok := im.risks.resolve(p.RiskID)
		if !ok {
			im.fail("risk pathway %q: unknown risk %q", p.Code, p.RiskID)
			continue
		}
		if _, err := im.mgr.CreateRiskPathway(ctx, models.RiskPathway{DraftID: im.draftID, RiskID: riskID, Side: p.Side, Title: p.Title, Scenario: p.Scenario}); err != nil {
			im.fail("risk pathway %q: %v", p.Code, err)
			continue
		}
		im.counted("risk_pathways")
	}

	for _, a := range in.controlAttachments() {
		ref := firstNonEmpty(a.ControlCode, a.ControlID)
		controlID, ok := im.controls.resolve(ref)
		if !ok {
			im.fail("control attachment: unknown control %q", ref)
			continue
		}
		targetID, err := im.target(a.TargetType, firstNonEmpty(a.TargetCode, a.TargetID))
		if err != nil {
			im.fail("control attachment %q: %v", ref, err)
			continue
		}
		if _, err := im.mgr.CreateControlAttachment(ctx, controlID, models.TargetType(a.TargetType), targetID); err != nil {
			im.fail("control attachment %q: %v", ref, err)
			continue
		}
		im.counted("control_attachments")
	}

	im.applyModules(ctx, in)
}

func (im *importer) applyModules(ctx context.Context, in importRequest) {
	if len(in.Modules) == 0 {
		return
	}
	live, err := im.mgr.ListModules(ctx, im.draftID, mwanachamaagency.ModuleFilter{})
	if err != nil {
		im.fail("modules: %v", err)
		return
	}
	byCode := make(map[string]models.Module, len(live))
	for _, m := range live {
		byCode[m.Code] = m
	}
	for _, m := range in.Modules {
		held, ok := byCode[m.Code]
		if !m.Enabled || !ok || held.Locked {
			continue
		}
		if _, err := im.mgr.SetModuleEnabled(ctx, im.draftID, held.ID, true); err != nil {
			im.fail("module %q: %v", m.Code, err)
			continue
		}
		im.counted("modules")
	}
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return ""
}

func importInstance(reg agencies.Registry) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, maxImportBytes)
		var in importRequest
		if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
			writeReadErr(w, err)
			return
		}
		name := firstNonEmpty(strings.TrimSpace(in.Name), strings.TrimSpace(in.Agency.Name))
		if name == "" {
			writeErr(w, http.StatusBadRequest, "name must not be empty")
			return
		}
		caller := accounts.IDFromContext(r.Context())
		if isMachineCaller(caller) {
			writeErr(w, http.StatusForbidden, errMachineCannotCreate.Error())
			return
		}
		if caller == "" {
			writeErr(w, http.StatusUnauthorized, "authentication required")
			return
		}
		if err := checkImportSize(in); err != nil {
			writeErr(w, http.StatusRequestEntityTooLarge, err.Error())
			return
		}
		if err := in.checkReferences(); err != nil {
			writeErr(w, http.StatusBadRequest, err.Error())
			return
		}
		if err := checkInstanceRoom(r.Context(), reg, caller, name); err != nil {
			switch {
			case errors.Is(err, errInstanceNameTooLong):
				writeErr(w, http.StatusBadRequest, err.Error())
			case errors.Is(err, errTooManyInstances):
				writeErr(w, http.StatusConflict, err.Error())
			default:
				writeErr(w, http.StatusInternalServerError, "internal error")
			}
			return
		}

		res, err := runImport(r.Context(), reg, caller, name, in)
		if err != nil {
			writeErr(w, http.StatusInternalServerError, "internal error")
			return
		}
		writeJSON(w, http.StatusCreated, res)
	}
}

func runImport(ctx context.Context, reg agencies.Registry, owner, name string, in importRequest) (importResult, error) {
	inst, err := reg.CreateInstance(ctx, name)
	if err != nil {
		return importResult{}, err
	}
	if owner != "" {
		if err := reg.AddMember(ctx, inst.ID, owner, agencies.RoleOwner); err != nil {
			return importResult{}, err
		}
	}
	if kind := strings.TrimSpace(in.Template.Archetype); kind != "" {
		if inst, err = reg.SetKind(ctx, inst.ID, kind); err != nil {
			return importResult{}, err
		}
	}
	if purpose := strings.TrimSpace(in.Agency.Description); purpose != "" {
		if inst, err = reg.SetListing(ctx, inst.ID, agencies.ListingChange{Purpose: &purpose}); err != nil {
			return importResult{}, err
		}
	}
	mgr, err := reg.AgencyManager(ctx, inst.ID)
	if err != nil {
		return importResult{}, err
	}
	if _, err := mgr.CreateAgency(ctx, models.Agency{
		Name:        name,
		Description: in.Agency.Description,
	}); err != nil {
		return importResult{}, err
	}
	draft, err := importDraft(ctx, mgr, "Imported from "+name)
	if err != nil {
		return importResult{}, err
	}

	im := newImporter(mgr, draft.ID)
	im.apply(ctx, in)
	im.result.Instance = inst
	im.result.DraftID = draft.ID
	return im.result, nil
}

func importDraft(ctx context.Context, mgr mwanachamaagency.AgencyManager, description string) (models.Draft, error) {
	open, err := mgr.ListDrafts(ctx, mwanachamaagency.DraftFilter{Status: string(models.DraftStatusOpen)})
	if err != nil {
		return models.Draft{}, err
	}
	if len(open) == 0 {
		return mgr.CreateDraft(ctx, description, "", "")
	}
	return mgr.UpdateDraftDescription(ctx, open[0].ID, description)
}

func registerInstanceImportRoute(mux *http.ServeMux, reg agencies.Registry, auth callers) {
	mux.HandleFunc("POST /instances/import", auth.require(importInstance(reg)))
}
