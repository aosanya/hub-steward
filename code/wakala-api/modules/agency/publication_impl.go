package mwanachamaagency

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"sort"
	"strings"

	"gorm.io/gorm"

	"wakalaserver/modules/agency/models"
)

const publicationSummaryColumns = "id, draft_id, content_hash, version, tag, channel, published_at, last_updated"

func toPublicationRow(p models.AgencyPublication) publication {
	document, err := json.Marshal(p.Document)
	if err != nil {
		document = []byte("{}")
	}
	return publication{
		ID:          p.ID,
		DraftID:     p.DraftID,
		ContentHash: p.ContentHash,
		Version:     p.Version,
		Tag:         p.Tag,
		Channel:     p.Channel,
		Document:    string(document),
		PublishedAt: p.PublishedAt,
		LastUpdated: p.LastUpdated,
	}
}

func fromPublicationRow(r publication) models.AgencyPublication {
	var document models.AgencyDocument
	if r.Document != "" {
		_ = json.Unmarshal([]byte(r.Document), &document)
	}
	return models.AgencyPublication{
		ID:          r.ID,
		DraftID:     r.DraftID,
		ContentHash: r.ContentHash,
		Version:     r.Version,
		Tag:         r.Tag,
		Channel:     r.Channel,
		Document:    document,
		PublishedAt: r.PublishedAt,
		LastUpdated: r.LastUpdated,
	}
}

func (m *agencyManager) contentHashFor(ctx context.Context, tx *gorm.DB, draftID string) (string, error) {
	scoped := func(role string) *gorm.DB {
		return scopeQuery(tx.WithContext(ctx).Table(m.table(role)), draftID)
	}

	var records []string

	goals, err := list[models.Goal](m, scoped(roleGoal), roleGoal)
	if err != nil {
		return "", fmt.Errorf("contentHashFor: %w", err)
	}
	for _, r := range goals {
		records = append(records, hashRecord("Goal", map[string]any{
			"id": r.ID, "title": r.Title, "description": r.Description,
			"ordinality": r.Ordinality, "deleted": r.Deleted,
		}))
	}

	objectives, err := list[models.Objective](m, scoped(roleObjective), roleObjective)
	if err != nil {
		return "", fmt.Errorf("contentHashFor: %w", err)
	}
	for _, r := range objectives {
		records = append(records, hashRecord("Objective", map[string]any{
			"id": r.ID, "goal_id": r.GoalID, "title": r.Title, "description": r.Description,
			"ordinality": r.Ordinality, "deleted": r.Deleted,
		}))
	}

	workflows, err := list[models.Workflow](m, scoped(roleWorkflow), roleWorkflow)
	if err != nil {
		return "", fmt.Errorf("contentHashFor: %w", err)
	}
	for _, r := range workflows {
		records = append(records, hashRecord("Workflow", map[string]any{
			"id": r.ID, "name": r.Name, "description": r.Description,
			"ordinality": r.Ordinality, "event_flows": r.EventFlows, "deleted": r.Deleted,
		}, optionalField{"opens_in", string(r.OpensIn)}, optionalField{"cancels_order", trueText(r.CancelsOrder)}))
	}

	workflowObjectives, err := list[models.WorkflowObjective](m, scoped(roleWorkflowObjective), roleWorkflowObjective)
	if err != nil {
		return "", fmt.Errorf("contentHashFor: %w", err)
	}
	for _, r := range workflowObjectives {
		records = append(records, hashRecord("WorkflowObjective", map[string]any{
			"id": r.ID, "workflow_id": r.WorkflowID, "objective_id": r.ObjectiveID, "deleted": r.Deleted,
		}))
	}

	workItems, err := list[models.WorkItem](m, scoped(roleWorkItem), roleWorkItem)
	if err != nil {
		return "", fmt.Errorf("contentHashFor: %w", err)
	}
	for _, r := range workItems {
		records = append(records, hashRecord("WorkItem", map[string]any{
			"id": r.ID, "workflow_id": r.WorkflowID,
			"title": r.Title, "description": r.Description, "ordinality": r.Ordinality,
			"prompt": r.Prompt, "deleted": r.Deleted,
		}))
		if r.Kind != "" || r.HasLinks() {
			records = append(records, hashRecord("WorkItemStep", map[string]any{
				"id": r.ID, "kind": r.Kind, "role_id": r.RoleID, "run_workflow_id": r.RunWorkflowID,
				"form_name": r.FormName, "questions": r.Questions, "tool": r.Tool, "recipient_role_id": r.RecipientRoleID,
				"sent_step_id": r.SentStepID, "routes": r.Routes, "otherwise_step_id": r.OtherwiseStepID,
			}, optionalField{"agent_role_id", r.AgentRoleID}, optionalField{"topic", r.Topic},
				optionalField{"opening_line", r.OpeningLine}, optionalField{"prompts", hashList(r.Prompts)},
				optionalField{"tools", hashList(r.Tools)}, optionalField{"start_workflow_ids", hashList(r.StartWorkflowIDs)}))
		}
		if r.TimeLimitMinutes != 0 || r.CancelWorkflowID != "" {
			records = append(records, hashRecord("WorkItemLimit", map[string]any{
				"id": r.ID, "time_limit_minutes": r.TimeLimitMinutes, "cancel_workflow_id": r.CancelWorkflowID,
			}))
		}
	}

	draftRecords, err := list[models.Record](m, scoped(roleRecord), roleRecord)
	if err != nil {
		return "", fmt.Errorf("contentHashFor: %w", err)
	}
	for _, r := range draftRecords {
		records = append(records, hashRecord("Record", map[string]any{
			"id": r.ID, "workflow_id": r.WorkflowID, "name": r.Name, "role_id": r.RoleID,
			"form_name": r.FormName, "questions": r.Questions, "deleted": r.Deleted,
		}, optionalField{"viewer_role_id", r.ViewerRoleID}))
	}

	steps, err := list[models.EventFlowStep](m, scoped(roleEventFlowStep), roleEventFlowStep)
	if err != nil {
		return "", fmt.Errorf("contentHashFor: %w", err)
	}
	for _, r := range steps {
		records = append(records, hashRecord("EventFlowStep", map[string]any{
			"id": r.ID, "code": r.Code, "workflow_code": r.WorkflowCode, "step": r.Step,
			"name": r.Name, "description": r.Description, "step_type": r.StepType,
			"trigger_topic": r.TriggerTopic, "trigger_publisher": r.TriggerPublisher,
			"consumer": r.Consumer, "handler_code": r.HandlerCode,
			"emits_topics": r.EmitsTopics, "on_error_emits_topics": r.OnErrorEmitsTopics,
			"ordinality": r.Ordinality, "deleted": r.Deleted,
		}))
	}

	roles, err := list[models.Role](m, scoped(roleRole), roleRole)
	if err != nil {
		return "", fmt.Errorf("contentHashFor: %w", err)
	}
	for _, r := range roles {
		records = append(records, hashRecord("Role", map[string]any{
			"id": r.ID, "name": r.Name, "description": r.Description, "deleted": r.Deleted,
		}))
	}

	modules, err := list[models.Module](m, scoped(roleModule), roleModule)
	if err != nil {
		return "", fmt.Errorf("contentHashFor: %w", err)
	}
	for _, r := range modules {
		fields := map[string]any{
			"id": r.ID, "code": r.Code, "name": r.Name, "description": r.Description,
			"enabled": r.Enabled, "spec": r.Spec, "settings": r.Settings, "deleted": r.Deleted,
		}
		if r.Mounts != "" {
			fields["mounts"] = r.Mounts
		}
		records = append(records, hashRecord("Module", fields))
	}

	measures, err := list[models.Measure](m, scoped(roleMeasure), roleMeasure)
	if err != nil {
		return "", fmt.Errorf("contentHashFor: %w", err)
	}
	for _, r := range measures {
		records = append(records, hashRecord("Measure", map[string]any{
			"id": r.ID, "objective_id": r.ObjectiveID, "name": r.Name, "current": r.Current,
			"target": r.Target, "unit": r.Unit, "status": r.Status, "deleted": r.Deleted,
		}))
	}

	risks, err := list[models.Risk](m, scoped(roleRisk), roleRisk)
	if err != nil {
		return "", fmt.Errorf("contentHashFor: %w", err)
	}
	for _, r := range risks {
		records = append(records, hashRecord("Risk", map[string]any{
			"id": r.ID, "title": r.Title, "top_event": r.TopEvent, "hazard": r.Hazard,
			"owner": r.Owner, "deleted": r.Deleted,
		}, optionalField{"hazard_code", r.HazardCode}))
	}

	pathways, err := list[models.RiskPathway](m, scoped(roleRiskPathway), roleRiskPathway)
	if err != nil {
		return "", fmt.Errorf("contentHashFor: %w", err)
	}
	for _, r := range pathways {
		records = append(records, hashRecord("RiskPathway", map[string]any{
			"id": r.ID, "risk_id": r.RiskID, "side": string(r.Side), "title": r.Title,
			"scenario": r.Scenario, "deleted": r.Deleted,
		}))
	}

	assignments, err := list[models.RoleAssignment](m, scoped(roleRoleAssignment), roleRoleAssignment)
	if err != nil {
		return "", fmt.Errorf("contentHashFor: %w", err)
	}
	for _, r := range assignments {
		records = append(records, hashRecord("RoleAssignment", map[string]any{
			"id": r.ID, "work_item_id": r.WorkItemID, "role_id": r.RoleID,
			"label": string(r.Label), "deleted": r.Deleted,
		}))
	}

	values, err := list[models.Value](m, scoped(roleValue), roleValue)
	if err != nil {
		return "", fmt.Errorf("contentHashFor: %w", err)
	}
	for _, r := range values {
		records = append(records, hashRecord("Value", map[string]any{
			"id": r.ID, "text": r.Text, "deleted": r.Deleted,
		}))
	}

	rules, err := list[models.Rule](m, scoped(roleRule), roleRule)
	if err != nil {
		return "", fmt.Errorf("contentHashFor: %w", err)
	}
	for _, r := range rules {
		records = append(records, hashRecord("Rule", map[string]any{
			"id": r.ID, "text": r.Text, "deleted": r.Deleted,
		}))
	}

	controls, err := list[models.Control](m, scoped(roleControl), roleControl)
	if err != nil {
		return "", fmt.Errorf("contentHashFor: %w", err)
	}
	for _, r := range controls {
		records = append(records, hashRecord("Control", map[string]any{
			"id": r.ID, "text": r.Text, "action": r.Action, "cond_field": r.CondField,
			"cond_operator": string(r.CondOperator), "cond_value": r.CondValue,
			"on_breach": string(r.OnBreach), "workflow_id": r.WorkflowID,
			"severity": string(r.Severity), "deleted": r.Deleted,
		}))
	}

	controlAttachments, err := list[models.ControlAttachment](m, scoped(roleControlAttachment), roleControlAttachment)
	if err != nil {
		return "", fmt.Errorf("contentHashFor: %w", err)
	}
	for _, r := range controlAttachments {
		records = append(records, hashRecord("ControlAttachment", map[string]any{
			"control_code": r.ControlCode, "target_type": string(r.TargetType), "target_code": r.TargetCode,
		}))
	}

	library, err := m.libraryHashRecords(scoped)
	if err != nil {
		return "", fmt.Errorf("contentHashFor: %w", err)
	}
	records = append(records, library...)

	agency, err := m.findAgency(ctx, tx)
	if err != nil {
		return "", err
	}
	records = append(records, hashRecord("Agency", map[string]any{
		"name": agency.Name, "description": agency.Description,
	}))

	sort.Strings(records)
	sum := sha256.Sum256([]byte(strings.Join(records, "\n")))
	return hex.EncodeToString(sum[:]), nil
}

type optionalField struct {
	name  string
	value string
}

func trueText(b bool) string {
	if b {
		return "true"
	}
	return ""
}

func (m *agencyManager) libraryHashRecords(scoped func(string) *gorm.DB) ([]string, error) {
	var records []string
	hazards, err := list[models.Hazard](m, scoped(roleHazard), roleHazard)
	if err != nil {
		return nil, err
	}
	for _, r := range hazards {
		records = append(records, hashRecord("Hazard", map[string]any{
			"id": r.ID, "code": r.Code, "title": r.Title, "description": r.Description, "deleted": r.Deleted,
		}))
	}
	threats, err := list[models.Threat](m, scoped(roleThreat), roleThreat)
	if err != nil {
		return nil, err
	}
	for _, r := range threats {
		records = append(records, hashRecord("Threat", map[string]any{
			"id": r.ID, "code": r.Code, "title": r.Title, "description": r.Description, "deleted": r.Deleted,
		}))
	}
	consequences, err := list[models.Consequence](m, scoped(roleConsequence), roleConsequence)
	if err != nil {
		return nil, err
	}
	for _, r := range consequences {
		records = append(records, hashRecord("Consequence", map[string]any{
			"id": r.ID, "code": r.Code, "title": r.Title, "description": r.Description, "deleted": r.Deleted,
		}, optionalField{"hazard_code", r.HazardCode}))
	}
	threatLinks, err := list[models.RiskThreat](m, scoped(roleRiskThreat), roleRiskThreat)
	if err != nil {
		return nil, err
	}
	for _, r := range threatLinks {
		records = append(records, hashRecord("RiskThreat", map[string]any{
			"risk_code": r.RiskCode, "threat_code": r.ThreatCode,
		}))
	}
	consequenceLinks, err := list[models.RiskConsequence](m, scoped(roleRiskConsequence), roleRiskConsequence)
	if err != nil {
		return nil, err
	}
	for _, r := range consequenceLinks {
		records = append(records, hashRecord("RiskConsequence", map[string]any{
			"risk_code": r.RiskCode, "consequence_code": r.ConsequenceCode,
		}))
	}
	return records, nil
}

func hashList(values []string) string {
	if len(values) == 0 {
		return ""
	}
	b, _ := json.Marshal(values)
	return string(b)
}

func hashRecord(typeName string, fields map[string]any, optional ...optionalField) string {
	for _, o := range optional {
		if o.value != "" {
			fields[o.name] = o.value
		}
	}
	b, _ := json.Marshal(map[string]any{"type": typeName, "props": fields})
	return string(b)
}

func (m *agencyManager) validationErrors(ctx context.Context, tx *gorm.DB, draftID string, groups map[string]bool) error {
	found, err := m.rescanIssues(ctx, tx, draftID, groups)
	if err != nil {
		return err
	}
	var blocking []string
	for _, issue := range found {
		if issue.Severity == models.IssueSeverityError {
			blocking = append(blocking, issue.Message)
		}
	}
	if len(blocking) == 0 {
		return nil
	}
	return fmt.Errorf("%w: %s", ErrPublishValidationFailed, strings.Join(blocking, "; "))
}

func (m *agencyManager) PublishAgency(ctx context.Context, draftID, tag, channel string) (models.AgencyPublication, error) {
	if channel == "" {
		channel = models.DefaultChannel
	}

	groups, err := m.groupIDs(ctx)
	if err != nil {
		return models.AgencyPublication{}, err
	}

	var out models.AgencyPublication
	err = m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if _, err := m.findDraft(ctx, tx, draftID); err != nil {
			return err
		}
		if err := m.validationErrors(ctx, tx, draftID, groups); err != nil {
			return err
		}
		document, err := m.buildDocument(ctx, tx, draftID)
		if err != nil {
			return err
		}
		hash, err := m.contentHashFor(ctx, tx, draftID)
		if err != nil {
			return err
		}

		existing, err := list[publication](m, tx.WithContext(ctx).Table(m.table(rolePublication)), rolePublication)
		if err != nil {
			return fmt.Errorf("PublishAgency: %w", err)
		}
		maxVersion := 0
		takenTags := make(map[string]bool, len(existing))
		for _, p := range existing {
			if p.ContentHash == hash {
				return ErrNoChangesDetected
			}
			takenTags[p.Tag] = true
			if p.Version > maxVersion {
				maxVersion = p.Version
			}
		}

		version := maxVersion + 1
		if tag == "" {
			tag = fmt.Sprintf("v%d", version)
		}
		if takenTags[tag] {
			return ErrDuplicateTag
		}

		now := models.NowRFC3339()
		if err := tx.Table(m.table(rolePublication)).Where("channel = ?", channel).
			Updates(map[string]any{"channel": models.ChannelArchived, "last_updated": now}).Error; err != nil {
			return fmt.Errorf("PublishAgency: %w", err)
		}

		p := models.AgencyPublication{
			ID:          newID(),
			DraftID:     draftID,
			ContentHash: hash,
			Version:     version,
			Tag:         tag,
			Channel:     channel,
			Document:    document,
			PublishedAt: now,
			LastUpdated: now,
		}
		if err := m.copyRow(ctx, tx, rolePublication, toPublicationRow(p)); err != nil {
			return fmt.Errorf("PublishAgency: %w", classifyConflict(err))
		}
		out = p
		return nil
	})
	if err != nil {
		return models.AgencyPublication{}, classifyConflict(err)
	}
	return out, nil
}

func (m *agencyManager) findPublicationBy(ctx context.Context, tx *gorm.DB, where string, args ...any) (models.AgencyPublication, error) {
	var row publication
	q := tx.WithContext(ctx).Table(m.table(rolePublication)).Where(where, args...)
	if err := m.take(q, rolePublication, &row, ErrPublicationNotFound); err != nil {
		return models.AgencyPublication{}, err
	}
	return fromPublicationRow(row), nil
}

func (m *agencyManager) GetPublication(ctx context.Context, version int) (models.AgencyPublication, error) {
	return m.findPublicationBy(ctx, m.db, "version = ?", version)
}

func (m *agencyManager) ListPublications(ctx context.Context, filter PublicationFilter) ([]models.AgencyPublication, error) {
	q := m.q(ctx, rolePublication).Select(publicationSummaryColumns).Order("version")
	q = likeFilter(q, "tag", filter.Tag)
	q = eqFilter(q, "channel", filter.Channel)

	rows, err := list[publication](m, q, rolePublication)
	if err != nil {
		return nil, fmt.Errorf("ListPublications: %w", err)
	}
	out := make([]models.AgencyPublication, len(rows))
	for i, r := range rows {
		out[i] = fromPublicationRow(r)
	}
	return out, nil
}

func (m *agencyManager) SetPublicationChannel(ctx context.Context, version int, channel string) (models.AgencyPublication, error) {
	var out models.AgencyPublication
	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		p, err := m.findPublicationBy(ctx, tx, "version = ?", version)
		if err != nil {
			return err
		}
		now := models.NowRFC3339()
		if channel != models.ChannelArchived {
			if err := tx.Table(m.table(rolePublication)).
				Where("channel = ? AND version <> ?", channel, version).
				Updates(map[string]any{"channel": models.ChannelArchived, "last_updated": now}).Error; err != nil {
				return fmt.Errorf("SetPublicationChannel: %w", err)
			}
		}
		if err := tx.Table(m.table(rolePublication)).Where("version = ?", version).
			Updates(map[string]any{"channel": channel, "last_updated": now}).Error; err != nil {
			return fmt.Errorf("SetPublicationChannel: %w", err)
		}
		p.Channel, p.LastUpdated = channel, now
		out = p
		return nil
	})
	if err != nil {
		return models.AgencyPublication{}, err
	}
	return out, nil
}

func (m *agencyManager) GetPublicationForChannel(ctx context.Context, channel string) (models.AgencyPublication, error) {
	if channel == "" {
		channel = models.DefaultChannel
	}
	return m.findPublicationBy(ctx, m.db, "channel = ?", channel)
}
