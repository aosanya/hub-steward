package mwanachamaagency

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"

	"gorm.io/gorm"

	"wakalaserver/modules/agency/models"
	"wakalaserver/modules/shared/plaintext"
)

const agentPermission = "ai.use"

type ScenarioFilter struct {
	Name   string `query:"name"`
	Result string `query:"result"`
}

func invalidScenario(format string, args ...any) error {
	return fmt.Errorf("%w: %s", ErrInvalidScenario, fmt.Sprintf(format, args...))
}

func sameName(a, b string) bool {
	return plaintext.SameNameIgnoringCase(a, b)
}

func (m *agencyManager) requireOpenDraft(ctx context.Context, tx *gorm.DB, draftID string) error {
	if draftID == "" {
		return ErrDraftRequired
	}
	d, err := m.findDraft(ctx, tx, draftID)
	if err != nil {
		return err
	}
	if d.Status != models.DraftStatusOpen {
		return ErrDraftNotOpen
	}
	return nil
}

func (m *agencyManager) insertRow(ctx context.Context, tx *gorm.DB, role string, v any) error {
	row, err := m.encode(role, v)
	if err != nil {
		return err
	}
	return tx.WithContext(ctx).Table(m.table(role)).Create(row).Error
}

func (m *agencyManager) findScenario(ctx context.Context, tx *gorm.DB, id string) (models.Scenario, error) {
	var s models.Scenario
	if err := m.find(ctx, tx, roleScenario, id, &s, ErrScenarioNotFound); err != nil {
		return models.Scenario{}, err
	}
	return s, nil
}

func (m *agencyManager) findScenarioActor(ctx context.Context, tx *gorm.DB, id string) (models.ScenarioActor, error) {
	var a models.ScenarioActor
	if err := m.find(ctx, tx, roleScenarioActor, id, &a, ErrScenarioActorNotFound); err != nil {
		return models.ScenarioActor{}, err
	}
	return a, nil
}

func (m *agencyManager) draftRoles(ctx context.Context, tx *gorm.DB, draftID string) ([]models.Role, error) {
	return list[models.Role](m, scopeQuery(tx.WithContext(ctx).Table(m.table(roleRole)), draftID).Order("created_at"), roleRole)
}

func agentRoles(roles []models.Role) []models.Role {
	var out []models.Role
	for _, r := range roles {
		for _, p := range r.Permissions {
			if p == agentPermission {
				out = append(out, r)
				break
			}
		}
	}
	return out
}

func (m *agencyManager) builtInActors(ctx context.Context, tx *gorm.DB, draftID, scenarioID string) ([]models.ScenarioActor, error) {
	roles, err := m.draftRoles(ctx, tx, draftID)
	if err != nil {
		return nil, err
	}
	var out []models.ScenarioActor
	for _, r := range agentRoles(roles) {
		out = append(out, models.ScenarioActor{
			ID: r.ID, ScenarioID: scenarioID, DraftID: draftID, Name: r.Name,
			Kind: models.ActorKindAgent, RoleID: r.ID, RoleName: r.Name, BuiltIn: true,
		})
	}
	out = append(out, models.ScenarioActor{
		ID: "system", ScenarioID: scenarioID, DraftID: draftID, Name: models.SystemActorName,
		Kind: models.ActorKindSystem, BuiltIn: true,
	})
	return out, nil
}

func (m *agencyManager) storedActors(ctx context.Context, tx *gorm.DB, scenarioID string) ([]models.ScenarioActor, error) {
	q := tx.WithContext(ctx).Table(m.table(roleScenarioActor)).Where("scenario_id = ?", scenarioID).Order("ordinality").Order("created_at")
	return list[models.ScenarioActor](m, q, roleScenarioActor)
}

func (m *agencyManager) storedInputs(ctx context.Context, tx *gorm.DB, scenarioID string) ([]models.ScenarioInput, error) {
	q := tx.WithContext(ctx).Table(m.table(roleScenarioInput)).Where("scenario_id = ?", scenarioID).Order("created_at")
	return list[models.ScenarioInput](m, q, roleScenarioInput)
}

func (m *agencyManager) workflowSteps(ctx context.Context, tx *gorm.DB, draftID, workflowID string) ([]models.WorkItem, error) {
	q := scopeQuery(tx.WithContext(ctx).Table(m.table(roleWorkItem)), draftID).
		Where("workflow_id = ?", workflowID).Order("ordinality").Order("created_at")
	return list[models.WorkItem](m, q, roleWorkItem)
}

func (m *agencyManager) workflowRules(ctx context.Context, tx *gorm.DB, draftID string, workflow models.Workflow) ([]models.Rule, error) {
	if workflow.Code == "" {
		return nil, nil
	}
	var codes []string
	err := tx.WithContext(ctx).Table(m.table(roleRuleAttachment)).
		Where("target_type = ? AND target_code = ?", string(models.TargetTypeWorkflow), workflow.Code).
		Pluck("rule_code", &codes).Error
	if err != nil || len(codes) == 0 {
		return nil, err
	}
	q := scopeQuery(tx.WithContext(ctx).Table(m.table(roleRule)), draftID).Where("code IN ?", codes).Order("code")
	return list[models.Rule](m, q, roleRule)
}

func (m *agencyManager) workflowControls(ctx context.Context, tx *gorm.DB, draftID string, workflow models.Workflow) ([]models.Control, error) {
	if workflow.Code == "" {
		return nil, nil
	}
	var codes []string
	err := tx.WithContext(ctx).Table(m.table(roleControlAttachment)).
		Where("draft_id = ? AND target_type = ? AND target_code = ?", draftID, string(models.TargetTypeWorkflow), workflow.Code).
		Pluck("control_code", &codes).Error
	if err != nil || len(codes) == 0 {
		return nil, err
	}
	q := scopeQuery(tx.WithContext(ctx).Table(m.table(roleControl)), draftID).Where("code IN ?", codes).Order("code")
	return list[models.Control](m, q, roleControl)
}

func (m *agencyManager) scenarioView(ctx context.Context, tx *gorm.DB, s models.Scenario) (models.Scenario, error) {
	roles, err := m.draftRoles(ctx, tx, s.DraftID)
	if err != nil {
		return models.Scenario{}, err
	}
	roleNames := make(map[string]string, len(roles))
	for _, r := range roles {
		roleNames[r.ID] = r.Name
	}

	stored, err := m.storedActors(ctx, tx, s.ID)
	if err != nil {
		return models.Scenario{}, err
	}
	for i := range stored {
		stored[i].RoleName = roleNames[stored[i].RoleID]
	}
	built, err := m.builtInActors(ctx, tx, s.DraftID, s.ID)
	if err != nil {
		return models.Scenario{}, err
	}
	inputs, err := m.storedInputs(ctx, tx, s.ID)
	if err != nil {
		return models.Scenario{}, err
	}

	var workflow models.Workflow
	found := m.find(ctx, tx, roleWorkflow, s.WorkflowID, &workflow, ErrWorkflowNotFound) == nil
	var steps []models.WorkItem
	var controls []models.Control
	if found {
		if steps, err = m.workflowSteps(ctx, tx, s.DraftID, s.WorkflowID); err != nil {
			return models.Scenario{}, err
		}
		if controls, err = m.workflowControls(ctx, tx, s.DraftID, workflow); err != nil {
			return models.Scenario{}, err
		}
	}

	s.Workflow = workflow.Name
	for _, c := range controls {
		s.Rules = append(s.Rules, c.Code)
	}
	s.Actors = append(stored, built...)
	s.Inputs = inputs
	s.Blocks = scenarioBlocks(steps, s.Actors, roleNames, inputs, s.Thens)
	s.Thens = thensOf(s.Blocks)
	return s, nil
}

func thensOf(blocks []models.ScenarioBlock) []models.ScenarioThen {
	var out []models.ScenarioThen
	for _, b := range blocks {
		if b.Then != "" {
			out = append(out, models.ScenarioThen{StepID: b.StepID, Then: b.Then})
		}
	}
	return out
}

func (m *agencyManager) mergeThens(ctx context.Context, tx *gorm.DB, s models.Scenario, requested []models.ScenarioThen) ([]models.ScenarioThen, error) {
	if requested == nil {
		return s.Thens, nil
	}
	steps, err := m.workflowSteps(ctx, tx, s.DraftID, s.WorkflowID)
	if err != nil {
		return nil, err
	}
	inWorkflow := make(map[string]bool, len(steps))
	for _, step := range steps {
		inWorkflow[step.ID] = true
	}
	lines := make(map[string]string, len(s.Thens)+len(requested))
	for _, t := range s.Thens {
		lines[t.StepID] = t.Then
	}
	for _, t := range requested {
		if !inWorkflow[t.StepID] {
			return nil, invalidScenario("step %q is not a step of the workflow this scenario mirrors", t.StepID)
		}
		lines[t.StepID] = strings.TrimSpace(t.Then)
	}
	var out []models.ScenarioThen
	for _, step := range steps {
		if line := lines[step.ID]; line != "" {
			out = append(out, models.ScenarioThen{StepID: step.ID, Then: line})
		}
	}
	return out, nil
}

func scenarioBlocks(steps []models.WorkItem, actors []models.ScenarioActor, roleNames map[string]string, inputs []models.ScenarioInput, thens []models.ScenarioThen) []models.ScenarioBlock {
	fixed := make(map[string]string, len(inputs))
	for _, in := range inputs {
		fixed[in.StepID+"\x00"+in.Field] = in.Value
	}
	then := make(map[string]string, len(thens))
	for _, t := range thens {
		then[t.StepID] = t.Then
	}
	blocks := make([]models.ScenarioBlock, 0, len(steps))
	for _, step := range steps {
		block := models.ScenarioBlock{
			StepID: step.ID, Code: step.Code, Title: step.Title, Kind: step.Kind,
			Action: models.ActionOf(step.Kind, step.FormName, ""), Actor: actorFor(step, actors, roleNames),
			Then: then[step.ID], Tool: step.Tool,
		}
		for _, q := range step.Questions {
			field := models.BlockField{Prompt: q.Prompt, Free: true}
			if value, ok := fixed[step.ID+"\x00"+q.Prompt]; ok {
				field.Free, field.Value = false, value
			}
			block.Fields = append(block.Fields, field)
		}
		blocks = append(blocks, block)
	}
	return blocks
}

func actorFor(step models.WorkItem, actors []models.ScenarioActor, roleNames map[string]string) string {
	if step.RoleID == "" {
		return models.SystemActorName
	}
	for _, a := range actors {
		if a.RoleID == step.RoleID {
			return a.Name
		}
	}
	return roleNames[step.RoleID]
}

func (m *agencyManager) CreateScenario(ctx context.Context, s models.Scenario) (models.Scenario, error) {
	var out models.Scenario
	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := m.requireOpenDraft(ctx, tx, s.DraftID); err != nil {
			return err
		}
		s.Name = strings.TrimSpace(s.Name)
		if s.Name == "" {
			return invalidScenario("Scenario.Name is required")
		}
		if s.WorkflowID == "" {
			return invalidScenario("Scenario.WorkflowID is required")
		}
		var w models.Workflow
		wq := scopeQuery(tx.WithContext(ctx).Table(m.table(roleWorkflow)), s.DraftID).Where("id = ?", s.WorkflowID)
		if err := m.take(wq, roleWorkflow, &w, ErrWorkflowNotFound); err != nil {
			return err
		}

		now := models.NowRFC3339()
		row := models.Scenario{
			ID: newID(), DraftID: s.DraftID, Name: s.Name, Summary: s.Summary, WorkflowID: s.WorkflowID,
			Result: models.ScenarioNotRun, CreatedAt: now, LastUpdated: now,
		}
		thens, err := m.mergeThens(ctx, tx, row, s.Thens)
		if err != nil {
			return err
		}
		row.Thens = thens
		if err := m.insertRow(ctx, tx, roleScenario, row); err != nil {
			return err
		}
		for _, a := range s.Actors {
			if _, err := m.addActor(ctx, tx, row, a); err != nil {
				return err
			}
		}
		for _, in := range s.Inputs {
			in.ScenarioID = row.ID
			if _, err := m.writeInput(ctx, tx, row, in); err != nil {
				return err
			}
		}
		view, err := m.scenarioView(ctx, tx, row)
		out = view
		return err
	})
	if err != nil {
		return models.Scenario{}, fmt.Errorf("CreateScenario: %w", err)
	}
	return out, nil
}

func (m *agencyManager) GetScenario(ctx context.Context, id string) (models.Scenario, error) {
	s, err := m.findScenario(ctx, m.db, id)
	if err != nil {
		return models.Scenario{}, err
	}
	return m.scenarioView(ctx, m.db, s)
}

func (m *agencyManager) ListScenarios(ctx context.Context, draftID string, filter ScenarioFilter) ([]models.Scenario, error) {
	q := scopeQuery(m.q(ctx, roleScenario).Order("created_at"), draftID)
	q = likeFilter(q, "name", filter.Name)
	q = eqFilter(q, "result", filter.Result)
	found, err := list[models.Scenario](m, q, roleScenario)
	if err != nil {
		return nil, fmt.Errorf("ListScenarios: %w", err)
	}
	out := make([]models.Scenario, len(found))
	for i, s := range found {
		view, err := m.scenarioView(ctx, m.db, s)
		if err != nil {
			return nil, fmt.Errorf("ListScenarios: %w", err)
		}
		out[i] = view
	}
	return out, nil
}

func (m *agencyManager) UpdateScenario(ctx context.Context, s models.Scenario) (models.Scenario, error) {
	var out models.Scenario
	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		existing, err := m.findScenario(ctx, tx, s.ID)
		if err != nil {
			return err
		}
		if err := m.requireOpenDraft(ctx, tx, existing.DraftID); err != nil {
			return err
		}
		name := strings.TrimSpace(s.Name)
		if name == "" {
			return invalidScenario("Scenario.Name is required")
		}
		if s.WorkflowID != "" && s.WorkflowID != existing.WorkflowID {
			return invalidScenario("a scenario mirrors one workflow; write a new scenario for another")
		}
		thens, err := m.mergeThens(ctx, tx, existing, s.Thens)
		if err != nil {
			return err
		}
		set, err := m.planScenarioSet(ctx, tx, existing, s)
		if err != nil {
			return err
		}
		existing.Name, existing.Summary, existing.Thens = name, s.Summary, thens
		existing.Result = models.ScenarioNotRun
		existing.LastUpdated = models.NowRFC3339()
		if err := m.writeUpdate(ctx, tx, roleScenario, existing.ID, existing, ErrScenarioNotFound, "draft_id"); err != nil {
			return err
		}
		if err := m.applyScenarioSet(ctx, tx, existing, set); err != nil {
			return err
		}
		view, err := m.scenarioView(ctx, tx, existing)
		out = view
		return err
	})
	if err != nil {
		return models.Scenario{}, fmt.Errorf("UpdateScenario: %w", err)
	}
	return out, nil
}

func (m *agencyManager) DeleteScenario(ctx context.Context, id string) error {
	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		existing, err := m.findScenario(ctx, tx, id)
		if err != nil {
			return err
		}
		if err := m.requireOpenDraft(ctx, tx, existing.DraftID); err != nil {
			return err
		}
		for _, role := range []string{roleScenarioActor, roleScenarioInput, roleTestRun} {
			if err := m.deleteWhere(ctx, tx, role, "scenario_id = ?", id); err != nil {
				return err
			}
		}
		return m.deleteWhere(ctx, tx, roleScenario, "id = ?", id)
	})
	if err != nil {
		return fmt.Errorf("DeleteScenario: %w", err)
	}
	return nil
}

func (m *agencyManager) resetScenario(ctx context.Context, tx *gorm.DB, id string) error {
	return tx.WithContext(ctx).Table(m.table(roleScenario)).Where("id = ?", id).
		Updates(map[string]any{"result": string(models.ScenarioNotRun), "last_updated": models.NowRFC3339()}).Error
}

func (m *agencyManager) checkActorName(ctx context.Context, tx *gorm.DB, s models.Scenario, name, exceptID string) error {
	if strings.TrimSpace(name) == "" {
		return invalidScenario("an actor needs a name")
	}
	if problem := plaintext.Problem("scenario actor name", name); problem != "" {
		return invalidScenario("%s", problem)
	}
	stored, err := m.storedActors(ctx, tx, s.ID)
	if err != nil {
		return err
	}
	built, err := m.builtInActors(ctx, tx, s.DraftID, s.ID)
	if err != nil {
		return err
	}
	for _, a := range append(stored, built...) {
		if a.ID != exceptID && sameName(a.Name, name) {
			return fmt.Errorf("%w: %q is already an actor of this scenario", ErrDuplicateScenarioActor, strings.TrimSpace(name))
		}
	}
	return nil
}

func (m *agencyManager) addActor(ctx context.Context, tx *gorm.DB, s models.Scenario, a models.ScenarioActor) (models.ScenarioActor, error) {
	if a.Kind != "" && a.Kind != models.ActorKindRole {
		return models.ScenarioActor{}, invalidScenario("the agents and the System are built in; an actor you add holds a role")
	}
	if a.RoleID == "" {
		return models.ScenarioActor{}, invalidScenario("an actor holds an agency role")
	}
	if err := m.checkActorName(ctx, tx, s, a.Name, ""); err != nil {
		return models.ScenarioActor{}, err
	}
	var r models.Role
	rq := scopeQuery(tx.WithContext(ctx).Table(m.table(roleRole)), s.DraftID).Where("id = ?", a.RoleID)
	if err := m.take(rq, roleRole, &r, ErrRoleNotFound); err != nil {
		return models.ScenarioActor{}, err
	}
	var held int64
	if err := tx.WithContext(ctx).Table(m.table(roleScenarioActor)).Where("scenario_id = ?", s.ID).Count(&held).Error; err != nil {
		return models.ScenarioActor{}, err
	}
	now := models.NowRFC3339()
	row := models.ScenarioActor{
		ID: newID(), ScenarioID: s.ID, DraftID: s.DraftID, Name: strings.TrimSpace(a.Name),
		Kind: models.ActorKindRole, RoleID: r.ID, Ordinality: int(held) + 1, CreatedAt: now, LastUpdated: now,
	}
	if err := m.insertRow(ctx, tx, roleScenarioActor, row); err != nil {
		return models.ScenarioActor{}, err
	}
	row.RoleName = r.Name
	return row, nil
}

func (m *agencyManager) AddScenarioActor(ctx context.Context, a models.ScenarioActor) (models.ScenarioActor, error) {
	var out models.ScenarioActor
	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		s, err := m.findScenario(ctx, tx, a.ScenarioID)
		if err != nil {
			return err
		}
		if err := m.requireOpenDraft(ctx, tx, s.DraftID); err != nil {
			return err
		}
		added, err := m.addActor(ctx, tx, s, a)
		if err != nil {
			return err
		}
		out = added
		return m.resetScenario(ctx, tx, s.ID)
	})
	if err != nil {
		return models.ScenarioActor{}, fmt.Errorf("AddScenarioActor: %w", err)
	}
	return out, nil
}

func (m *agencyManager) RenameScenarioActor(ctx context.Context, id, name string) (models.ScenarioActor, error) {
	var out models.ScenarioActor
	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		a, err := m.findScenarioActor(ctx, tx, id)
		if err != nil {
			return err
		}
		s, err := m.findScenario(ctx, tx, a.ScenarioID)
		if err != nil {
			return err
		}
		if err := m.requireOpenDraft(ctx, tx, s.DraftID); err != nil {
			return err
		}
		if err := m.checkActorName(ctx, tx, s, name, a.ID); err != nil {
			return err
		}
		a.Name, a.LastUpdated = strings.TrimSpace(name), models.NowRFC3339()
		if err := m.writeUpdate(ctx, tx, roleScenarioActor, a.ID, a, ErrScenarioActorNotFound); err != nil {
			return err
		}
		out = a
		return m.resetScenario(ctx, tx, s.ID)
	})
	if err != nil {
		return models.ScenarioActor{}, fmt.Errorf("RenameScenarioActor: %w", err)
	}
	return out, nil
}

func (m *agencyManager) RemoveScenarioActor(ctx context.Context, id string) error {
	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		a, err := m.findScenarioActor(ctx, tx, id)
		if err != nil {
			return err
		}
		s, err := m.findScenario(ctx, tx, a.ScenarioID)
		if err != nil {
			return err
		}
		if err := m.requireOpenDraft(ctx, tx, s.DraftID); err != nil {
			return err
		}
		if err := m.deleteWhere(ctx, tx, roleScenarioActor, "id = ?", id); err != nil {
			return err
		}
		return m.resetScenario(ctx, tx, s.ID)
	})
	if err != nil {
		return fmt.Errorf("RemoveScenarioActor: %w", err)
	}
	return nil
}

func (m *agencyManager) checkInput(ctx context.Context, tx *gorm.DB, s models.Scenario, in models.ScenarioInput) error {
	if in.StepID == "" || strings.TrimSpace(in.Field) == "" {
		return invalidScenario("an input names a step and a field of its form")
	}
	var step models.WorkItem
	sq := scopeQuery(tx.WithContext(ctx).Table(m.table(roleWorkItem)), s.DraftID).Where("id = ?", in.StepID)
	if err := m.take(sq, roleWorkItem, &step, ErrWorkItemNotFound); err != nil {
		if errors.Is(err, ErrWorkItemNotFound) {
			return invalidScenario("step %s is not in this draft", in.StepID)
		}
		return err
	}
	if step.WorkflowID != s.WorkflowID {
		return invalidScenario("step %q is not a step of the workflow this scenario mirrors", step.Title)
	}
	for _, q := range step.Questions {
		if q.Prompt == in.Field {
			return nil
		}
	}
	return invalidScenario("step %q asks no question %q", step.Title, in.Field)
}

func (m *agencyManager) writeInput(ctx context.Context, tx *gorm.DB, s models.Scenario, in models.ScenarioInput) (models.ScenarioInput, error) {
	if err := m.checkInput(ctx, tx, s, in); err != nil {
		return models.ScenarioInput{}, err
	}

	where := "scenario_id = ? AND step_id = ? AND field = ?"
	held, err := list[models.ScenarioInput](m, tx.WithContext(ctx).Table(m.table(roleScenarioInput)).Where(where, s.ID, in.StepID, in.Field), roleScenarioInput)
	if err != nil {
		return models.ScenarioInput{}, err
	}
	now := models.NowRFC3339()
	if in.Value == "" {
		if err := m.deleteWhere(ctx, tx, roleScenarioInput, where, s.ID, in.StepID, in.Field); err != nil {
			return models.ScenarioInput{}, err
		}
		return models.ScenarioInput{ScenarioID: s.ID, DraftID: s.DraftID, StepID: in.StepID, Field: in.Field}, nil
	}
	if len(held) > 0 {
		row := held[0]
		if row.Value == in.Value {
			return row, nil
		}
		row.Value, row.LastUpdated = in.Value, now
		if err := m.writeUpdate(ctx, tx, roleScenarioInput, row.ID, row, ErrScenarioNotFound); err != nil {
			return models.ScenarioInput{}, err
		}
		return row, nil
	}
	row := models.ScenarioInput{
		ID: newID(), ScenarioID: s.ID, DraftID: s.DraftID, StepID: in.StepID, Field: in.Field,
		Value: in.Value, CreatedAt: now, LastUpdated: now,
	}
	if err := m.insertRow(ctx, tx, roleScenarioInput, row); err != nil {
		return models.ScenarioInput{}, err
	}
	return row, nil
}

func (m *agencyManager) SetScenarioInput(ctx context.Context, in models.ScenarioInput) (models.ScenarioInput, error) {
	var out models.ScenarioInput
	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		s, err := m.findScenario(ctx, tx, in.ScenarioID)
		if err != nil {
			return err
		}
		if err := m.requireOpenDraft(ctx, tx, s.DraftID); err != nil {
			return err
		}
		written, err := m.writeInput(ctx, tx, s, in)
		if err != nil {
			return err
		}
		out = written
		return m.resetScenario(ctx, tx, s.ID)
	})
	if err != nil {
		return models.ScenarioInput{}, fmt.Errorf("SetScenarioInput: %w", err)
	}
	return out, nil
}

func sortedKeys(set map[string]bool) []string {
	out := make([]string, 0, len(set))
	for k := range set {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}
