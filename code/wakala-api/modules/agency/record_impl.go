package mwanachamaagency

import (
	"context"
	"fmt"
	"slices"
	"strconv"
	"strings"
	"time"

	"gorm.io/gorm"

	"wakalaserver/modules/agency/models"
)

func invalidRecord(format string, args ...any) error {
	return fmt.Errorf("%w: %s", ErrInvalidRecord, fmt.Sprintf(format, args...))
}

func invalidRow(format string, args ...any) error {
	return fmt.Errorf("%w: %s", ErrInvalidRecordRow, fmt.Sprintf(format, args...))
}

func validateRecordShape(r models.Record) error {
	if strings.TrimSpace(r.Name) == "" {
		return invalidRecord("a record has a name")
	}
	if r.RoleID == "" {
		return invalidRecord("a record names the role that adds its rows")
	}
	if strings.ContainsAny(r.RoleID, ", \t\r\n;") {
		return invalidRecord("a record has one role that adds rows, got %q", r.RoleID)
	}
	if strings.ContainsAny(r.ViewerRoleID, ", \t\r\n;") {
		return invalidRecord("a record has at most one role that sees its rows, got %q", r.ViewerRoleID)
	}
	if r.WorkflowID == "" {
		return invalidRecord("a record belongs to a workflow")
	}
	return validateForm(invalidRecord, fmt.Sprintf("the record %q", r.Name), r.FormName, r.Questions)
}

func (m *agencyManager) validateRecord(ctx context.Context, tx *gorm.DB, r models.Record) error {
	if err := validateRecordShape(r); err != nil {
		return err
	}
	if err := m.actorOfDraft(ctx, tx, r.DraftID, r.RoleID); err != nil {
		return err
	}
	if r.ViewerRoleID != "" {
		if err := m.actorOfDraft(ctx, tx, r.DraftID, r.ViewerRoleID); err != nil {
			return err
		}
	}
	var workflow models.Workflow
	workflowQuery := scopeQuery(tx.WithContext(ctx).Table(m.table(roleWorkflow)), r.DraftID).Where("id = ?", r.WorkflowID)
	if err := m.take(workflowQuery, roleWorkflow, &workflow, ErrWorkflowNotFound); err != nil {
		return err
	}
	var same int64
	err := scopeQuery(tx.WithContext(ctx).Table(m.table(roleRecord)), r.DraftID).
		Where("workflow_id = ? AND LOWER(name) = ? AND id <> ?", r.WorkflowID, strings.ToLower(strings.TrimSpace(r.Name)), r.ID).
		Count(&same).Error
	if err != nil {
		return err
	}
	if same > 0 {
		return invalidRecord("the workflow %q already keeps a record called %q", workflow.Name, r.Name)
	}
	return nil
}

func (m *agencyManager) CreateRecord(ctx context.Context, r models.Record) (models.Record, error) {
	if err := m.validateOpenDraftID(ctx, r.DraftID); err != nil {
		return models.Record{}, err
	}
	r.Name = strings.TrimSpace(r.Name)
	if err := m.validateRecord(ctx, m.db, r); err != nil {
		return models.Record{}, fmt.Errorf("CreateRecord: %w", err)
	}
	r.ID = newID()
	r.Deleted = false
	r.CreatedAt = models.NowRFC3339()
	r.LastUpdated = r.CreatedAt

	err := m.createWithCode(ctx, roleRecord, "record", "RC", func(code string) any {
		r.Code = code
		return r
	})
	if err != nil {
		return models.Record{}, fmt.Errorf("CreateRecord: %w", err)
	}
	return r, nil
}

func (m *agencyManager) findRecord(ctx context.Context, tx *gorm.DB, id string) (models.Record, error) {
	var r models.Record
	if err := m.find(ctx, tx, roleRecord, id, &r, ErrRecordNotFound); err != nil {
		return models.Record{}, err
	}
	return r, nil
}

func (m *agencyManager) GetRecord(ctx context.Context, id string) (models.Record, error) {
	return m.findRecord(ctx, m.db, id)
}

func (m *agencyManager) ListRecords(ctx context.Context, draftID string, filter RecordFilter) ([]models.Record, error) {
	q := scopeQuery(m.q(ctx, roleRecord).Order("created_at"), draftID)
	q = likeFilter(q, "code", filter.Code)
	q = likeFilter(q, "name", filter.Name)
	q = eqFilter(q, "workflow_id", filter.WorkflowID)

	out, err := list[models.Record](m, q, roleRecord)
	if err != nil {
		return nil, fmt.Errorf("ListRecords: %w", err)
	}
	return out, nil
}

func (m *agencyManager) UpdateRecord(ctx context.Context, r models.Record) (models.Record, error) {
	var out models.Record
	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		existing, err := m.findRecord(ctx, tx, r.ID)
		if err != nil {
			return err
		}
		if err := m.requireOpenDraft(ctx, tx, existing.DraftID); err != nil {
			return err
		}
		r.Code = existing.Code
		r.DraftID = existing.DraftID
		r.CreatedAt = existing.CreatedAt
		r.LastUpdated = models.NowRFC3339()
		r.Name = strings.TrimSpace(r.Name)

		if err := m.validateRecord(ctx, tx, r); err != nil {
			return err
		}
		if err := m.writeUpdate(ctx, tx, roleRecord, r.ID, r, ErrRecordNotFound); err != nil {
			return err
		}
		out = r
		return nil
	})
	if err != nil {
		return models.Record{}, fmt.Errorf("UpdateRecord: %w", err)
	}
	return out, nil
}

func (m *agencyManager) DeleteRecord(ctx context.Context, id string) error {
	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		existing, err := m.findRecord(ctx, tx, id)
		if err != nil {
			return err
		}
		if err := m.requireOpenDraft(ctx, tx, existing.DraftID); err != nil {
			return err
		}
		if err := m.deleteWhere(ctx, tx, roleRecordRow, "record_id = ?", id); err != nil {
			return err
		}
		return m.deleteWhere(ctx, tx, roleRecord, "id = ?", id)
	})
	if err != nil {
		return fmt.Errorf("DeleteRecord: %w", err)
	}
	return nil
}

func validateRowAnswers(questions []models.StepQuestion, answers map[string]string) error {
	asked := make(map[string]models.StepQuestion, len(questions))
	for _, q := range questions {
		asked[q.Prompt] = q
	}
	for prompt := range answers {
		if _, ok := asked[prompt]; !ok {
			return invalidRow("%q is not a question of the form", prompt)
		}
	}
	for _, q := range questions {
		answer := strings.TrimSpace(answers[q.Prompt])
		if answer == "" {
			if q.Required {
				return invalidRow("the question %q is required", q.Prompt)
			}
			continue
		}
		if err := validateRowAnswer(q, answer); err != nil {
			return err
		}
	}
	return nil
}

func validateRowAnswer(q models.StepQuestion, answer string) error {
	switch q.AnswerType {
	case models.AnswerYesNo:
		if a := strings.ToLower(answer); a != "yes" && a != "no" {
			return invalidRow("the answer to %q is yes or no, got %q", q.Prompt, answer)
		}
	case models.AnswerNumber, models.AnswerCurrency:
		if _, err := strconv.ParseFloat(answer, 64); err != nil {
			return invalidRow("the answer to %q is a number, got %q", q.Prompt, answer)
		}
	case models.AnswerDate:
		if _, err := time.Parse("2006-01-02", answer); err != nil {
			return invalidRow("the answer to %q is a date as 2006-01-02, got %q", q.Prompt, answer)
		}
	case models.AnswerSingleChoice:
		if len(q.Options) > 0 && !slices.Contains(q.Options, answer) {
			return invalidRow("the answer to %q is one of %v, got %q", q.Prompt, q.Options, answer)
		}
	}
	return nil
}

func (m *agencyManager) CreateRecordRow(ctx context.Context, row models.RecordRow) (models.RecordRow, error) {
	if row.DraftID == "" {
		return models.RecordRow{}, ErrDraftRequired
	}
	if _, err := m.findDraft(ctx, m.db, row.DraftID); err != nil {
		return models.RecordRow{}, err
	}
	var record models.Record
	q := scopeQuery(m.q(ctx, roleRecord), row.DraftID).Where("id = ?", row.RecordID)
	if err := m.take(q, roleRecord, &record, ErrRecordNotFound); err != nil {
		return models.RecordRow{}, fmt.Errorf("CreateRecordRow: %w", err)
	}
	if row.RoleID == "" || row.RoleID != record.RoleID {
		return models.RecordRow{}, fmt.Errorf("CreateRecordRow: %w: only the role that adds rows to %q may", ErrRecordRowRefused, record.Name)
	}
	if err := validateRowAnswers(record.Questions, row.Answers); err != nil {
		return models.RecordRow{}, fmt.Errorf("CreateRecordRow: %w", err)
	}
	row.ID = newID()
	row.Deleted = false
	row.RecordCode = record.Code
	row.CreatedAt = rowClock().Format(models.TimeLayout)
	row.LastUpdated = row.CreatedAt
	row.CorrectedOn = ""
	if err := m.settleReplacement(ctx, &row, record); err != nil {
		return models.RecordRow{}, fmt.Errorf("CreateRecordRow: %w", err)
	}
	if err := m.refuseDuplicate(ctx, row); err != nil {
		return models.RecordRow{}, fmt.Errorf("CreateRecordRow: %w", err)
	}
	if err := duplicateOr(m.st.Insert(ctx, roleRecordRow, row), ErrStepAlreadySent); err != nil {
		return models.RecordRow{}, fmt.Errorf("CreateRecordRow: %w", err)
	}
	return row, nil
}

func (m *agencyManager) ListRecordRows(ctx context.Context, draftID string, filter RecordRowFilter) ([]models.RecordRow, error) {
	q := scopeQuery(m.q(ctx, roleRecordRow).Order("created_at"), draftID)
	q = eqFilter(q, "record_id", filter.RecordID)
	q = eqFilter(q, "record_code", filter.RecordCode)
	q = eqFilter(q, "order_id", filter.OrderID)

	out, err := list[models.RecordRow](m, q, roleRecordRow)
	if err != nil {
		return nil, fmt.Errorf("ListRecordRows: %w", err)
	}
	return out, nil
}
