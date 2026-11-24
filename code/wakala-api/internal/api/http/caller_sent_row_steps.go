package http

import (
	"context"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
)

func sentRowSteps(ctx context.Context, m mwanachamaagency.AgencyManager, steps []agencymodels.WorkItem, records []agencymodels.Record, workflows map[string]agencymodels.Workflow, drafts []string, caller string, includeGenerated bool) ([]sentStep, error) {
	recordByCode := map[string]agencymodels.Record{}
	for _, r := range records {
		recordByCode[r.Identity()] = r
	}
	rowsOf := map[string][]agencymodels.RecordRow{}
	var sent []sentStep
	for _, step := range steps {
		workflow, live := workflows[step.WorkflowID]
		if step.RowRecord == "" || step.Deleted || !live || (workflow.Generated && !includeGenerated) {
			continue
		}
		if _, read := rowsOf[step.RowRecord]; !read {
			every, err := everyRowOfRecord(ctx, m, drafts, step.RowRecord)
			if err != nil {
				return nil, err
			}
			rowsOf[step.RowRecord] = every
		}
		for _, row := range rowsOf[step.RowRecord] {
			if item, ok := sentRowItem(step, workflow, row, caller); ok {
				sent = append(sent, item)
			}
		}
	}
	return sent, nil
}

func everyRowOfRecord(ctx context.Context, m mwanachamaagency.AgencyManager, drafts []string, recordCode string) ([]agencymodels.RecordRow, error) {
	var every []agencymodels.RecordRow
	for _, id := range drafts {
		found, err := m.ListRecordRows(ctx, id, mwanachamaagency.RecordRowFilter{RecordCode: recordCode, IncludeRetired: true})
		if err != nil {
			return nil, err
		}
		every = append(every, found...)
	}
	return every, nil
}

func sentRowItem(step agencymodels.WorkItem, workflow agencymodels.Workflow, row agencymodels.RecordRow, caller string) (sentStep, bool) {
	item := sentStep{
		StepID: step.ID, Title: step.Title, FormName: step.FormName, WorkflowID: step.WorkflowID, WorkflowName: workflow.Name,
		RecordCode: step.RowRecord, RowID: row.ID, RowAction: step.RowAction, Generated: workflow.Generated,
	}
	switch {
	case step.RowAction == agencymodels.RowActionAdd && row.AddedBy == caller && row.Replaces == "":
		item.SentAt, item.Answers = row.CreatedAt, answersOf(row)
	case step.RowAction == agencymodels.RowActionEdit && row.AddedBy == caller && row.Replaces != "":
		item.SentAt, item.Answers = row.CreatedAt, answersOf(row)
	case step.RowAction == agencymodels.RowActionDelete && row.Deleted && row.DeletedBy == caller:
		item.SentAt, item.Answers = row.DeletedOn, map[string]string{agencymodels.DeleteReasonPrompt: row.DeletedReason}
	default:
		return sentStep{}, false
	}
	return item, true
}
