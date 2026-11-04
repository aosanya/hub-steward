package mwanachamaagency

import (
	"context"
	"fmt"

	"wakalaserver/modules/agency/models"
)

var SWELabPersonas = []string{
	"bug-hunter", "business-analyst", "change-expectation-agent",
	"change-failure-agent", "change-impact-agent", "change-story-agent",
	"code-explorer", "code-quality-reviewer", "code-reviewer",
	"contracts-reviewer", "developer", "fpf-agent",
	"historical-context-reviewer", "judge", "meta-judge", "researcher",
	"security-auditor", "software-architect", "tech-lead", "tech-writer",
	"test-coverage-reviewer",
}

type SWELabSeed struct {
	Agency             models.Agency
	Draft              models.Draft
	Roles              map[string]models.Role
	Modules            map[string]models.Module
	Goals              []models.Goal
	Objectives         []models.Objective
	Workflows          []models.Workflow
	WorkflowObjectives []models.WorkflowObjective
	WorkItems          []models.WorkItem
	RoleAssignments    []models.RoleAssignment
}

func SeedSWELab(ctx context.Context, m AgencyManager) (SWELabSeed, error) {
	var seed SWELabSeed

	agency, err := m.CreateAgency(ctx, models.Agency{
		Name: "SWELab",
	})
	if err != nil {
		return SWELabSeed{}, fmt.Errorf("SeedSWELab: %w", err)
	}
	seed.Agency = agency

	draft, err := m.CreateDraft(ctx, "SWELab seed", "", "")
	if err != nil {
		return SWELabSeed{}, fmt.Errorf("SeedSWELab: create draft: %w", err)
	}
	seed.Draft = draft
	draftID := draft.ID

	seed.Roles = make(map[string]models.Role, len(SWELabPersonas))
	for _, name := range SWELabPersonas {
		role, err := m.CreateRole(ctx, models.Role{DraftID: draftID, Name: name})
		if err != nil {
			return SWELabSeed{}, fmt.Errorf("SeedSWELab: create role %q: %w", name, err)
		}
		seed.Roles[name] = role
	}

	modules, err := m.ListModules(ctx, draftID, ModuleFilter{})
	if err != nil {
		return SWELabSeed{}, fmt.Errorf("SeedSWELab: list modules: %w", err)
	}
	seed.Modules = make(map[string]models.Module, len(modules))
	for _, mod := range modules {
		seed.Modules[mod.Code] = mod
	}

	workflow, err := m.CreateWorkflow(ctx, models.Workflow{DraftID: draftID, Name: "Code Review Process"})
	if err != nil {
		return SWELabSeed{}, fmt.Errorf("SeedSWELab: %w", err)
	}
	seed.Workflows = []models.Workflow{workflow}

	type assignment struct {
		persona string
		label   models.RACILabel
	}
	items := []struct {
		goalTitle   string
		workItem    string
		assignments []assignment
	}{
		{
			goalTitle: "Ship reliable software",
			workItem:  "Review pull request",
			assignments: []assignment{
				{"code-reviewer", models.RACILabelResponsible},
				{"tech-lead", models.RACILabelAccountable},
				{"security-auditor", models.RACILabelConsulted},
				{"developer", models.RACILabelInformed},
			},
		},
		{
			goalTitle: "Resolve reported defects",
			workItem:  "Triage a bug report",
			assignments: []assignment{
				{"bug-hunter", models.RACILabelResponsible},
				{"tech-lead", models.RACILabelAccountable},
			},
		},
		{
			goalTitle: "Keep the architecture coherent",
			workItem:  "Approve architecture change",
			assignments: []assignment{
				{"software-architect", models.RACILabelResponsible},
				{"tech-lead", models.RACILabelAccountable},
				{"contracts-reviewer", models.RACILabelConsulted},
			},
		},
	}

	for _, item := range items {
		goal, err := m.CreateGoal(ctx, models.Goal{DraftID: draftID, Title: item.goalTitle})
		if err != nil {
			return SWELabSeed{}, fmt.Errorf("SeedSWELab: create goal %q: %w", item.goalTitle, err)
		}
		seed.Goals = append(seed.Goals, goal)

		objective, err := m.CreateObjective(ctx, models.Objective{DraftID: draftID, GoalID: goal.ID, Title: item.goalTitle})
		if err != nil {
			return SWELabSeed{}, fmt.Errorf("SeedSWELab: create objective for %q: %w", item.goalTitle, err)
		}
		seed.Objectives = append(seed.Objectives, objective)

		link, err := m.CreateWorkflowObjective(ctx, models.WorkflowObjective{
			DraftID: draftID, WorkflowID: workflow.ID, ObjectiveID: objective.ID,
		})
		if err != nil {
			return SWELabSeed{}, fmt.Errorf("SeedSWELab: link objective %q to the workflow: %w", item.goalTitle, err)
		}
		seed.WorkflowObjectives = append(seed.WorkflowObjectives, link)

		workItem, err := m.CreateWorkItem(ctx, models.WorkItem{
			DraftID: draftID, WorkflowID: workflow.ID, Title: item.workItem,
		})
		if err != nil {
			return SWELabSeed{}, fmt.Errorf("SeedSWELab: create work item %q: %w", item.workItem, err)
		}
		seed.WorkItems = append(seed.WorkItems, workItem)

		for _, a := range item.assignments {
			role, ok := seed.Roles[a.persona]
			if !ok {
				return SWELabSeed{}, fmt.Errorf("SeedSWELab: %q is not a seeded persona", a.persona)
			}
			ra, err := m.CreateRoleAssignment(ctx, models.RoleAssignment{
				DraftID: draftID, WorkItemID: workItem.ID, RoleID: role.ID, Label: a.label,
			})
			if err != nil {
				return SWELabSeed{}, fmt.Errorf("SeedSWELab: assign %q to %q: %w", a.persona, item.workItem, err)
			}
			seed.RoleAssignments = append(seed.RoleAssignments, ra)
		}
	}

	return seed, nil
}
