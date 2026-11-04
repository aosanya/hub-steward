package mwanachamaagency

import (
	"context"
	"fmt"
	"strings"

	"wakalaserver/modules/agency/models"
)

const briefScopeOrganization = "organization"

func (m *agencyManager) GetRoleBrief(ctx context.Context, roleID string) (models.RoleBrief, error) {
	pub, err := m.GetPublicationForChannel(ctx, models.DefaultChannel)
	if err != nil {
		return models.RoleBrief{}, err
	}
	return briefFromDocument(pub, roleID)
}

func targetKey(t models.TargetType, code string) string {
	return string(t) + "/" + code
}

func briefFromDocument(pub models.AgencyPublication, roleID string) (models.RoleBrief, error) {
	doc := pub.Document
	var role *models.DocumentRole
	for i := range doc.Roles {
		if doc.Roles[i].ID == roleID || doc.Roles[i].Code == roleID {
			role = &doc.Roles[i]
			break
		}
	}
	if role == nil {
		return models.RoleBrief{}, ErrRoleNotFound
	}
	brief := models.RoleBrief{
		PublicationVersion: pub.Version,
		PublicationTag:     pub.Tag,
		RoleID:             role.ID,
		RoleCode:           role.Code,
		Name:               role.Name,
		Description:        role.Description,
	}

	goals := map[string]models.DocumentGoal{}
	for _, g := range doc.Goals {
		goals[g.ID] = g
	}
	objectives := map[string]models.DocumentObjective{}
	for _, o := range doc.Objectives {
		objectives[o.ID] = o
	}

	stepsByID := map[string]models.DocumentWorkItem{}
	for _, w := range doc.WorkItems {
		stepsByID[w.ID] = w
	}
	objectivesByWorkflow := map[string][]string{}
	for _, l := range doc.WorkflowObjectives {
		objectivesByWorkflow[l.WorkflowID] = append(objectivesByWorkflow[l.WorkflowID], l.ObjectiveID)
	}

	labelsByWorkflow := map[string]map[string]bool{}
	labelsByStep := map[string]map[string]bool{}
	var workflowOrder []string
	for _, a := range doc.RoleAssignments {
		step, ok := stepsByID[a.WorkItemID]
		if a.RoleID != role.ID || !ok {
			continue
		}
		if labelsByWorkflow[step.WorkflowID] == nil {
			labelsByWorkflow[step.WorkflowID] = map[string]bool{}
			workflowOrder = append(workflowOrder, step.WorkflowID)
		}
		labelsByWorkflow[step.WorkflowID][a.Label] = true
		if labelsByStep[step.ID] == nil {
			labelsByStep[step.ID] = map[string]bool{}
		}
		labelsByStep[step.ID][a.Label] = true
	}

	labelsByObjective := map[string]map[string]bool{}
	var objectiveOrder []string
	for _, workflowID := range workflowOrder {
		for _, objectiveID := range objectivesByWorkflow[workflowID] {
			if labelsByObjective[objectiveID] == nil {
				labelsByObjective[objectiveID] = map[string]bool{}
				objectiveOrder = append(objectiveOrder, objectiveID)
			}
			for label := range labelsByWorkflow[workflowID] {
				labelsByObjective[objectiveID][label] = true
			}
		}
	}

	scopeByTarget := map[string]string{targetKey(models.TargetTypeRole, role.Code): "seat"}
	objectiveCodeByID := map[string]string{}
	for _, objectiveID := range objectiveOrder {
		o, ok := objectives[objectiveID]
		if !ok {
			continue
		}
		objectiveCodeByID[o.ID] = o.Code
		g := goals[o.GoalID]
		brief.Objectives = append(brief.Objectives, models.BriefObjective{
			Code: o.Code, Title: o.Title, Description: o.Description, Label: joinLabels(labelsByObjective[o.ID]),
			GoalCode: g.Code, GoalTitle: g.Title, GoalDescription: g.Description,
		})
		scopeByTarget[targetKey(models.TargetTypeObjective, o.Code)] = "objective " + o.Code
		if g.Code != "" {
			scopeByTarget[targetKey(models.TargetTypeGoal, g.Code)] = "goal " + g.Code
		}
	}

	brief.Controls = briefControls(doc, scopeByTarget)

	for _, w := range doc.WorkItems {
		if labelsByStep[w.ID] == nil || w.Prompt == "" {
			continue
		}
		objectiveCode := ""
		for _, objectiveID := range objectivesByWorkflow[w.WorkflowID] {
			if code, ok := objectiveCodeByID[objectiveID]; ok {
				objectiveCode = code
				break
			}
		}
		brief.WorkItems = append(brief.WorkItems, models.BriefWorkItem{
			Code: w.Code, Title: w.Title, ObjectiveCode: objectiveCode, Labels: orderedLabels(labelsByStep[w.ID]), Prompt: w.Prompt,
		})
	}

	brief.Text = renderBrief(brief)
	return brief, nil
}

var raciOrder = []models.RACILabel{
	models.RACILabelResponsible, models.RACILabelAccountable, models.RACILabelConsulted, models.RACILabelInformed,
}

func orderedLabels(held map[string]bool) []string {
	var out []string
	for _, l := range raciOrder {
		if held[string(l)] {
			out = append(out, string(l))
		}
	}
	return out
}

func joinLabels(held map[string]bool) string {
	return strings.Join(orderedLabels(held), ", ")
}

func briefControls(doc models.AgencyDocument, scopeByTarget map[string]string) []models.BriefStatement {
	controls := make([]models.DocumentStatement, 0, len(doc.Controls))
	for _, c := range doc.Controls {
		controls = append(controls, models.DocumentStatement{ID: c.ID, Code: c.Code, Text: c.Text})
	}
	attachments := make([]models.DocumentAttachment, 0, len(doc.ControlAttachments))
	for _, a := range doc.ControlAttachments {
		attachments = append(attachments, models.DocumentAttachment{ValueCode: a.ControlCode, TargetType: a.TargetType, TargetCode: a.TargetCode})
	}
	codeOfControl := func(a models.DocumentAttachment) string { return a.ValueCode }
	out := briefStatements(controls, attachments, codeOfControl, scopeByTarget)
	out = append(out, briefStatements(doc.Values, doc.ValueAttachments, func(a models.DocumentAttachment) string { return a.ValueCode }, scopeByTarget)...)
	return append(out, briefStatements(doc.Rules, doc.RuleAttachments, func(a models.DocumentAttachment) string { return a.RuleCode }, scopeByTarget)...)
}

func briefStatements(items []models.DocumentStatement, attachments []models.DocumentAttachment, codeOf func(models.DocumentAttachment) string, scopeByTarget map[string]string) []models.BriefStatement {
	attached := map[string][]models.DocumentAttachment{}
	for _, a := range attachments {
		attached[codeOf(a)] = append(attached[codeOf(a)], a)
	}
	var out []models.BriefStatement
	for _, it := range items {
		as := attached[it.Code]
		if len(as) == 0 {
			out = append(out, models.BriefStatement{Code: it.Code, Text: it.Text, Scope: briefScopeOrganization})
			continue
		}
		var scopes []string
		for _, a := range as {
			if s, ok := scopeByTarget[a.TargetType+"/"+a.TargetCode]; ok {
				scopes = append(scopes, s)
			}
		}
		if len(scopes) > 0 {
			out = append(out, models.BriefStatement{Code: it.Code, Text: it.Text, Scope: strings.Join(scopes, ", ")})
		}
	}
	return out
}

func renderBrief(b models.RoleBrief) string {
	var s strings.Builder
	fmt.Fprintf(&s, "Seat: %s (%s)\n", b.Name, b.RoleCode)
	if b.Description != "" {
		fmt.Fprintf(&s, "%s\n", b.Description)
	}
	s.WriteString("\nObjectives your work items serve:\n")
	if len(b.Objectives) == 0 {
		s.WriteString("- none\n")
	}
	for _, o := range b.Objectives {
		fmt.Fprintf(&s, "- %s %s [%s] under goal %s %s\n", o.Code, o.Title, o.Label, o.GoalCode, o.GoalTitle)
	}
	writeStatements(&s, "Controls", b.Controls)
	s.WriteString("\nWork items:\n")
	if len(b.WorkItems) == 0 {
		s.WriteString("- none\n")
	}
	for _, w := range b.WorkItems {
		fmt.Fprintf(&s, "- %s %s [%s] (serves objective %s): %s\n", w.Code, w.Title, strings.Join(w.Labels, ", "), w.ObjectiveCode, w.Prompt)
	}
	return s.String()
}

func writeStatements(s *strings.Builder, heading string, items []models.BriefStatement) {
	fmt.Fprintf(s, "\n%s:\n", heading)
	if len(items) == 0 {
		s.WriteString("- none\n")
	}
	for _, it := range items {
		fmt.Fprintf(s, "- %s (%s): %s\n", it.Code, it.Scope, it.Text)
	}
}
