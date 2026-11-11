package mwanachamaagency

import (
	"context"
	"fmt"

	"gorm.io/gorm"

	"wakalaserver/modules/shared/spec"
	"wakalaserver/modules/shared/specstore"

	"wakalaserver/modules/agency/models"
)

const (
	roleAgency            = "agency"
	roleDraft             = "draft"
	roleGoal              = "goal"
	roleObjective         = "objective"
	roleWorkflow          = "workflow"
	roleWorkItem          = "work_item"
	roleEventFlowStep     = "event_flow_step"
	roleRole              = "role"
	roleRoleAssignment    = "role_assignment"
	roleWorkflowObjective = "workflow_objective"
	roleModule            = "module"
	roleValue             = "value"
	roleValueAttachment   = "value_attachment"
	roleRule              = "rule"
	roleRuleAttachment    = "rule_attachment"
	roleControl           = "control"
	roleControlAttachment = "control_attachment"
	roleIssue             = "issue"
	rolePublication       = "agency_publication"
	roleCodeSequence      = "code_sequence"
	roleRecord            = "record"
	roleRecordRow         = "record_row"
	roleMeasure           = "measure"
	roleRisk              = "risk"
	roleRiskPathway       = "risk_pathway"
	roleHazard            = "hazard"
	roleThreat            = "threat"
	roleConsequence       = "consequence"
	roleRiskThreat        = "risk_threat"
	roleRiskConsequence   = "risk_consequence"
	roleScenario          = "scenario"
	roleScenarioActor     = "scenario_actor"
	roleScenarioInput     = "scenario_input"
	roleTestRun           = "test_run"
	roleReview            = "review"
	roleReviewArea        = "review_area"
	roleReviewFinding     = "review_finding"
	roleReviewComment     = "review_comment"
)

type publication struct {
	ID          string
	DraftID     string
	ContentHash string
	Version     int
	Tag         string
	Channel     string
	Document    string
	PublishedAt string
	LastUpdated string
}

type codeSequence struct {
	EntityType string
	NextNumber int
}

func carriers() map[string]any {
	return map[string]any{
		roleAgency:            models.Agency{},
		roleDraft:             models.Draft{},
		roleGoal:              models.Goal{},
		roleObjective:         models.Objective{},
		roleWorkflow:          models.Workflow{},
		roleWorkItem:          models.WorkItem{},
		roleEventFlowStep:     models.EventFlowStep{},
		roleRole:              models.Role{},
		roleRoleAssignment:    models.RoleAssignment{},
		roleWorkflowObjective: models.WorkflowObjective{},
		roleModule:            models.Module{},
		roleValue:             models.Value{},
		roleValueAttachment:   models.ValueAttachment{},
		roleRule:              models.Rule{},
		roleRuleAttachment:    models.RuleAttachment{},
		roleControl:           models.Control{},
		roleControlAttachment: models.ControlAttachment{},
		roleIssue:             models.Issue{},
		rolePublication:       publication{},
		roleCodeSequence:      codeSequence{},
		roleRecord:            models.Record{},
		roleRecordRow:         models.RecordRow{},
		roleMeasure:           models.Measure{},
		roleRisk:              models.Risk{},
		roleRiskPathway:       models.RiskPathway{},
		roleHazard:            models.Hazard{},
		roleThreat:            models.Threat{},
		roleConsequence:       models.Consequence{},
		roleRiskThreat:        models.RiskThreat{},
		roleRiskConsequence:   models.RiskConsequence{},
		roleScenario:          models.Scenario{},
		roleScenarioActor:     models.ScenarioActor{},
		roleScenarioInput:     models.ScenarioInput{},
		roleTestRun:           models.TestRun{},
		roleReview:            models.Review{},
		roleReviewArea:        models.ReviewArea{},
		roleReviewFinding:     models.ReviewFinding{},
		roleReviewComment:     models.ReviewComment{},
	}
}

func newStore(db *gorm.DB, s *spec.Spec) (*specstore.Store, error) {
	return specstore.New(db, s, carriers())
}

func (m *agencyManager) table(role string) string { return m.st.Table(role) }

func (m *agencyManager) object(role string) spec.Object { return m.st.Object(role) }

func (m *agencyManager) q(ctx context.Context, role string) *gorm.DB {
	return m.st.Query(ctx, role)
}

func (m *agencyManager) take(q *gorm.DB, role string, out any, notFound error) error {
	return m.st.Take(q, role, out, notFound)
}

func (m *agencyManager) insert(ctx context.Context, role string, v any) error {
	return classifyConflict(m.st.Insert(ctx, role, v))
}

func (m *agencyManager) encode(role string, v any) (map[string]any, error) {
	return specstore.Encode(m.object(role), v)
}

func (m *agencyManager) decode(role string, row map[string]any, out any) error {
	return specstore.Decode(m.object(role), row, out)
}

func list[T any](m *agencyManager, q *gorm.DB, role string) ([]T, error) {
	return specstore.List[T](m.st, q, role)
}

func newID() string { return specstore.NewID() }

const codeSequenceAttempts = 5

func nextCode(ctx context.Context, tx *gorm.DB, table, entityType, prefix string) (string, error) {
	for attempt := 0; attempt < codeSequenceAttempts; attempt++ {
		var rows []map[string]any
		if err := tx.WithContext(ctx).Table(table).
			Where("entity_type = ?", entityType).Limit(1).Find(&rows).Error; err != nil {
			return "", fmt.Errorf("nextCode: %w", err)
		}

		if len(rows) == 0 {
			seed := map[string]any{"entity_type": entityType, "next_number": 2}
			if err := tx.WithContext(ctx).Table(table).Create(seed).Error; err != nil {
				return "", fmt.Errorf("nextCode: %w", err)
			}
			return fmt.Sprintf("%s-%d", prefix, 1), nil
		}

		n, err := asInt(rows[0]["next_number"])
		if err != nil {
			return "", fmt.Errorf("nextCode: %s: %w", entityType, err)
		}

		claimed := tx.WithContext(ctx).Table(table).
			Where("entity_type = ? AND next_number = ?", entityType, n).
			Update("next_number", n+1)
		if claimed.Error != nil {
			return "", fmt.Errorf("nextCode: %w", claimed.Error)
		}
		if claimed.RowsAffected == 1 {
			return fmt.Sprintf("%s-%d", prefix, n), nil
		}
	}
	return "", fmt.Errorf("nextCode: %s: the counter moved under %d attempts: %w", entityType, codeSequenceAttempts, ErrConflict)
}

func asInt(v any) (int, error) {
	switch n := v.(type) {
	case int64:
		return int(n), nil
	case int:
		return n, nil
	case float64:
		return int(n), nil
	default:
		return 0, fmt.Errorf("cannot read %T as a number", v)
	}
}

func (m *agencyManager) find(ctx context.Context, tx *gorm.DB, role, id string, out any, notFound error) error {
	q := tx.WithContext(ctx).Table(m.table(role)).Where("id = ?", id)
	return m.take(q, role, out, notFound)
}

var alwaysImmutable = []string{"id", "code", "draft_id", "created_at"}

func (m *agencyManager) writeUpdate(ctx context.Context, tx *gorm.DB, role, id string, v any, notFound error, skip ...string) error {
	row, err := m.encode(role, v)
	if err != nil {
		return err
	}
	for _, column := range append(append([]string{}, alwaysImmutable...), skip...) {
		delete(row, column)
	}
	res := tx.WithContext(ctx).Table(m.table(role)).Where("id = ?", id).Updates(row)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return notFound
	}
	return nil
}

func (m *agencyManager) createWithCode(ctx context.Context, role, entityType, prefix string, build func(code string) any) error {
	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		code, err := claimCode(ctx, tx, m.table(roleCodeSequence), entityType, prefix)
		if err != nil {
			return err
		}
		row, err := m.encode(role, build(code))
		if err != nil {
			return err
		}
		return tx.Table(m.table(role)).Create(row).Error
	})
	return classifyConflict(err)
}

func (m *agencyManager) deleteInDraft(ctx context.Context, tx *gorm.DB, role, draftID, where string, args ...any) error {
	return m.deleteWhere(ctx, tx, role, "draft_id = ? and ("+where+")", append([]any{draftID}, args...)...)
}

func (m *agencyManager) deleteWhere(ctx context.Context, tx *gorm.DB, role, where string, args ...any) error {
	return tx.WithContext(ctx).Exec("delete from "+m.table(role)+" where "+where, args...).Error
}
