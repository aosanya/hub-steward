package http

import (
	"context"
	"errors"
	"maps"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
)

var errSubjectRowGone = errors.New("the row this run is on has been removed, so this step cannot change it")

type subjectChange struct {
	record  agencymodels.Record
	row     agencymodels.RecordRow
	answers map[string]string
}

func settingsThatHold(step agencymodels.WorkItem, questions []agencymodels.StepQuestion, answers map[string]string) []agencymodels.SubjectSetting {
	var holding []agencymodels.SubjectSetting
	for _, setting := range step.SetsSubject {
		if ruleHolds(setting.When, answerNamed(questions, answers, setting.When.Question)) {
			holding = append(holding, setting)
		}
	}
	return holding
}

func (d *Deps) plannedSubjectChange(ctx context.Context, m mwanachamaagency.AgencyManager, draftID string, step agencymodels.WorkItem, questions []agencymodels.StepQuestion, answers map[string]string, subjectRowID, orderID string) (*subjectChange, error) {
	holding := settingsThatHold(step, questions, answers)
	if len(holding) == 0 {
		return nil, nil
	}
	workflows, err := liveWorkflows(ctx, m, draftID)
	if err != nil {
		return nil, err
	}
	code := workflows[step.WorkflowID].SubjectRecord
	if code == "" {
		return nil, nil
	}
	record, err := liveRecordByCode(ctx, m, draftID, code)
	if err != nil {
		return nil, errStepNoRegister
	}
	if subjectRowID == "" && orderID != "" {
		subjects, err := newRunSubjects(ctx, m, draftID)
		if err != nil {
			return nil, err
		}
		if subjectRowID, err = subjects.subjectRowOf(ctx, orderID); err != nil {
			return nil, err
		}
	}
	if subjectRowID == "" {
		return nil, badRowError("this run was started on no row of " + record.Name + ", so this step cannot set its " + holding[0].Field)
	}
	current, err := latestRowOf(ctx, m, record, subjectRowID)
	if err != nil {
		return nil, err
	}
	changed := maps.Clone(current.Answers)
	if changed == nil {
		changed = map[string]string{}
	}
	differs := false
	for _, setting := range holding {
		q, found := questionNamed(record.Questions, setting.Field)
		if !found {
			return nil, badRowError(record.Name + " asks no " + setting.Field + ", so this step cannot set it")
		}
		if answerOf(changed, q) != setting.To {
			differs = true
		}
		delete(changed, q.Prompt)
		changed[fieldIdentity(q)] = setting.To
	}
	if !differs {
		return nil, nil
	}
	return &subjectChange{record: record, row: current, answers: changed}, nil
}

func latestRowOf(ctx context.Context, m mwanachamaagency.AgencyManager, record agencymodels.Record, rowID string) (agencymodels.RecordRow, error) {
	drafts, err := draftsOfEveryPublication(ctx, m)
	if err != nil {
		return agencymodels.RecordRow{}, err
	}
	byID := map[string]agencymodels.RecordRow{}
	replacedBy := map[string]string{}
	for _, id := range drafts {
		rows, err := m.ListRecordRows(ctx, id, mwanachamaagency.RecordRowFilter{RecordCode: record.Identity(), IncludeRetired: true})
		if err != nil {
			return agencymodels.RecordRow{}, err
		}
		for _, row := range rows {
			byID[row.ID] = row
			if row.Replaces != "" {
				replacedBy[row.Replaces] = row.ID
			}
		}
	}
	row, found := byID[rowID]
	for found {
		next, replaced := replacedBy[row.ID]
		if !replaced {
			break
		}
		row, found = byID[next]
	}
	if !found || row.Deleted {
		return agencymodels.RecordRow{}, errSubjectRowGone
	}
	return row, nil
}

func (d *Deps) applySubjectChange(ctx context.Context, instanceID string, m mwanachamaagency.AgencyManager, draftID string, change *subjectChange) (string, error) {
	if change == nil {
		return "", nil
	}
	replacing, err := d.writeRow(ctx, instanceID, m, draftID, change.record, rowWrite{
		Answers: change.answers, PlaceRefs: change.row.PlaceRefs, Replaces: change.row.ID,
	})
	return replacing.ID, err
}
