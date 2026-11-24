package http

import (
	"context"
	"slices"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
)

type runSubjects struct {
	m         mwanachamaagency.AgencyManager
	workflows map[string]agencymodels.Workflow
	drafts    []string
	rowOfRun  map[string]string
}

func newRunSubjects(ctx context.Context, m mwanachamaagency.AgencyManager, draftID string) (*runSubjects, error) {
	workflows, err := liveWorkflows(ctx, m, draftID)
	if err != nil {
		return nil, err
	}
	drafts, err := draftsOfEveryPublication(ctx, m)
	if err != nil {
		return nil, err
	}
	return &runSubjects{m: m, workflows: workflows, drafts: drafts, rowOfRun: map[string]string{}}, nil
}

func (s *runSubjects) subjectRowOf(ctx context.Context, orderID string) (string, error) {
	if row, read := s.rowOfRun[orderID]; read {
		return row, nil
	}
	for _, draftID := range s.drafts {
		rows, err := s.m.ListRecordRows(ctx, draftID, mwanachamaagency.RecordRowFilter{OrderID: orderID, IncludeReturned: true})
		if err != nil {
			return "", err
		}
		for _, row := range rows {
			if row.SubjectRowID != "" {
				s.rowOfRun[orderID] = row.SubjectRowID
				return row.SubjectRowID, nil
			}
		}
	}
	s.rowOfRun[orderID] = ""
	return "", nil
}

func (s *runSubjects) carry(ctx context.Context, item openStep) (openStep, error) {
	record := s.workflows[item.WorkflowID].SubjectRecord
	if record == "" {
		return item, nil
	}
	item.SubjectRecord = record
	if item.State == stepStateStart {
		item.RecordCode = record
	}
	if item.State != stepStateWaiting {
		return item, nil
	}
	row, err := s.subjectRowOf(ctx, item.OrderID)
	if err != nil || row == "" {
		return item, err
	}
	item.RecordCode, item.RowID = record, row
	return item, nil
}

func (d *Deps) withSubjects(ctx context.Context, instanceID string, listed openSteps) (openSteps, error) {
	if len(listed.Items) == 0 {
		return listed, nil
	}
	m, err := agencyOfAnyone(ctx, d.Registry, instanceID)
	if err != nil {
		return openSteps{}, err
	}
	draftID, err := liveDraftOf(ctx, m)
	if err != nil {
		return openSteps{}, err
	}
	subjects, err := newRunSubjects(ctx, m, draftID)
	if err != nil {
		return openSteps{}, err
	}
	for i, item := range listed.Items {
		if listed.Items[i], err = subjects.carry(ctx, item); err != nil {
			return openSteps{}, err
		}
	}
	return listed, nil
}

func (d *Deps) subjectRowForStart(ctx context.Context, instanceID string, m mwanachamaagency.AgencyManager, draftID string, records []agencymodels.Record, step agencymodels.WorkItem, index int, req stepAnswersRequest) (string, error) {
	if index != 0 || req.AnotherSheet {
		return "", nil
	}
	workflows, err := liveWorkflows(ctx, m, draftID)
	if err != nil {
		return "", err
	}
	code := workflows[step.WorkflowID].SubjectRecord
	if code == "" {
		return "", nil
	}
	at := slices.IndexFunc(records, func(r agencymodels.Record) bool { return (r.Code == code || r.Key == code) && !r.Deleted })
	if at < 0 {
		return "", errStepNoRegister
	}
	if req.RowID == "" {
		return "", badRowError("row_id names the row of " + records[at].Name + " this workflow is started on")
	}
	if err := d.requireCurrentRow(ctx, instanceID, m, records[at], req.RowID); err != nil {
		return "", err
	}
	return req.RowID, nil
}
