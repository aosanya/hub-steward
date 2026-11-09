package reviewruns

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	mwanachamaagency "wakalaserver/modules/agency"
	agencymodels "wakalaserver/modules/agency/models"
)

type WorkflowsAgency interface {
	ListWorkflows(ctx context.Context, draftID string, filter mwanachamaagency.WorkflowFilter) ([]agencymodels.Workflow, error)
	ListWorkItems(ctx context.Context, draftID string, filter mwanachamaagency.WorkItemFilter) ([]agencymodels.WorkItem, error)
	ListRoles(ctx context.Context, draftID string, filter mwanachamaagency.RoleFilter) ([]agencymodels.Role, error)
	ListObjectives(ctx context.Context, draftID string, filter mwanachamaagency.ObjectiveFilter) ([]agencymodels.Objective, error)
	ListWorkflowObjectives(ctx context.Context, draftID string, filter mwanachamaagency.WorkflowObjectiveFilter) ([]agencymodels.WorkflowObjective, error)
}

type workflowsReader struct {
	agency WorkflowsAgency
}

func NewWorkflowsReader(agency WorkflowsAgency) DraftReader {
	return workflowsReader{agency: agency}
}

type workflowsDraft struct {
	workflows  []agencymodels.Workflow
	steps      []agencymodels.WorkItem
	roles      []agencymodels.Role
	objectives []agencymodels.Objective
	links      []agencymodels.WorkflowObjective
}

func (r workflowsReader) load(ctx context.Context, draftID string) (workflowsDraft, error) {
	var d workflowsDraft
	var err error
	if d.workflows, err = r.agency.ListWorkflows(ctx, draftID, mwanachamaagency.WorkflowFilter{}); err != nil {
		return workflowsDraft{}, workflowsReadError("workflows", err)
	}
	if d.steps, err = r.agency.ListWorkItems(ctx, draftID, mwanachamaagency.WorkItemFilter{}); err != nil {
		return workflowsDraft{}, workflowsReadError("steps", err)
	}
	if d.roles, err = r.agency.ListRoles(ctx, draftID, mwanachamaagency.RoleFilter{}); err != nil {
		return workflowsDraft{}, workflowsReadError("roles", err)
	}
	if d.objectives, err = r.agency.ListObjectives(ctx, draftID, mwanachamaagency.ObjectiveFilter{}); err != nil {
		return workflowsDraft{}, workflowsReadError("objectives", err)
	}
	if d.links, err = r.agency.ListWorkflowObjectives(ctx, draftID, mwanachamaagency.WorkflowObjectiveFilter{}); err != nil {
		return workflowsDraft{}, workflowsReadError("objective links", err)
	}
	return d, nil
}

func (r workflowsReader) Read(ctx context.Context, draftID string) (string, error) {
	d, err := r.load(ctx, draftID)
	if err != nil {
		return "", err
	}
	return workflowsText(draftID, d.workflows, d.steps, d.roles, d.objectives, d.links), nil
}

type WorkflowBatch struct {
	Text        string
	WorkflowIDs map[string]bool
	StepIDs     map[string]bool
	Codes       map[string]bool
}

type BatchedReader interface {
	DraftReader
	ReadBatches(ctx context.Context, draftID string, size int) ([]WorkflowBatch, error)
}

func (r workflowsReader) ReadBatches(ctx context.Context, draftID string, size int) ([]WorkflowBatch, error) {
	d, err := r.load(ctx, draftID)
	if err != nil {
		return nil, err
	}
	var batches []WorkflowBatch
	for start := 0; start < len(d.workflows); start += size {
		shown := d.workflows[start:min(start+size, len(d.workflows))]
		batch := WorkflowBatch{
			Text:        workflowsTextOf(draftID, shown, d.workflows, d.steps, d.roles, d.objectives, d.links),
			WorkflowIDs: map[string]bool{},
			StepIDs:     map[string]bool{},
			Codes:       map[string]bool{},
		}
		for _, w := range shown {
			batch.WorkflowIDs[w.ID] = true
			batch.Codes[w.Code] = true
			for _, s := range workflowsStepsOf(w.ID, d.steps) {
				batch.StepIDs[s.ID] = true
			}
		}
		batches = append(batches, batch)
	}
	return batches, nil
}

func workflowsReadError(what string, err error) error {
	return fmt.Errorf("The %s of this draft could not be read: %v.", what, err)
}

func workflowsText(draftID string, workflows []agencymodels.Workflow, steps []agencymodels.WorkItem, roles []agencymodels.Role, objectives []agencymodels.Objective, links []agencymodels.WorkflowObjective) string {
	return workflowsTextOf(draftID, workflows, workflows, steps, roles, objectives, links)
}

func workflowsTextOf(draftID string, shown, all []agencymodels.Workflow, steps []agencymodels.WorkItem, roles []agencymodels.Role, objectives []agencymodels.Objective, links []agencymodels.WorkflowObjective) string {
	roleNames := map[string]string{}
	var b strings.Builder
	fmt.Fprintf(&b, "Draft id: %s\n\nRoles:\n", draftID)
	for _, role := range roles {
		roleNames[role.ID] = role.Name
		fmt.Fprintf(&b, "- role id %s, %s: %s\n", role.ID, role.Code, role.Name)
	}
	if len(roles) == 0 {
		b.WriteString("- none\n")
	}
	objectiveTitles := map[string]string{}
	b.WriteString("\nObjectives:\n")
	for _, o := range objectives {
		objectiveTitles[o.ID] = fmt.Sprintf("%s %s", o.Code, o.Title)
		fmt.Fprintf(&b, "- objective id %s, %s: %s\n", o.ID, o.Code, o.Title)
	}
	if len(objectives) == 0 {
		b.WriteString("- none\n")
	}
	workflowNames := map[string]string{}
	for _, w := range all {
		workflowNames[w.ID] = fmt.Sprintf("%s %s", w.Code, w.Name)
	}
	if len(shown) == len(all) {
		fmt.Fprintf(&b, "\nWorkflows (%d):\n", len(shown))
	} else {
		fmt.Fprintf(&b, "\nWorkflows (%d of %d, the others are read in other parts):\n", len(shown), len(all))
	}
	if len(shown) == 0 {
		b.WriteString("- none\n")
	}
	for _, w := range shown {
		workflowText(&b, w, workflowsStepsOf(w.ID, steps), roleNames, workflowNames, workflowsServedBy(w.ID, links, objectiveTitles))
	}
	return b.String()
}

func workflowText(b *strings.Builder, w agencymodels.Workflow, steps []agencymodels.WorkItem, roleNames, workflowNames map[string]string, served []string) {
	fmt.Fprintf(b, "\nWorkflow id %s, %s \"%s\", position %d\n", w.ID, w.Code, w.Name, w.Ordinality)
	fmt.Fprintf(b, "  description: %s\n", workflowsOrNone(w.Description))
	fmt.Fprintf(b, "  serves objectives: %s\n", workflowsOrNone(strings.Join(served, "; ")))
	if w.EventFlows != "" {
		fmt.Fprintf(b, "  event_flows: %s\n", w.EventFlows)
	}
	if opens := w.OpensIn.Normalized(); opens != "" {
		fmt.Fprintf(b, "  opens_in: %s\n", opens)
	}
	fmt.Fprintf(b, "  steps (%d):\n", len(steps))
	for _, s := range steps {
		stepText(b, s, roleNames, workflowNames)
	}
}

func stepText(b *strings.Builder, s agencymodels.WorkItem, roleNames, workflowNames map[string]string) {
	fmt.Fprintf(b, "  - step id %s, %s \"%s\", position %d%s\n", s.ID, s.Code, s.Title, s.Ordinality, stepKindText(s))
	fmt.Fprintf(b, "    taken by: %s\n", workflowsTakenBy(s, roleNames))
	if s.WaitsOnPerson() {
		fmt.Fprintf(b, "    waits on a person; %s\n", workflowsLimit(s, workflowNames))
	}
	if s.Kind == agencymodels.StepKindRunWorkflow {
		fmt.Fprintf(b, "    runs workflow: %s\n", workflowsOrNone(workflowNames[s.RunWorkflowID]))
	}
	if s.Kind == agencymodels.StepKindChat {
		chatStepText(b, s, roleNames, workflowNames)
	}
	fmt.Fprintf(b, "    step as stored (an update names only the fields it changes): %s\n", workflowsStepJSON(s))
}

func stepKindText(s agencymodels.WorkItem) string {
	if s.Kind == "" {
		return ""
	}
	return ", kind " + string(s.Kind)
}

func chatStepText(b *strings.Builder, s agencymodels.WorkItem, roleNames, workflowNames map[string]string) {
	fmt.Fprintf(b, "    chat agent: %s\n", workflowsChatAgent(s.AgentRoleID, roleNames))
	fmt.Fprintf(b, "    chat topic: %s\n", workflowsOrNone(s.Topic))
	fmt.Fprintf(b, "    chat opening line: %s\n", workflowsOrNone(s.OpeningLine))
	fmt.Fprintf(b, "    chat prompts: %s\n", workflowsOrNone(strings.Join(s.Prompts, "; ")))
	fmt.Fprintf(b, "    chat tools: %s\n", workflowsOrNone(strings.Join(s.Tools, "; ")))
	fmt.Fprintf(b, "    chat starts workflows: %s\n", workflowsOrNone(strings.Join(workflowsStartedBy(s.StartWorkflowIDs, workflowNames), "; ")))
}

func workflowsTakenBy(s agencymodels.WorkItem, roleNames map[string]string) string {
	if s.RoleID == "" {
		return "the agency"
	}
	return workflowsRoleText(s.RoleID, roleNames)
}

func workflowsChatAgent(roleID string, roleNames map[string]string) string {
	if roleID == "" {
		return "none"
	}
	return workflowsRoleText(roleID, roleNames)
}

func workflowsRoleText(roleID string, roleNames map[string]string) string {
	if name, ok := roleNames[roleID]; ok {
		return fmt.Sprintf("role %s (id %s)", name, roleID)
	}
	return fmt.Sprintf("role id %s, which is not a role of this draft", roleID)
}

func workflowsStartedBy(workflowIDs []string, workflowNames map[string]string) []string {
	var started []string
	for _, id := range workflowIDs {
		if name, ok := workflowNames[id]; ok {
			started = append(started, name)
			continue
		}
		started = append(started, fmt.Sprintf("workflow id %s, which is not a workflow of this draft", id))
	}
	return started
}

func workflowsLimit(s agencymodels.WorkItem, workflowNames map[string]string) string {
	if s.TimeLimitMinutes == 0 {
		return "no time limit"
	}
	cancel := workflowsOrNone(workflowNames[s.CancelWorkflowID])
	return fmt.Sprintf("time limit %d minutes, then runs the workflow %s", s.TimeLimitMinutes, cancel)
}

func workflowsStepJSON(s agencymodels.WorkItem) string {
	s.CreatedAt, s.LastUpdated, s.Action = "", "", ""
	fields := fieldsOf(s)
	if s.Kind == "" {
		delete(fields, "kind")
	}
	text, err := json.Marshal(fields)
	if err != nil {
		return "{}"
	}
	return string(text)
}

func workflowsStepsOf(workflowID string, steps []agencymodels.WorkItem) []agencymodels.WorkItem {
	var own []agencymodels.WorkItem
	for _, s := range steps {
		if s.WorkflowID == workflowID {
			own = append(own, s)
		}
	}
	return own
}

func workflowsServedBy(workflowID string, links []agencymodels.WorkflowObjective, titles map[string]string) []string {
	var served []string
	for _, l := range links {
		if l.WorkflowID != workflowID {
			continue
		}
		if title, ok := titles[l.ObjectiveID]; ok {
			served = append(served, title)
		}
	}
	return served
}

func workflowsOrNone(text string) string {
	if strings.TrimSpace(text) == "" {
		return "none"
	}
	return text
}
