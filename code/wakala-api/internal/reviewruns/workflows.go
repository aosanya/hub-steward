package reviewruns

import (
	"context"
	"encoding/json"
	"fmt"

	mwanachamaagency "wakalaserver/modules/agency"
	agencymodels "wakalaserver/modules/agency/models"
	"wakalaserver/modules/shared/spec"
)

const (
	toolUpdateWorkflow = "agency_update_workflow"
	toolUpdateWorkItem = "agency_update_work_item"
)

const (
	workflowRole = "workflow"
	workItemRole = "work_item"
)

var identityKeys = []string{"draft_id", "workflow_id"}

const workflowsSystemPrompt = `You are the Workflows reviewer of an agency design tool. A designer has a finished draft of an agency and you read every workflow of it. You only read; you change nothing.

Check each workflow for these things:
- The steps run in a sensible order: nothing is asked before what it needs exists, nothing happens after the work is finished, and no step is a duplicate of another.
- There is a person at each wait. A fill_form or yes_no step names the role that acts on it. A send_form or route step names no role, because the agency takes it. A notify step names the role that sends it when a person or an agent sends it, and no role when the agency sends it; both are correct, so never report a role on a notify step or a missing one.
- Every wait has a time limit. A step that waits on a person carries time_limit_minutes and the cancel_workflow_id of a workflow of this draft that runs when the time passes with no answer.
- Each step names a step kind that exists: fill_form, send_form, notify, yes_no, route, run_workflow or chat. A step with a role, a form or a link to another step has a kind. A run_workflow step names another workflow to run. A chat step (chat) opens a chat between the person and an agent: it names the role that opens it, the agent role, a topic, an opening line, up to three prompts, the tools the agent may call and the workflows the chat may lead the person to.
- A workflow that shows opens_in: chat starts in a chat with an agent and holds one chat step; a workflow that shows no opens_in starts in a form.
- The workflow serves an objective. A workflow linked to no objective is a finding.
- A workflow has a name and a description that say what it does, and a role named on a step is a role that exists in the draft.
- The name of a workflow starts with a verb that says what the person does, in sentence case: "Create group order", "Buy now", "Approve a poster". A name that reads as a label for a thing, such as "Group order", "Group sale" or "Pooled input order", is a finding, even when its first word could also be a verb. A name that already reads as a command is correct, whichever verb it uses; never report it.

A finding is one problem in one workflow or step. Name the workflow and the step by their codes and names in the title, for example "Add a time limit to W-3 step S-12".

Apply uses these agency tools, with exactly these names and arguments. The draft text you read shows the id of every workflow, step, role and objective; use those ids.
- agency_update_work_item changes one step. Its arguments name the step and the fields being fixed, and every field left out is carried over from the stored step, the columns of a chat step included. Arguments: work_item_id, title, description, ordinality, prompt, kind, role_id, run_workflow_id, form_name, questions, recipient_role_id, sent_step_id, routes, otherwise_step_id, time_limit_minutes, cancel_workflow_id. A step stays in its own workflow and draft: they are always the stored ones and no argument moves it. Example for a missing time limit: {"work_item_id": "<step id>", "time_limit_minutes": 2880, "cancel_workflow_id": "<id of a workflow of this draft>"}. Send only the fields the finding changes: to clear a field send "" for text, 0 for a number or [] for a list, and null changes nothing. The same call changes a step's role (role_id), its kind (kind) or its place in the order (ordinality).
- agency_create_work_item adds a step. Arguments: draft_id, workflow_id, title, description, ordinality, prompt, kind, role_id, run_workflow_id, form_name, questions, time_limit_minutes, cancel_workflow_id.
- agency_delete_work_item removes a duplicate or useless step. Argument: work_item_id.
- agency_update_workflow changes one workflow. Arguments: workflow_id and the fields being fixed among name, description, ordinality and event_flows; every field left out is carried over from the stored workflow, opens_in included, and a code is never sent; to clear a field send "" for text, 0 for a number or [] for a list, and null changes nothing. Use it to fix a missing name or description, a name that does not start with a verb, or the order of the workflows.
- agency_create_workflow adds a workflow. Arguments: draft_id, name, description, ordinality.
- agency_link_workflow_objective makes a workflow serve an objective. Arguments: draft_id, workflow_id, objective_id. Use it only when exactly one objective clearly fits.
- agency_get_work_item (work_item_id) and agency_get_workflow (workflow_id) may follow in "then" to read the result back.

A name that does not start with a verb is one finding on that workflow, titled with its code and name, for example "Start W-4 \"Group sale\" with a verb". The fix is a rename and nothing else: the tool is agency_update_workflow, its arguments are workflow_id and name, and "then" is agency_get_workflow to read the new name back. The new name is the workflow's own words with a verb in front, in sentence case: "Group order" becomes "Create group order" and "Pooled input order" becomes "Create pooled input order". Take the verb from what the description and the steps show the person doing, and add no word the workflow's name or description does not already hold, so no business meaning is invented. When they show no verb that fits, leave tool, arguments and then out and say in the detail which verb the designer has to choose.

Leave tool, arguments and then out when no safe automatic fix exists: when the right role, objective, cancel workflow or wording is the designer's choice and not clear from the draft, when a step would need a new form with questions you would have to invent, or when the fix would delete work. Never invent an id; every id in arguments comes from the draft text.

Write the summary in two sentences: how many workflows you read and how well they stand.`

type WorkflowsReviewer struct {
	Model  Model
	Reader DraftReader
}

func NewWorkflowsReviewer(model Model, reader DraftReader) *WorkflowsReviewer {
	return &WorkflowsReviewer{Model: model, Reader: reader}
}

func (r *WorkflowsReviewer) Area() string {
	return AreaWorkflows
}

func (r *WorkflowsReviewer) Review(ctx context.Context, in AreaInput) (AreaResult, error) {
	draft, err := r.Reader.Read(ctx, in.DraftID)
	if err != nil {
		return AreaResult{}, err
	}
	result, err := ReadArea(ctx, r.Model, workflowsSystemPrompt, draft, in)
	if err != nil {
		return AreaResult{}, err
	}
	stored, err := r.storedRows(ctx, in.DraftID)
	if err != nil {
		return AreaResult{}, err
	}
	for i := range result.Findings {
		result.Findings[i] = stored.carried(result.Findings[i])
	}
	return result, nil
}

type workflowRowSource interface {
	workflowRows(ctx context.Context, draftID string) ([]agencymodels.Workflow, []agencymodels.WorkItem, error)
}

func (r workflowsReader) workflowRows(ctx context.Context, draftID string) ([]agencymodels.Workflow, []agencymodels.WorkItem, error) {
	workflows, err := r.agency.ListWorkflows(ctx, draftID, mwanachamaagency.WorkflowFilter{})
	if err != nil {
		return nil, nil, workflowsReadError("workflows", err)
	}
	steps, err := r.agency.ListWorkItems(ctx, draftID, mwanachamaagency.WorkItemFilter{})
	if err != nil {
		return nil, nil, workflowsReadError("steps", err)
	}
	return workflows, steps, nil
}

type objectKeys struct {
	readOnly map[string]bool
	writable map[string]bool
}

func objectKeysOf(b *spec.Blueprint, role string) (objectKeys, error) {
	object, ok := b.Object(role)
	if !ok {
		return objectKeys{}, fmt.Errorf("The agency blueprint declares no %q.", role)
	}
	keys := objectKeys{readOnly: map[string]bool{}, writable: map[string]bool{}}
	for _, f := range object.Fields {
		if f.Primary || f.Immutable || f.Type == spec.TypeTimestamp || f.Name == "deleted" {
			keys.readOnly[f.Name] = true
			continue
		}
		keys.writable[f.Name] = true
	}
	return keys, nil
}

func fieldsOf(row any) map[string]any {
	text, err := json.Marshal(row)
	if err != nil {
		return nil
	}
	var out map[string]any
	if err := json.Unmarshal(text, &out); err != nil {
		return nil
	}
	return out
}

func (k objectKeys) storedColumns(row any) map[string]any {
	out := map[string]any{}
	for key, value := range fieldsOf(row) {
		if k.writable[key] {
			out[key] = value
		}
	}
	return out
}

type storedRows struct {
	read         bool
	workflows    map[string]map[string]any
	steps        map[string]map[string]any
	workflowKeys objectKeys
	stepKeys     objectKeys
}

func (r *WorkflowsReviewer) storedRows(ctx context.Context, draftID string) (storedRows, error) {
	blueprint, err := mwanachamaagency.Blueprint()
	if err != nil {
		return storedRows{}, err
	}
	stored := storedRows{workflows: map[string]map[string]any{}, steps: map[string]map[string]any{}}
	if stored.workflowKeys, err = objectKeysOf(blueprint, workflowRole); err != nil {
		return storedRows{}, err
	}
	if stored.stepKeys, err = objectKeysOf(blueprint, workItemRole); err != nil {
		return storedRows{}, err
	}
	source, ok := r.Reader.(workflowRowSource)
	if !ok {
		return stored, nil
	}
	stored.read = true
	workflows, steps, err := source.workflowRows(ctx, draftID)
	if err != nil {
		return storedRows{}, err
	}
	for _, w := range workflows {
		stored.workflows[w.ID] = stored.workflowKeys.storedColumns(w)
	}
	for _, s := range steps {
		stored.steps[s.ID] = stored.stepKeys.storedColumns(s)
	}
	return stored, nil
}

func (s storedRows) carried(f Finding) Finding {
	if s.read && s.namesNoRow(f) {
		f.Detail = f.Detail + " No fix is offered: the id the fix named is not a " + s.kindOf(f) + " of this draft."
		f.Tool, f.Arguments, f.Then = "", nil, ""
		return f
	}
	f.Arguments = s.carry(f)
	return f
}

func (s storedRows) namesNoRow(f Finding) bool {
	switch f.Tool {
	case toolUpdateWorkflow:
		id, _ := f.Arguments["workflow_id"].(string)
		_, found := s.workflows[id]
		return !found
	case toolUpdateWorkItem:
		id, _ := f.Arguments["work_item_id"].(string)
		_, found := s.steps[id]
		return !found
	}
	return false
}

func (s storedRows) kindOf(f Finding) string {
	if f.Tool == toolUpdateWorkflow {
		return "workflow"
	}
	return "step"
}

func (s storedRows) carry(f Finding) map[string]any {
	switch f.Tool {
	case toolUpdateWorkflow:
		return carriedOver(s.workflows, s.workflowKeys, "workflow_id", f.Arguments)
	case toolUpdateWorkItem:
		return withoutEmptyKind(carriedOver(s.steps, s.stepKeys, "work_item_id", f.Arguments))
	}
	return f.Arguments
}

func withoutEmptyKind(step map[string]any) map[string]any {
	if kind, said := step["kind"]; said && kind == "" {
		delete(step, "kind")
	}
	return step
}

func carriedOver(stored map[string]map[string]any, keys objectKeys, idKey string, said map[string]any) map[string]any {
	if len(said) == 0 {
		return said
	}
	id, _ := said[idKey].(string)
	row := stored[id]
	out := map[string]any{}
	for key, value := range row {
		out[key] = value
	}
	for key, value := range said {
		if value != nil {
			out[key] = value
		}
	}
	for key := range keys.readOnly {
		delete(out, key)
	}
	for _, key := range identityKeys {
		if value, ok := row[key]; ok {
			out[key] = value
		}
	}
	out[idKey] = said[idKey]
	return out
}
