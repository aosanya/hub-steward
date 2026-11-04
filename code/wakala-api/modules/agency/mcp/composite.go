package mcp

import (
	"context"
	"errors"
	"fmt"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	mwanachamaagency "wakalaserver/modules/agency"
	"wakalaserver/modules/agency/models"
)

func registerCompositeTools(server *mcp.Server, resolve ManagerResolver) {
	mcp.AddTool(server, &mcp.Tool{
		Name:  "agency_design_from_spec",
		Title: "Design Agency From Spec",
		Description: "Build out an Agency's roles, goals/objectives/workflows/work items, and RACI assignments from one structured spec, composing the granular agency_* tools internally. Every entity is created inside the Draft named by draft_id — fork one with agency_create_draft first. " +
			"Entities reference each other by a caller-chosen \"key\" (not a real id); a reference must name a key defined earlier in that section or in a section this tool applies first. " +
			"Order applied: agency (only if none exists yet), roles, goals, objectives (goal_key), workflows (each lists the objectives it serves by objective_keys or objective_ids), work_items (workflow_key), raci (work_item_key). " +
			"A workflow may serve several objectives; a work item belongs to no objective of its own. " +
			"A workflow or raci entry may instead reference an already-existing Objective/Role/WorkItem directly by its real id (objective_ids, role_id, work_item_id) if it isn't also being created in this same spec — use this to create one new Role (or Workflow) and tie it to something that already exists in a single call, instead of a separate create-then-assign round trip. " +
			"A step may have any number of roles under any RACI label; only the same role with the same label on the same step twice is refused. " +
			"One call carries at most 1000 entries across all sections together; a bigger spec is refused before anything is written, so send it in several calls. " +
			"One entity failing does not stop the rest — check the result's errors field.",
	}, mcpDesignAgencyFromSpec(resolve))
}

type specAgency struct {
	Name string `json:"name,omitempty" jsonschema:"the Agency's name"`
}

type specRole struct {
	Key         string `json:"key" jsonschema:"a caller-chosen name other spec entries reference this Role by"`
	Name        string `json:"name" jsonschema:"e.g. \"bug-hunter\""`
	Description string `json:"description,omitempty"`
}

type specGoal struct {
	Key         string `json:"key" jsonschema:"a caller-chosen name other spec entries reference this Goal by"`
	Title       string `json:"title"`
	Description string `json:"description,omitempty"`
}

type specObjective struct {
	Key         string `json:"key" jsonschema:"a caller-chosen name other spec entries reference this Objective by"`
	GoalKey     string `json:"goal_key" jsonschema:"a key from this spec's goals list — a Goal may have several Objectives"`
	Title       string `json:"title"`
	Description string `json:"description,omitempty"`
}

type specWorkflow struct {
	Key           string   `json:"key" jsonschema:"a caller-chosen name other spec entries reference this Workflow by"`
	Name          string   `json:"name"`
	Description   string   `json:"description,omitempty"`
	ObjectiveKeys []string `json:"objective_keys,omitempty" jsonschema:"keys from this spec's objectives list — the objectives this Workflow serves; a workflow with none is a blocking issue when the agency is published"`
	ObjectiveIDs  []string `json:"objective_ids,omitempty" jsonschema:"already-existing Objectives' real ids, for objectives that aren't also being created in this spec's objectives list"`
}

type specWorkItem struct {
	Key         string `json:"key" jsonschema:"a caller-chosen name other spec entries reference this WorkItem by"`
	WorkflowKey string `json:"workflow_key" jsonschema:"a key from this spec's workflows list"`
	Title       string `json:"title"`
	Description string `json:"description,omitempty"`
	Prompt      string `json:"prompt,omitempty" jsonschema:"instructions for whoever/whatever executes this WorkItem"`
}

type specRACI struct {
	RoleKey     string `json:"role_key,omitempty" jsonschema:"a key from this spec's roles list — set this or role_id, not both"`
	RoleID      string `json:"role_id,omitempty" jsonschema:"an already-existing Role's real id, when it isn't also being created in this spec's roles list"`
	WorkItemKey string `json:"work_item_key,omitempty" jsonschema:"a key from this spec's work_items list — set this or work_item_id, not both"`
	WorkItemID  string `json:"work_item_id,omitempty" jsonschema:"an already-existing WorkItem's real id, when it isn't also being created in this spec's work_items list"`
	Label       string `json:"label" jsonschema:"responsible, accountable, consulted, or informed"`
}

type mcpDesignFromSpecParams struct {
	InstanceID string          `json:"instance_id" jsonschema:"which Agency this operates on, as resolved by the mounting host"`
	DraftID    string          `json:"draft_id,omitempty" jsonschema:"the Draft every created entity belongs to — fork one with agency_create_draft first. Only optional for an agency-only spec (just the agency field set); every other section needs it"`
	Agency     *specAgency     `json:"agency,omitempty" jsonschema:"created only if this Instance has no Agency yet; omit or leave unset otherwise"`
	Roles      []specRole      `json:"roles,omitempty"`
	Goals      []specGoal      `json:"goals,omitempty"`
	Objectives []specObjective `json:"objectives,omitempty"`
	Workflows  []specWorkflow  `json:"workflows,omitempty"`
	WorkItems  []specWorkItem  `json:"work_items,omitempty"`
	RACI       []specRACI      `json:"raci,omitempty"`
}

func (p mcpDesignFromSpecParams) entityCount() int {
	n := len(p.Roles) + len(p.Goals) + len(p.Objectives) + len(p.Workflows) + len(p.WorkItems) + len(p.RACI)
	for _, w := range p.Workflows {
		n += len(w.ObjectiveKeys) + len(w.ObjectiveIDs)
	}
	return n
}

type mcpDesignFromSpecResult struct {
	AgencyCreated   bool              `json:"agency_created"`
	Roles           map[string]string `json:"roles,omitempty"`
	Goals           map[string]string `json:"goals,omitempty"`
	Objectives      map[string]string `json:"objectives,omitempty"`
	Workflows       map[string]string `json:"workflows,omitempty"`
	WorkItems       map[string]string `json:"work_items,omitempty"`
	WorkflowLinks   []string          `json:"workflow_objectives,omitempty"`
	RoleAssignments []string          `json:"role_assignments,omitempty"`
	Errors          []string          `json:"errors,omitempty"`
}

func mcpDesignAgencyFromSpec(resolve ManagerResolver) func(context.Context, *mcp.CallToolRequest, mcpDesignFromSpecParams) (*mcp.CallToolResult, mcpDesignFromSpecResult, error) {
	return func(ctx context.Context, _ *mcp.CallToolRequest, p mcpDesignFromSpecParams) (*mcp.CallToolResult, mcpDesignFromSpecResult, error) {
		m, err := resolve(ctx, p.InstanceID)
		if err != nil {
			return nil, mcpDesignFromSpecResult{}, err
		}
		if err := mwanachamaagency.CheckDesignSpecSize(p.entityCount()); err != nil {
			return nil, mcpDesignFromSpecResult{}, err
		}
		if err := p.duplicateKeyError(); err != nil {
			return nil, mcpDesignFromSpecResult{}, err
		}

		out := mcpDesignFromSpecResult{
			Roles:      map[string]string{},
			Goals:      map[string]string{},
			Objectives: map[string]string{},
			Workflows:  map[string]string{},
		}

		if p.Agency != nil {
			if _, err := m.GetAgency(ctx); errors.Is(err, mwanachamaagency.ErrAgencyNotFound) {
				if _, err := m.CreateAgency(ctx, models.Agency{Name: p.Agency.Name}); err != nil {
					out.Errors = append(out.Errors, "agency: "+err.Error())
				} else {
					out.AgencyCreated = true
				}
			}
		}

		for _, r := range p.Roles {
			row, err := m.CreateRole(ctx, models.Role{DraftID: p.DraftID, Name: r.Name, Description: r.Description})
			if err != nil {
				out.Errors = append(out.Errors, fmt.Sprintf("role %q: %v", r.Key, err))
				continue
			}
			out.Roles[r.Key] = row.ID
		}

		for _, g := range p.Goals {
			row, err := m.CreateGoal(ctx, models.Goal{DraftID: p.DraftID, Title: g.Title, Description: g.Description})
			if err != nil {
				out.Errors = append(out.Errors, fmt.Sprintf("goal %q: %v", g.Key, err))
				continue
			}
			out.Goals[g.Key] = row.ID
		}

		for _, o := range p.Objectives {
			goalID, ok := out.Goals[o.GoalKey]
			if !ok {
				out.Errors = append(out.Errors, fmt.Sprintf("objective %q: unknown goal_key %q", o.Key, o.GoalKey))
				continue
			}
			row, err := m.CreateObjective(ctx, models.Objective{DraftID: p.DraftID, GoalID: goalID, Title: o.Title, Description: o.Description})
			if err != nil {
				out.Errors = append(out.Errors, fmt.Sprintf("objective %q: %v", o.Key, err))
				continue
			}
			out.Objectives[o.Key] = row.ID
		}

		for _, w := range p.Workflows {
			row, err := m.CreateWorkflow(ctx, models.Workflow{DraftID: p.DraftID, Name: w.Name, Description: w.Description})
			if err != nil {
				out.Errors = append(out.Errors, fmt.Sprintf("workflow %q: %v", w.Key, err))
				continue
			}
			out.Workflows[w.Key] = row.ID

			objectiveIDs := append([]string{}, w.ObjectiveIDs...)
			for _, key := range w.ObjectiveKeys {
				id, ok := out.Objectives[key]
				if !ok {
					out.Errors = append(out.Errors, fmt.Sprintf("workflow %q: unknown objective_key %q", w.Key, key))
					continue
				}
				objectiveIDs = append(objectiveIDs, id)
			}
			for _, objectiveID := range objectiveIDs {
				link, err := m.CreateWorkflowObjective(ctx, models.WorkflowObjective{DraftID: p.DraftID, WorkflowID: row.ID, ObjectiveID: objectiveID})
				if err != nil {
					out.Errors = append(out.Errors, fmt.Sprintf("workflow %q: objective %s: %v", w.Key, mwanachamaagency.QuoteIfUnsafe(objectiveID), err))
					continue
				}
				out.WorkflowLinks = append(out.WorkflowLinks, link.ID)
			}
		}

		workItemIDs := map[string]string{}
		for _, wi := range p.WorkItems {
			workflowID, ok := out.Workflows[wi.WorkflowKey]
			if !ok {
				out.Errors = append(out.Errors, fmt.Sprintf("work_item %q: unknown workflow_key %q", wi.Key, wi.WorkflowKey))
				continue
			}
			row, err := m.CreateWorkItem(ctx, models.WorkItem{DraftID: p.DraftID, WorkflowID: workflowID, Title: wi.Title, Description: wi.Description, Prompt: wi.Prompt})
			if err != nil {
				out.Errors = append(out.Errors, fmt.Sprintf("work_item %q: %v", wi.Key, err))
				continue
			}
			workItemIDs[wi.Key] = row.ID
		}
		if len(workItemIDs) > 0 {
			out.WorkItems = workItemIDs
		}

		for i, ra := range p.RACI {
			if ra.RoleKey != "" && ra.RoleID != "" {
				out.Errors = append(out.Errors, fmt.Sprintf("raci[%d]: set role_key or role_id, not both", i))
				continue
			}
			if ra.WorkItemKey != "" && ra.WorkItemID != "" {
				out.Errors = append(out.Errors, fmt.Sprintf("raci[%d]: set work_item_key or work_item_id, not both", i))
				continue
			}
			roleID := ra.RoleID
			if ra.RoleKey != "" {
				id, ok := out.Roles[ra.RoleKey]
				if !ok {
					out.Errors = append(out.Errors, fmt.Sprintf("raci[%d]: unknown role_key %q", i, ra.RoleKey))
					continue
				}
				roleID = id
			}
			if roleID == "" {
				out.Errors = append(out.Errors, fmt.Sprintf("raci[%d]: must set role_key or role_id", i))
				continue
			}

			workItemID := ra.WorkItemID
			if ra.WorkItemKey != "" {
				id, ok := workItemIDs[ra.WorkItemKey]
				if !ok {
					out.Errors = append(out.Errors, fmt.Sprintf("raci[%d]: unknown work_item_key %q", i, ra.WorkItemKey))
					continue
				}
				workItemID = id
			}
			if workItemID == "" {
				out.Errors = append(out.Errors, fmt.Sprintf("raci[%d]: must set work_item_key or work_item_id", i))
				continue
			}

			row, err := m.CreateRoleAssignment(ctx, models.RoleAssignment{DraftID: p.DraftID, RoleID: roleID, WorkItemID: workItemID, Label: models.RACILabel(ra.Label)})
			if err != nil {
				out.Errors = append(out.Errors, fmt.Sprintf("raci[%d]: %v", i, err))
				continue
			}
			out.RoleAssignments = append(out.RoleAssignments, row.ID)
		}

		s := summary(
			"Applied spec: %d role(s), %d goal(s), %d objective(s), %d workflow(s), %d workflow objective link(s), %d work item(s), %d RACI assignment(s), %d error(s)",
			len(out.Roles), len(out.Goals), len(out.Objectives),
			len(out.Workflows), len(out.WorkflowLinks), len(out.WorkItems), len(out.RoleAssignments), len(out.Errors),
		)
		return s, out, nil
	}
}
