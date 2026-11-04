package mwanachamaagency

import (
	"context"
	"encoding/json"
	"fmt"

	"gorm.io/gorm"

	"wakalaserver/modules/agency/models"
)

func (m *agencyManager) buildDocument(ctx context.Context, tx *gorm.DB, draftID string) (models.AgencyDocument, error) {
	var doc models.AgencyDocument

	scoped := func(role string) *gorm.DB {
		return scopeQuery(tx.WithContext(ctx).Table(m.table(role)), draftID)
	}
	unscoped := func(role string) *gorm.DB {
		return tx.WithContext(ctx).Table(m.table(role))
	}
	fail := func(err error) (models.AgencyDocument, error) {
		return models.AgencyDocument{}, fmt.Errorf("buildDocument: %w", err)
	}

	a, err := m.findAgency(ctx, tx)
	if err != nil {
		return fail(err)
	}
	doc.Agency = models.DocumentAgency{
		Name: a.Name, Description: a.Description, Enabled: a.Enabled,
		DefaultFailurePipelineBudget: a.DefaultFailurePipelineBudget,
		InactivityTimeoutSeconds:     a.InactivityTimeoutSeconds,
		EventFlows:                   a.EventFlows,
	}

	roles, err := list[models.Role](m, scoped(roleRole).Order("created_at"), roleRole)
	if err != nil {
		return fail(err)
	}
	for _, r := range roles {
		doc.Roles = append(doc.Roles, models.DocumentRole{
			ID: r.ID, Code: r.Code, Name: r.Name, Description: r.Description, Permissions: r.Permissions, Staff: r.Staff,
		})
	}

	goals, err := list[models.Goal](m, scoped(roleGoal).Order("ordinality"), roleGoal)
	if err != nil {
		return fail(err)
	}
	for _, g := range goals {
		doc.Goals = append(doc.Goals, models.DocumentGoal{
			ID: g.ID, Code: g.Code, Title: g.Title, Description: g.Description, Ordinality: g.Ordinality,
		})
	}

	objectives, err := list[models.Objective](m, scoped(roleObjective).Order("ordinality"), roleObjective)
	if err != nil {
		return fail(err)
	}
	for _, o := range objectives {
		doc.Objectives = append(doc.Objectives, models.DocumentObjective{
			ID: o.ID, Code: o.Code, GoalID: o.GoalID, Title: o.Title,
			Description: o.Description, Ordinality: o.Ordinality,
		})
	}

	workflows, err := list[models.Workflow](m, scoped(roleWorkflow).Order("ordinality"), roleWorkflow)
	if err != nil {
		return fail(err)
	}
	for _, w := range workflows {
		doc.Workflows = append(doc.Workflows, models.DocumentWorkflow{
			ID: w.ID, Code: w.Code, Name: w.Name, Description: w.Description,
			Ordinality: w.Ordinality, EventFlows: w.EventFlows, OpensIn: w.OpensIn, CancelsOrder: w.CancelsOrder,
		})
	}

	workItems, err := list[models.WorkItem](m, scoped(roleWorkItem).Order("ordinality"), roleWorkItem)
	if err != nil {
		return fail(err)
	}
	for _, wi := range workItems {
		doc.WorkItems = append(doc.WorkItems, models.DocumentWorkItem{
			ID: wi.ID, Code: wi.Code, WorkflowID: wi.WorkflowID,
			Title: wi.Title, Description: wi.Description, Ordinality: wi.Ordinality, Prompt: wi.Prompt,
			Kind: wi.Kind, RoleID: wi.RoleID, RunWorkflowID: wi.RunWorkflowID,
			FormName: wi.FormName, Questions: wi.Questions, Tool: wi.Tool,
			RecipientRoleID: wi.RecipientRoleID, SentStepID: wi.SentStepID,
			Routes: wi.Routes, OtherwiseStepID: wi.OtherwiseStepID,
			TimeLimitMinutes: wi.TimeLimitMinutes, CancelWorkflowID: wi.CancelWorkflowID,
			AgentRoleID: wi.AgentRoleID, Topic: wi.Topic, OpeningLine: wi.OpeningLine,
			Prompts: wi.Prompts, Tools: wi.Tools, StartWorkflowIDs: wi.StartWorkflowIDs,
		})
	}

	workflowObjectives, err := list[models.WorkflowObjective](m, scoped(roleWorkflowObjective).Order("created_at"), roleWorkflowObjective)
	if err != nil {
		return fail(err)
	}
	for _, wo := range workflowObjectives {
		doc.WorkflowObjectives = append(doc.WorkflowObjectives, models.DocumentWorkflowObjective{
			ID: wo.ID, WorkflowID: wo.WorkflowID, ObjectiveID: wo.ObjectiveID,
		})
	}

	records, err := list[models.Record](m, scoped(roleRecord).Order("created_at"), roleRecord)
	if err != nil {
		return fail(err)
	}
	for _, r := range records {
		doc.Records = append(doc.Records, models.DocumentRecord{
			ID: r.ID, Code: r.Code, WorkflowID: r.WorkflowID, Name: r.Name,
			RoleID: r.RoleID, ViewerRoleID: r.ViewerRoleID, FormName: r.FormName, Questions: r.Questions,
		})
	}

	measures, err := list[models.Measure](m, scoped(roleMeasure).Order("created_at"), roleMeasure)
	if err != nil {
		return fail(err)
	}
	for _, measure := range measures {
		doc.Measures = append(doc.Measures, models.DocumentMeasure{
			ObjectiveID: measure.ObjectiveID, Name: measure.Name, Current: measure.Current,
			Target: measure.Target, Unit: measure.Unit, Status: measure.Status,
		})
	}

	risks, err := list[models.Risk](m, scoped(roleRisk).Order("created_at"), roleRisk)
	if err != nil {
		return fail(err)
	}
	for _, r := range risks {
		doc.Risks = append(doc.Risks, models.DocumentRisk{
			ID: r.ID, Code: r.Code, Title: r.Title, TopEvent: r.TopEvent, Hazard: r.Hazard,
			HazardCode: r.HazardCode, Owner: r.Owner,
		})
	}

	pathways, err := list[models.RiskPathway](m, scoped(roleRiskPathway).Order("created_at"), roleRiskPathway)
	if err != nil {
		return fail(err)
	}
	for _, p := range pathways {
		doc.RiskPathways = append(doc.RiskPathways, models.DocumentRiskPathway{
			ID: p.ID, Code: p.Code, RiskID: p.RiskID, Side: p.Side, Title: p.Title, Scenario: p.Scenario,
		})
	}

	assignments, err := list[models.RoleAssignment](m, scoped(roleRoleAssignment).Order("created_at"), roleRoleAssignment)
	if err != nil {
		return fail(err)
	}
	for _, ra := range assignments {
		doc.RoleAssignments = append(doc.RoleAssignments, models.DocumentRoleAssignment{
			ID: ra.ID, WorkItemID: ra.WorkItemID, RoleID: ra.RoleID, Label: string(ra.Label),
		})
	}

	values, err := list[models.Value](m, scoped(roleValue).Order("created_at"), roleValue)
	if err != nil {
		return fail(err)
	}
	for _, v := range values {
		doc.Values = append(doc.Values, models.DocumentStatement{ID: v.ID, Code: v.Code, Text: v.Text})
	}

	rules, err := list[models.Rule](m, scoped(roleRule).Order("created_at"), roleRule)
	if err != nil {
		return fail(err)
	}
	for _, r := range rules {
		doc.Rules = append(doc.Rules, models.DocumentStatement{ID: r.ID, Code: r.Code, Text: r.Text})
	}

	valueAttachments, err := list[models.ValueAttachment](m, unscoped(roleValueAttachment).Order("created_at"), roleValueAttachment)
	if err != nil {
		return fail(err)
	}
	for _, a := range valueAttachments {
		doc.ValueAttachments = append(doc.ValueAttachments, models.DocumentAttachment{
			ValueCode: a.ValueCode, TargetType: string(a.TargetType), TargetCode: a.TargetCode,
		})
	}

	ruleAttachments, err := list[models.RuleAttachment](m, unscoped(roleRuleAttachment).Order("created_at"), roleRuleAttachment)
	if err != nil {
		return fail(err)
	}
	for _, a := range ruleAttachments {
		doc.RuleAttachments = append(doc.RuleAttachments, models.DocumentAttachment{
			RuleCode: a.RuleCode, TargetType: string(a.TargetType), TargetCode: a.TargetCode,
		})
	}

	controls, err := list[models.Control](m, scoped(roleControl).Order("created_at"), roleControl)
	if err != nil {
		return fail(err)
	}
	for _, c := range controls {
		doc.Controls = append(doc.Controls, models.DocumentControl{
			ID: c.ID, Code: c.Code, Text: c.Text, Action: c.Action, CondField: c.CondField,
			CondOperator: c.CondOperator, CondValue: c.CondValue, OnBreach: c.OnBreach,
			WorkflowID: c.WorkflowID, Severity: c.Severity,
		})
	}

	controlAttachments, err := list[models.ControlAttachment](m, scoped(roleControlAttachment).Order("created_at"), roleControlAttachment)
	if err != nil {
		return fail(err)
	}
	for _, a := range controlAttachments {
		doc.ControlAttachments = append(doc.ControlAttachments, models.DocumentControlAttachment{
			ControlCode: a.ControlCode, TargetType: string(a.TargetType), TargetCode: a.TargetCode,
		})
	}

	if err := m.libraryDocuments(scoped, &doc); err != nil {
		return fail(err)
	}

	modules, err := list[models.Module](m, scoped(roleModule).Order("code"), roleModule)
	if err != nil {
		return fail(err)
	}
	kinds, err := m.draftStepKinds(ctx, tx, draftID)
	if err != nil {
		return fail(err)
	}
	for _, mod := range withEffectiveEnabled(modules, kinds) {
		doc.Modules = append(doc.Modules, models.DocumentModule{
			ID: mod.ID, Code: mod.Code, Enabled: mod.Enabled, Spec: json.RawMessage(mod.Spec),
			Settings: json.RawMessage(mod.Settings), Mounts: json.RawMessage(mod.Mounts),
		})
	}

	steps, err := list[models.EventFlowStep](m, scoped(roleEventFlowStep).Order("workflow_code, ordinality, step"), roleEventFlowStep)
	if err != nil {
		return fail(err)
	}
	doc.EventFlowSteps = append(doc.EventFlowSteps, steps...)

	doc.Scenarios, err = m.scenarioDocuments(ctx, tx, draftID)
	if err != nil {
		return fail(err)
	}

	return doc, nil
}

func (m *agencyManager) libraryDocuments(scoped func(string) *gorm.DB, doc *models.AgencyDocument) error {
	hazards, err := list[models.Hazard](m, scoped(roleHazard).Order("created_at"), roleHazard)
	if err != nil {
		return err
	}
	for _, h := range hazards {
		doc.Hazards = append(doc.Hazards, models.DocumentHazard{ID: h.ID, Code: h.Code, Title: h.Title, Description: h.Description})
	}
	threats, err := list[models.Threat](m, scoped(roleThreat).Order("created_at"), roleThreat)
	if err != nil {
		return err
	}
	for _, t := range threats {
		doc.Threats = append(doc.Threats, models.DocumentThreat{ID: t.ID, Code: t.Code, Title: t.Title, Description: t.Description})
	}
	consequences, err := list[models.Consequence](m, scoped(roleConsequence).Order("created_at"), roleConsequence)
	if err != nil {
		return err
	}
	for _, c := range consequences {
		doc.Consequences = append(doc.Consequences, models.DocumentConsequence{ID: c.ID, Code: c.Code, Title: c.Title, HazardCode: c.HazardCode, Description: c.Description})
	}
	threatLinks, err := list[models.RiskThreat](m, scoped(roleRiskThreat).Order("created_at"), roleRiskThreat)
	if err != nil {
		return err
	}
	for _, l := range threatLinks {
		doc.RiskThreats = append(doc.RiskThreats, models.DocumentRiskThreat{RiskCode: l.RiskCode, ThreatCode: l.ThreatCode})
	}
	consequenceLinks, err := list[models.RiskConsequence](m, scoped(roleRiskConsequence).Order("created_at"), roleRiskConsequence)
	if err != nil {
		return err
	}
	for _, l := range consequenceLinks {
		doc.RiskConsequences = append(doc.RiskConsequences, models.DocumentRiskConsequence{RiskCode: l.RiskCode, ConsequenceCode: l.ConsequenceCode})
	}
	return nil
}

func applyDocumentToDraft(ctx context.Context, m *agencyManager, tx *gorm.DB, draftID string, doc models.AgencyDocument, now string) error {
	fail := func(err error) error { return fmt.Errorf("applyDocumentToDraft: %w", err) }

	goalIDs := make(map[string]string, len(doc.Goals))
	for _, g := range doc.Goals {
		row := models.Goal{
			ID: newID(), Code: g.Code, DraftID: draftID, Title: g.Title,
			Description: g.Description, Ordinality: g.Ordinality, CreatedAt: now, LastUpdated: now,
		}
		if err := m.copyRow(ctx, tx, roleGoal, row); err != nil {
			return fail(err)
		}
		goalIDs[g.ID] = row.ID
	}

	objectiveIDs := make(map[string]string, len(doc.Objectives))
	for _, o := range doc.Objectives {
		row := models.Objective{
			ID: newID(), Code: o.Code, DraftID: draftID, GoalID: goalIDs[o.GoalID], Title: o.Title,
			Description: o.Description, Ordinality: o.Ordinality, CreatedAt: now, LastUpdated: now,
		}
		if err := m.copyRow(ctx, tx, roleObjective, row); err != nil {
			return fail(err)
		}
		objectiveIDs[o.ID] = row.ID
	}

	workflowIDs := make(map[string]string, len(doc.Workflows))
	for _, w := range doc.Workflows {
		row := models.Workflow{
			ID: newID(), Code: w.Code, DraftID: draftID, Name: w.Name, Description: w.Description,
			Ordinality: w.Ordinality, EventFlows: w.EventFlows, OpensIn: w.OpensIn, CancelsOrder: w.CancelsOrder, CreatedAt: now, LastUpdated: now,
		}
		if err := m.copyRow(ctx, tx, roleWorkflow, row); err != nil {
			return fail(err)
		}
		workflowIDs[w.ID] = row.ID
	}

	roleIDs := make(map[string]string, len(doc.Roles))
	for _, r := range doc.Roles {
		row := models.Role{
			ID: newID(), Code: r.Code, DraftID: draftID, Name: r.Name,
			Description: r.Description, Permissions: r.Permissions, Staff: r.Staff, CreatedAt: now, LastUpdated: now,
		}
		if err := m.copyRow(ctx, tx, roleRole, row); err != nil {
			return fail(err)
		}
		roleIDs[r.ID] = row.ID
	}

	stepIDs := make(map[string]string, len(doc.WorkItems))
	for _, wi := range doc.WorkItems {
		stepIDs[wi.ID] = newID()
	}
	for _, wi := range doc.WorkItems {
		row := models.WorkItem{
			ID: stepIDs[wi.ID], Code: wi.Code, DraftID: draftID, WorkflowID: workflowIDs[wi.WorkflowID],
			Title: wi.Title, Description: wi.Description, Ordinality: wi.Ordinality, Prompt: wi.Prompt,
			Kind: wi.Kind, RoleID: remap(roleIDs, wi.RoleID), RunWorkflowID: workflowIDs[wi.RunWorkflowID],
			FormName: wi.FormName, Questions: wi.Questions, Tool: wi.Tool,
			RecipientRoleID: remap(roleIDs, wi.RecipientRoleID), SentStepID: remap(stepIDs, wi.SentStepID),
			Routes: remapRoutes(stepIDs, wi.Routes), OtherwiseStepID: remap(stepIDs, wi.OtherwiseStepID),
			TimeLimitMinutes: wi.TimeLimitMinutes, CancelWorkflowID: workflowIDs[wi.CancelWorkflowID],
			AgentRoleID: remap(roleIDs, wi.AgentRoleID), Topic: wi.Topic, OpeningLine: wi.OpeningLine,
			Prompts: wi.Prompts, Tools: wi.Tools, StartWorkflowIDs: remapAll(workflowIDs, wi.StartWorkflowIDs),
			CreatedAt: now, LastUpdated: now,
		}
		if err := m.copyRow(ctx, tx, roleWorkItem, row); err != nil {
			return fail(err)
		}
		stepIDs[wi.ID] = row.ID
	}

	for _, r := range doc.Records {
		row := models.Record{
			ID: newID(), Code: r.Code, DraftID: draftID, WorkflowID: remap(workflowIDs, r.WorkflowID),
			Name: r.Name, RoleID: remap(roleIDs, r.RoleID), ViewerRoleID: remap(roleIDs, r.ViewerRoleID),
			FormName: r.FormName, Questions: r.Questions, CreatedAt: now, LastUpdated: now,
		}
		if err := m.copyRow(ctx, tx, roleRecord, row); err != nil {
			return fail(err)
		}
	}

	for _, measure := range doc.Measures {
		row := models.Measure{
			ID: newID(), DraftID: draftID, ObjectiveID: objectiveIDs[measure.ObjectiveID], Name: measure.Name,
			Current: measure.Current, Target: measure.Target, Unit: measure.Unit, Status: measure.Status,
			CreatedAt: now, LastUpdated: now,
		}
		if err := m.copyRow(ctx, tx, roleMeasure, row); err != nil {
			return fail(err)
		}
	}

	riskIDs := make(map[string]string, len(doc.Risks))
	for _, r := range doc.Risks {
		row := models.Risk{
			ID: newID(), Code: r.Code, DraftID: draftID, Title: r.Title, TopEvent: r.TopEvent,
			Hazard: r.Hazard, HazardCode: r.HazardCode, Owner: r.Owner, CreatedAt: now, LastUpdated: now,
		}
		if err := m.copyRow(ctx, tx, roleRisk, row); err != nil {
			return fail(err)
		}
		riskIDs[r.ID] = row.ID
	}

	for _, p := range doc.RiskPathways {
		riskID, known := riskIDs[p.RiskID]
		if !known {
			continue
		}
		row := models.RiskPathway{
			ID: newID(), Code: p.Code, DraftID: draftID, RiskID: riskID, Side: p.Side, Title: p.Title,
			Scenario: p.Scenario, CreatedAt: now, LastUpdated: now,
		}
		if err := m.copyRow(ctx, tx, roleRiskPathway, row); err != nil {
			return fail(err)
		}
	}

	if err := m.applyLibraryDocuments(ctx, tx, draftID, doc, now); err != nil {
		return fail(err)
	}

	for _, link := range documentWorkflowObjectives(doc, workflowIDs, objectiveIDs) {
		row := models.WorkflowObjective{
			ID: newID(), DraftID: draftID, WorkflowID: link.workflowID, ObjectiveID: link.objectiveID,
			CreatedAt: now, LastUpdated: now,
		}
		if err := m.copyRow(ctx, tx, roleWorkflowObjective, row); err != nil {
			return fail(err)
		}
	}

	assigned := make(map[[3]string]bool, len(doc.RoleAssignments))
	for _, ra := range doc.RoleAssignments {
		stepID, stepKnown := stepIDs[ra.WorkItemID]
		roleID, roleKnown := roleIDs[ra.RoleID]
		if ra.WorkItemID == "" || !stepKnown || !roleKnown || !models.RACILabel(ra.Label).Valid() {
			continue
		}
		key := [3]string{stepID, roleID, ra.Label}
		if assigned[key] {
			continue
		}
		assigned[key] = true
		row := models.RoleAssignment{
			ID: newID(), DraftID: draftID, WorkItemID: stepID, RoleID: roleID,
			Label: models.RACILabel(ra.Label), CreatedAt: now, LastUpdated: now,
		}
		if err := m.copyRow(ctx, tx, roleRoleAssignment, row); err != nil {
			return fail(err)
		}
	}

	for _, v := range doc.Values {
		row := models.Value{
			ID: newID(), Code: v.Code, DraftID: draftID, Text: v.Text,
			CreatedAt: now, LastUpdated: now,
		}
		if err := m.copyRow(ctx, tx, roleValue, row); err != nil {
			return fail(err)
		}
	}

	for _, r := range doc.Rules {
		row := models.Rule{
			ID: newID(), Code: r.Code, DraftID: draftID, Text: r.Text,
			CreatedAt: now, LastUpdated: now,
		}
		if err := m.copyRow(ctx, tx, roleRule, row); err != nil {
			return fail(err)
		}
	}

	for _, c := range doc.Controls {
		row := models.Control{
			ID: newID(), Code: c.Code, DraftID: draftID, Text: c.Text, Action: c.Action,
			CondField: c.CondField, CondOperator: c.CondOperator, CondValue: c.CondValue,
			OnBreach: c.OnBreach, WorkflowID: remap(workflowIDs, c.WorkflowID), Severity: c.Severity,
			CreatedAt: now, LastUpdated: now,
		}
		if err := m.copyRow(ctx, tx, roleControl, row); err != nil {
			return fail(err)
		}
	}

	for _, a := range doc.ControlAttachments {
		row := models.ControlAttachment{
			ID: newID(), DraftID: draftID, ControlCode: a.ControlCode,
			TargetType: models.TargetType(a.TargetType), TargetCode: a.TargetCode, CreatedAt: now,
		}
		if err := m.copyRow(ctx, tx, roleControlAttachment, row); err != nil {
			return fail(err)
		}
	}

	catalog := make(map[string]models.ModuleCatalogEntry, len(models.ModuleCatalog))
	for _, entry := range models.ModuleCatalog {
		catalog[entry.Code] = entry
	}
	for _, mod := range doc.Modules {
		mounts, err := models.ParseModuleMounts(string(mod.Mounts))
		if err == nil {
			err = models.ValidateModuleMounts(mod.Code, mounts)
		}
		if err != nil {
			return fail(ErrInvalidModuleMounts)
		}
		entry := catalog[mod.Code]
		row := models.Module{
			ID: newID(), Code: mod.Code, DraftID: draftID, Name: entry.Name,
			Description: entry.Description, Enabled: mod.Enabled, Locked: entry.Locked, Icon: entry.Icon,
			Spec: string(mod.Spec), Settings: string(mod.Settings), Mounts: string(mod.Mounts),
			CreatedAt: now, LastUpdated: now,
		}
		if err := m.copyRow(ctx, tx, roleModule, row); err != nil {
			return fail(err)
		}
	}

	for _, step := range doc.EventFlowSteps {
		step.ID, step.DraftID, step.CreatedAt, step.LastUpdated = newID(), draftID, now, now
		if err := m.copyRow(ctx, tx, roleEventFlowStep, step); err != nil {
			return fail(err)
		}
	}
	remap := scenarioRemap{workflows: workflowIDs, roles: roleIDs, steps: stepIDs}
	return m.applyScenarioDocuments(ctx, tx, draftID, doc.Scenarios, now, remap)
}

func (m *agencyManager) applyLibraryDocuments(ctx context.Context, tx *gorm.DB, draftID string, doc models.AgencyDocument, now string) error {
	for _, h := range doc.Hazards {
		row := models.Hazard{ID: newID(), Code: h.Code, DraftID: draftID, Title: h.Title, Description: h.Description, CreatedAt: now, LastUpdated: now}
		if err := m.copyRow(ctx, tx, roleHazard, row); err != nil {
			return err
		}
	}
	for _, t := range doc.Threats {
		row := models.Threat{ID: newID(), Code: t.Code, DraftID: draftID, Title: t.Title, Description: t.Description, CreatedAt: now, LastUpdated: now}
		if err := m.copyRow(ctx, tx, roleThreat, row); err != nil {
			return err
		}
	}
	for _, c := range doc.Consequences {
		row := models.Consequence{ID: newID(), Code: c.Code, DraftID: draftID, HazardCode: c.HazardCode, Title: c.Title, Description: c.Description, CreatedAt: now, LastUpdated: now}
		if err := m.copyRow(ctx, tx, roleConsequence, row); err != nil {
			return err
		}
	}
	for _, l := range doc.RiskThreats {
		row := models.RiskThreat{ID: newID(), DraftID: draftID, RiskCode: l.RiskCode, ThreatCode: l.ThreatCode, CreatedAt: now}
		if err := m.copyRow(ctx, tx, roleRiskThreat, row); err != nil {
			return err
		}
	}
	for _, l := range doc.RiskConsequences {
		row := models.RiskConsequence{ID: newID(), DraftID: draftID, RiskCode: l.RiskCode, ConsequenceCode: l.ConsequenceCode, CreatedAt: now}
		if err := m.copyRow(ctx, tx, roleRiskConsequence, row); err != nil {
			return err
		}
	}
	return nil
}

type workflowObjectiveLink struct {
	workflowID  string
	objectiveID string
}

func documentWorkflowObjectives(doc models.AgencyDocument, workflowIDs, objectiveIDs map[string]string) []workflowObjectiveLink {
	seen := make(map[workflowObjectiveLink]bool)
	var links []workflowObjectiveLink
	add := func(documentWorkflowID, documentObjectiveID string) {
		workflowID, workflowKnown := workflowIDs[documentWorkflowID]
		objectiveID, objectiveKnown := objectiveIDs[documentObjectiveID]
		if !workflowKnown || !objectiveKnown {
			return
		}
		link := workflowObjectiveLink{workflowID: workflowID, objectiveID: objectiveID}
		if seen[link] {
			return
		}
		seen[link] = true
		links = append(links, link)
	}
	for _, wo := range doc.WorkflowObjectives {
		add(wo.WorkflowID, wo.ObjectiveID)
	}
	for _, wi := range doc.WorkItems {
		add(wi.WorkflowID, wi.LegacyObjectiveID)
	}
	return links
}
