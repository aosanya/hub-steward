package http

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
	"wakalaserver/internal/approvals"
	"wakalaserver/internal/languages"
	mwanachamaactor "wakalaserver/modules/actor"
	actorroutes "wakalaserver/modules/actor/routes"
	mwanachamaagency "wakalaserver/modules/agency"
	"wakalaserver/modules/agency/models"
	mwanachamamarket "wakalaserver/modules/market"
	riskmodels "wakalaserver/modules/riskmanager/models"
	mwanachamasources "wakalaserver/modules/sources"
)

var ErrApplyFailed = errors.New("the approved write could not be carried out")

type approvalApplier func(ctx context.Context, reg agencies.Registry, instanceID, payload string) error

var approvalAppliers = map[string]approvalApplier{
	"agency_create_goal":      applyCreateGoal,
	"agency_create_objective": applyCreateObjective,
	"agency_create_role":      applyCreateRole,
	"agency_update_role":      applyUpdateRole,
	"agency_delete_role":      applyDeleteRole,
	"agency_update_scenario":  applyUpdateScenario,
	"agency_delete_scenario":  applyDeleteScenario,
	"agency_delete_workflow":  applyDeleteWorkflow,
	"agency_update_agency":    applyUpdateAgency,
	"instance_set_join_mode":  applySetJoinMode,
	"instance_rename":         applyRenameInstance,

	"actor_set_group_join_mode": applySetGroupJoinMode,
	"actor_invite_to_group":     applyInviteToGroup,
	"actor_create_group":        applyCreateGroup,
	"sources_document_create":   applyCreateDocument,
	"market_regroup_offer":      applyRegroupOffer,
	"market_ask":                applyAsk,
	"market_approve_poster":     applyApprovePoster,
	"market_decline_poster":     applyDeclinePoster,

	"riskmanager_create_risk":        applyCreateRisk,
	"riskmanager_create_threat":      applyCreatePathway(riskmodels.SideThreat),
	"riskmanager_create_consequence": applyCreatePathway(riskmodels.SideConsequence),
}

const setLanguagesKind = "instance_set_languages"

type applyEnv struct {
	languages func() *languages.Store
	announce  marketAnnouncer
}

type marketAnnouncer func(m mwanachamamarket.MarketManager, instanceID string) mwanachamamarket.MarketManager

type marketAnnouncerKey struct{}

func (d *Deps) applyEnv() applyEnv {
	return applyEnv{languages: func() *languages.Store { return d.Languages }, announce: d.marketAnnounced}
}

func applyApproved(ctx context.Context, reg agencies.Registry, env applyEnv, instanceID string, st *approvals.Store, a approvals.Approval) (approvals.Approval, error) {
	apply, known := approvalAppliers[a.Kind]
	if a.Kind == setLanguagesKind {
		known = true
		apply = func(ctx context.Context, reg agencies.Registry, instanceID, payload string) error {
			return applySetLanguages(ctx, reg, env.languages(), instanceID, payload)
		}
	}
	if !known {
		return a, nil
	}
	steps := &appliedSteps{}
	ctx = context.WithValue(ctx, appliedStepsKey{}, steps)
	ctx = context.WithValue(ctx, marketAnnouncerKey{}, env.announce)
	err := apply(ctx, reg, instanceID, a.Payload)
	settled := context.WithoutCancel(ctx)
	if err != nil {
		if reopenErr := st.Reopen(settled, a); reopenErr != nil {
			return approvals.Approval{}, errors.Join(ErrApplyFailed, shownToOwner(err), shownToOwner(reopenErr))
		}
		return approvals.Approval{}, fmt.Errorf("%w: %v", ErrApplyFailed, shownToOwner(err))
	}
	return st.RecordApplied(settled, a.ID, a.DecidedBy, steps.orDefault(a.Kind))
}

type appliedStepsKey struct{}

type appliedSteps struct{ taken []string }

func (s *appliedSteps) orDefault(kind string) []string {
	if len(s.taken) == 0 {
		return []string{"Carried out " + kind}
	}
	return s.taken
}

func noteStep(ctx context.Context, format string, args ...any) {
	if steps, ok := ctx.Value(appliedStepsKey{}).(*appliedSteps); ok {
		steps.taken = append(steps.taken, fmt.Sprintf(format, args...))
	}
}

func decodePayload(payload string, into any) error {
	if payload == "" {
		return errors.New("the proposal carries no payload")
	}
	var text string
	if json.Unmarshal([]byte(payload), &text) == nil {
		payload = text
	}
	return json.Unmarshal([]byte(payload), into)
}

func workingDraftID(ctx context.Context, m mwanachamaagency.AgencyManager) (string, error) {
	drafts, err := m.ListDrafts(ctx, mwanachamaagency.DraftFilter{Status: string(models.DraftStatusOpen)})
	if err != nil {
		return "", err
	}
	if working, found := agencies.WorkingDraft(drafts); found {
		return working.ID, nil
	}
	d, err := m.CreateDraft(ctx, "Approved proposals", "", "")
	if err != nil {
		return "", err
	}
	return d.ID, nil
}

type titledPayload struct {
	GoalID      string `json:"goal_id"`
	Title       string `json:"title"`
	Description string `json:"description"`
}

func applyCreateGoal(ctx context.Context, reg agencies.Registry, instanceID, payload string) error {
	var p titledPayload
	if err := decodePayload(payload, &p); err != nil {
		return err
	}
	m, err := agencyManagerFor(ctx, reg, instanceID)
	if err != nil {
		return err
	}
	draftID, err := workingDraftID(ctx, m)
	if err != nil {
		return err
	}
	if _, err = m.CreateGoal(ctx, models.Goal{DraftID: draftID, Title: p.Title, Description: p.Description}); err != nil {
		return err
	}
	noteStep(ctx, "Created the goal %q in the open draft", p.Title)
	return nil
}

func applyCreateObjective(ctx context.Context, reg agencies.Registry, instanceID, payload string) error {
	var p objectivePayload
	if err := decodePayload(payload, &p); err != nil {
		return err
	}
	m, err := agencyManagerFor(ctx, reg, instanceID)
	if err != nil {
		return err
	}
	draftID, err := workingDraftID(ctx, m)
	if err != nil {
		return err
	}
	workflowID := p.workflowToLink()
	if err = requireWorkflowInDraft(ctx, m, draftID, workflowID); err != nil {
		return err
	}
	measure := p.measureToSet()
	if err = requireMeasureEntryComplete(measure); err != nil {
		return err
	}
	objective, err := m.CreateObjective(ctx, models.Objective{DraftID: draftID, GoalID: p.GoalID, Title: p.Title, Description: p.Description})
	if err != nil {
		return err
	}
	noteStep(ctx, "Created the objective %q in the open draft", p.Title)
	if err = linkObjectiveToWorkflow(ctx, m, draftID, objective, workflowID); err != nil {
		return err
	}
	return setObjectiveMeasure(ctx, m, objective, measure)
}

func applyCreateRole(ctx context.Context, reg agencies.Registry, instanceID, payload string) error {
	var p struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}
	if err := decodePayload(payload, &p); err != nil {
		return err
	}
	m, err := agencyManagerFor(ctx, reg, instanceID)
	if err != nil {
		return err
	}
	draftID, err := workingDraftID(ctx, m)
	if err != nil {
		return err
	}
	if _, err = m.CreateRole(ctx, models.Role{DraftID: draftID, Name: p.Name, Description: p.Description}); err != nil {
		return err
	}
	noteStep(ctx, "Created the role %q in the open draft", p.Name)
	return nil
}

func workingRole(ctx context.Context, m mwanachamaagency.AgencyManager, roleID string) (models.Role, error) {
	if strings.TrimSpace(roleID) == "" {
		return models.Role{}, errors.New("name the role by role_id")
	}
	draftID, err := workingDraftID(ctx, m)
	if err != nil {
		return models.Role{}, err
	}
	role, err := m.GetRole(ctx, roleID)
	if err != nil {
		return models.Role{}, err
	}
	if role.DraftID != draftID {
		return models.Role{}, fmt.Errorf("the role %q is not in the open draft", roleID)
	}
	return role, nil
}

func applyUpdateRole(ctx context.Context, reg agencies.Registry, instanceID, payload string) error {
	var p struct {
		RoleID      string  `json:"role_id"`
		Name        string  `json:"name"`
		Description *string `json:"description"`
	}
	if err := decodePayload(payload, &p); err != nil {
		return err
	}
	m, err := agencyManagerFor(ctx, reg, instanceID)
	if err != nil {
		return err
	}
	role, err := workingRole(ctx, m, p.RoleID)
	if err != nil {
		return err
	}
	role.Name = p.Name
	if p.Description != nil {
		role.Description = *p.Description
	}
	_, err = m.UpdateRole(ctx, role)
	return err
}

func applyDeleteRole(ctx context.Context, reg agencies.Registry, instanceID, payload string) error {
	var p struct {
		RoleID string `json:"role_id"`
	}
	if err := decodePayload(payload, &p); err != nil {
		return err
	}
	m, err := agencyManagerFor(ctx, reg, instanceID)
	if err != nil {
		return err
	}
	if _, err := workingRole(ctx, m, p.RoleID); err != nil {
		return err
	}
	return m.DeleteRole(ctx, p.RoleID)
}

func workingScenario(ctx context.Context, m mwanachamaagency.AgencyManager, scenarioID string) (models.Scenario, error) {
	if strings.TrimSpace(scenarioID) == "" {
		return models.Scenario{}, errors.New("name the scenario by scenario_id")
	}
	draftID, err := workingDraftID(ctx, m)
	if err != nil {
		return models.Scenario{}, err
	}
	scenario, err := m.GetScenario(ctx, scenarioID)
	if err != nil {
		return models.Scenario{}, err
	}
	if scenario.DraftID != draftID {
		return models.Scenario{}, fmt.Errorf("the scenario %q is not in the open draft", scenarioID)
	}
	return scenario, nil
}

func applyUpdateScenario(ctx context.Context, reg agencies.Registry, instanceID, payload string) error {
	var p struct {
		ScenarioID string                 `json:"scenario_id"`
		Name       string                 `json:"name"`
		Summary    *string                `json:"summary"`
		WorkflowID string                 `json:"workflow_id"`
		Thens      []models.ScenarioThen  `json:"thens"`
		Actors     []models.ScenarioActor `json:"actors"`
		Inputs     []models.ScenarioInput `json:"inputs"`
	}
	if err := decodePayload(payload, &p); err != nil {
		return err
	}
	m, err := agencyManagerFor(ctx, reg, instanceID)
	if err != nil {
		return err
	}
	scenario, err := workingScenario(ctx, m, p.ScenarioID)
	if err != nil {
		return err
	}
	scenario.Name = p.Name
	if p.Summary != nil {
		scenario.Summary = *p.Summary
	}
	scenario.WorkflowID = p.WorkflowID
	scenario.Thens = p.Thens
	scenario.Actors = p.Actors
	scenario.Inputs = p.Inputs
	_, err = m.UpdateScenario(ctx, scenario)
	return err
}

func applyDeleteScenario(ctx context.Context, reg agencies.Registry, instanceID, payload string) error {
	var p struct {
		ScenarioID string `json:"scenario_id"`
	}
	if err := decodePayload(payload, &p); err != nil {
		return err
	}
	m, err := agencyManagerFor(ctx, reg, instanceID)
	if err != nil {
		return err
	}
	if _, err := workingScenario(ctx, m, p.ScenarioID); err != nil {
		return err
	}
	return m.DeleteScenario(ctx, p.ScenarioID)
}

func applyDeleteWorkflow(ctx context.Context, reg agencies.Registry, instanceID, payload string) error {
	var p struct {
		WorkflowID string `json:"workflow_id"`
	}
	if err := decodePayload(payload, &p); err != nil {
		return err
	}
	if strings.TrimSpace(p.WorkflowID) == "" {
		return errors.New("name the workflow by workflow_id")
	}
	m, err := agencyManagerFor(ctx, reg, instanceID)
	if err != nil {
		return err
	}
	draftID, err := workingDraftID(ctx, m)
	if err != nil {
		return err
	}
	workflow, err := m.GetWorkflow(ctx, p.WorkflowID)
	if err != nil {
		return err
	}
	if workflow.DraftID != draftID {
		return fmt.Errorf("the workflow %q is not in the open draft", p.WorkflowID)
	}
	return m.DeleteWorkflow(ctx, p.WorkflowID)
}

func applyUpdateAgency(ctx context.Context, reg agencies.Registry, instanceID, payload string) error {
	var p struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}
	if err := decodePayload(payload, &p); err != nil {
		return err
	}
	m, err := agencyManagerFor(ctx, reg, instanceID)
	if err != nil {
		return err
	}
	current, err := m.GetAgency(ctx)
	if err != nil {
		return err
	}
	current.Name = p.Name
	current.Description = p.Description
	_, err = m.UpdateAgency(ctx, current)
	return err
}

func applySetJoinMode(ctx context.Context, reg agencies.Registry, instanceID, payload string) error {
	var p struct {
		JoinMode string `json:"join_mode"`
	}
	if err := decodePayload(payload, &p); err != nil {
		return err
	}
	_, err := reg.SetJoinMode(ctx, instanceID, p.JoinMode)
	return err
}

func applyRenameInstance(ctx context.Context, reg agencies.Registry, instanceID, payload string) error {
	var p struct {
		Name string `json:"name"`
	}
	if err := decodePayload(payload, &p); err != nil {
		return err
	}
	_, err := reg.RenameInstance(ctx, instanceID, p.Name)
	return err
}

func applySetLanguages(ctx context.Context, reg agencies.Registry, store *languages.Store, instanceID, payload string) error {
	var p struct {
		StudioDefault  string   `json:"studio_default"`
		Content        []string `json:"content"`
		ContentDefault string   `json:"content_default"`
	}
	if err := decodePayload(payload, &p); err != nil {
		return err
	}
	_, err := putLanguagesAsOwner(ctx, reg, store, instanceID, languages.Agency{StudioDefault: p.StudioDefault, Content: p.Content, ContentDefault: p.ContentDefault})
	return err
}

func applySetGroupJoinMode(ctx context.Context, reg agencies.Registry, instanceID, payload string) error {
	var p struct {
		GroupID  string `json:"group_id"`
		JoinMode string `json:"join_mode"`
	}
	if err := decodePayload(payload, &p); err != nil {
		return err
	}
	um, _, err := actorManagerFor(ctx, reg, instanceID)
	if err != nil {
		return err
	}
	_, err = um.SetGroupJoinMode(ctx, p.GroupID, p.JoinMode)
	return err
}

func applyCreateGroup(ctx context.Context, reg agencies.Registry, instanceID, payload string) error {
	var arguments map[string]json.RawMessage
	if err := decodePayload(payload, &arguments); err != nil {
		return err
	}
	um, _, err := actorManagerFor(ctx, reg, instanceID)
	if err != nil {
		return err
	}
	tools, err := actorroutes.BuildToolsFor(um, checkedActorMount())
	if err != nil {
		return err
	}
	created, err := invokeNamed(ctx, tools, "actor_create_group", arguments)
	if err != nil {
		return err
	}
	if group, ok := created.(mwanachamaactor.Group); ok {
		noteStep(ctx, "Created the group %q", group.Name)
	}
	return nil
}

func applyInviteToGroup(ctx context.Context, reg agencies.Registry, instanceID, payload string) error {
	var p struct {
		GroupID   string `json:"group_id"`
		ActorID   string `json:"actor_id"`
		ActorCode string `json:"actor_code"`
	}
	if err := decodePayload(payload, &p); err != nil {
		return err
	}
	if (strings.TrimSpace(p.ActorID) == "") == (strings.TrimSpace(p.ActorCode) == "") {
		return errors.New("name the invitee by actor_id or by actor_code, exactly one of them")
	}
	um, _, err := actorManagerFor(ctx, reg, instanceID)
	if err != nil {
		return err
	}
	_, err = um.InviteToGroup(ctx, p.GroupID, p.ActorID, p.ActorCode, accounts.IDFromContext(ctx), "")
	return err
}

func applyCreateDocument(ctx context.Context, reg agencies.Registry, instanceID, payload string) error {
	var p struct {
		Title    string `json:"title"`
		Language string `json:"language"`
		Text     string `json:"text"`
	}
	if err := decodePayload(payload, &p); err != nil {
		return err
	}
	if p.Title == "" || p.Text == "" {
		return errors.New("a document needs a title and text")
	}
	sm, err := sourceManagerFor(ctx, reg, instanceID)
	if err != nil {
		return err
	}
	source := mwanachamasources.Source{Title: p.Title, Kind: "document", CreatedBy: accounts.IDFromContext(ctx)}
	if p.Language != "" {
		source.Properties = map[string]any{"language": p.Language}
	}
	created, err := sm.CreateSource(ctx, source)
	if err != nil {
		return err
	}
	noteStep(ctx, "Filed the source %q", created.Title)
	if _, err := sm.AddDocument(ctx, mwanachamasources.Document{SourceID: created.ID, Text: p.Text}); err != nil {
		if removeErr := sm.DeleteSource(ctx, created.ID); removeErr != nil {
			return errors.Join(shownToOwner(err), fmt.Errorf("the source %q was left behind: %w", created.ID, shownToOwner(removeErr)))
		}
		return err
	}
	noteStep(ctx, "Added the text of %q to the source", created.Title)
	return nil
}
