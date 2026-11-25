package http

import (
	"context"
	"errors"
	"strings"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"

	"wakalaserver/internal/accounts"
)

func (d *Deps) submitRowStep(ctx context.Context, instanceID string, m mwanachamaagency.AgencyManager, draftID string, step agencymodels.WorkItem, req stepAnswersRequest) (stepAnswersResult, error) {
	record, err := liveRecordByCode(ctx, m, draftID, step.RowRecord)
	if err != nil {
		return stepAnswersResult{}, errStepNoRegister
	}
	if step.RowAction == agencymodels.RowActionAdd {
		if err := d.refuseAddOutsideAUsableGroup(ctx, instanceID); err != nil {
			return stepAnswersResult{}, err
		}
	}
	if !d.callerMayDoRow(ctx, instanceID, m, record, step.RowAction, anyFieldOfRecord, nil) {
		return stepAnswersResult{}, errRowForbidden
	}
	if req.AnotherSheet || req.OrderID != "" {
		return stepAnswersResult{}, badRowError("a step that changes a row of a record is one step of its own, so it takes no order_id and no other sheet")
	}
	if err := refuseStampedPrompts(req.Answers); err != nil {
		return stepAnswersResult{}, err
	}
	rowID, err := d.applyRowAction(ctx, instanceID, m, draftID, record, step, req)
	if errors.Is(err, mwanachamaagency.ErrStepAlreadySent) {
		return stepAnswersResult{}, errStepNotWaiting
	}
	if err != nil {
		return stepAnswersResult{}, err
	}
	return stepAnswersResult{StepID: step.ID, RecordCode: record.Identity(), RowID: rowID, Done: true}, nil
}

func (d *Deps) applyRowAction(ctx context.Context, instanceID string, m mwanachamaagency.AgencyManager, draftID string, record agencymodels.Record, step agencymodels.WorkItem, req stepAnswersRequest) (string, error) {
	if step.RowAction == agencymodels.RowActionAdd {
		if req.RowID != "" {
			return "", badRowError("a step that adds a row takes no row_id")
		}
		row, err := d.writeRowFromAnswers(ctx, instanceID, m, draftID, record, step, req, "")
		return row.ID, err
	}
	if err := d.requireCurrentRow(ctx, instanceID, m, record, req.RowID); err != nil {
		return "", err
	}
	if step.RowAction == agencymodels.RowActionEdit {
		row, err := d.writeRowFromAnswers(ctx, instanceID, m, draftID, record, step, req, req.RowID)
		return row.ID, err
	}
	reason, err := reasonOfDelete(req.Answers)
	if err != nil {
		return "", err
	}
	retired, err := m.RetireRecordRow(ctx, req.RowID, accounts.IDFromContext(ctx), reason)
	return retired.ID, err
}

func (d *Deps) writeRowFromAnswers(ctx context.Context, instanceID string, m mwanachamaagency.AgencyManager, draftID string, record agencymodels.Record, step agencymodels.WorkItem, req stepAnswersRequest, replaces string) (agencymodels.RecordRow, error) {
	answers, err := resolveStepAnswers(record.Questions, req.Answers)
	if err != nil {
		return agencymodels.RecordRow{}, err
	}
	placeRefs, err := d.checkedPlaceRefs(ctx, instanceID, record.Questions, answers, req.PlaceRefs)
	if err != nil {
		return agencymodels.RecordRow{}, err
	}
	return d.writeRow(ctx, instanceID, m, draftID, record, rowWrite{
		Answers: answers, PlaceRefs: placeRefs, Replaces: replaces, SendKey: rowStepSendKey(step, req.SendKey),
	})
}

func rowStepSendKey(step agencymodels.WorkItem, sendKey string) string {
	if sendKey == "" {
		return ""
	}
	return step.Code + ":send:" + sendKey
}

func reasonOfDelete(answers map[string]stepAnswer) (string, error) {
	for prompt := range answers {
		if prompt != agencymodels.DeleteReasonPrompt {
			return "", badRowError("a step that deletes a row asks only " + agencymodels.DeleteReasonPrompt)
		}
	}
	reason := strings.TrimSpace(answers[agencymodels.DeleteReasonPrompt].text)
	if reason == "" {
		return "", badRowError("a retired row says why: answer " + agencymodels.DeleteReasonPrompt)
	}
	return reason, nil
}

func (d *Deps) requireCurrentRow(ctx context.Context, instanceID string, m mwanachamaagency.AgencyManager, record agencymodels.Record, rowID string) error {
	if rowID == "" {
		return badRowError("row_id names the current row of " + record.Name + " this step changes")
	}
	drafts, err := draftsOfEveryPublication(ctx, m)
	if err != nil {
		return err
	}
	current, err := currentRowsOfRecord(ctx, m, drafts, record.Code)
	if err != nil {
		return err
	}
	reach, err := d.rowReachOfCaller(ctx, instanceID)
	if err != nil {
		return err
	}
	for _, row := range current {
		if row.ID == rowID && reach.reaches(row) {
			return nil
		}
	}
	return badRowError("row_id is not a current row of " + record.Name)
}
