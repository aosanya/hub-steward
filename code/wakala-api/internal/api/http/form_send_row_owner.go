package http

import (
	"context"
	"fmt"
	"sort"

	mwanachamaagency "wakalaserver/modules/agency"
	agencymodels "wakalaserver/modules/agency/models"
	forms "wakalaserver/modules/forms"
	formsmodels "wakalaserver/modules/forms/models"

	"wakalaserver/internal/agencies"
)

var errRecordRowNotOwned = fmt.Errorf("%w: that business or trader row does not name you as its owner", forms.ErrInvalidAnswer)

type rowsOfTheAgency func(ctx context.Context) ([]agencymodels.RecordRow, []agencymodels.Record, error)

type sendsNamingRows struct {
	forms.FormManager
	read rowsOfTheAgency
}

func liveRowsOfTheAgency(reg agencies.Registry, instanceID string) rowsOfTheAgency {
	return func(ctx context.Context) ([]agencymodels.RecordRow, []agencymodels.Record, error) {
		m, err := agencyOfAnyone(ctx, reg, instanceID)
		if err != nil {
			return nil, nil, err
		}
		drafts, err := draftsOfEveryPublication(ctx, m)
		if err != nil {
			return nil, nil, err
		}
		var rows []agencymodels.RecordRow
		var records []agencymodels.Record
		for _, id := range drafts {
			foundRows, err := m.ListRecordRows(ctx, id, mwanachamaagency.RecordRowFilter{})
			if err != nil {
				return nil, nil, err
			}
			foundRecords, err := m.ListRecords(ctx, id, mwanachamaagency.RecordFilter{})
			if err != nil {
				return nil, nil, err
			}
			rows = append(rows, foundRows...)
			records = append(records, foundRecords...)
		}
		return rows, records, nil
	}
}

func rowOwnedBy(rows []agencymodels.RecordRow, records []agencymodels.Record, recordRowID, person string) bool {
	for _, row := range rows {
		if row.ID != recordRowID || row.Deleted {
			continue
		}
		for _, record := range records {
			if record.ID == row.RecordID && rowNames(record, row, person) {
				return true
			}
		}
	}
	return false
}

func (s sendsNamingRows) refuseRowNotOwned(ctx context.Context, recordRowID, person string) error {
	if recordRowID == "" {
		return nil
	}
	rows, records, err := s.read(ctx)
	if err != nil {
		return err
	}
	if !rowOwnedBy(rows, records, recordRowID, person) {
		return errRecordRowNotOwned
	}
	return nil
}

func (s sendsNamingRows) SubmitAnswersFor(ctx context.Context, formID, memberID, answeringAs, language, periodKey, recordRowID string, in []formsmodels.Answer) ([]formsmodels.Answer, error) {
	if err := s.refuseRowNotOwned(ctx, recordRowID, memberID); err != nil {
		return nil, err
	}
	return s.FormManager.SubmitAnswersFor(ctx, formID, memberID, answeringAs, language, periodKey, recordRowID, in)
}

func (s sendsNamingRows) FileSubmission(ctx context.Context, formID, memberID, answeringAs, language, periodKey, channel, recordRowID, filedBy string, in []formsmodels.Answer) ([]formsmodels.Answer, error) {
	if err := s.refuseRowNotOwned(ctx, recordRowID, memberID); err != nil {
		return nil, err
	}
	return s.FormManager.FileSubmission(ctx, formID, memberID, answeringAs, language, periodKey, channel, recordRowID, filedBy, in)
}

func (s sendsNamingRows) lineage(ctx context.Context, recordRowID string) ([]string, error) {
	rows, _, err := s.read(ctx)
	if err != nil {
		return nil, err
	}
	return rowLineage(rows, recordRowID), nil
}

func (s sendsNamingRows) ListSubmissionsOfPerson(ctx context.Context, memberID, recordRowID string) ([]formsmodels.Submission, error) {
	if recordRowID == "" {
		return s.FormManager.ListSubmissionsOfPerson(ctx, memberID, "")
	}
	ids, err := s.lineage(ctx, recordRowID)
	if err != nil {
		return nil, err
	}
	var out []formsmodels.Submission
	for _, id := range ids {
		found, err := s.FormManager.ListSubmissionsOfPerson(ctx, memberID, id)
		if err != nil {
			return nil, err
		}
		out = append(out, found...)
	}
	sort.SliceStable(out, func(i, j int) bool {
		if out[i].SubmittedAt != out[j].SubmittedAt {
			return out[i].SubmittedAt > out[j].SubmittedAt
		}
		return out[i].ID < out[j].ID
	})
	return out, nil
}

func (s sendsNamingRows) ListSubmissions(ctx context.Context, formID, memberID, periodKey, recordRowID string) ([]formsmodels.Submission, error) {
	if recordRowID == "" {
		return s.FormManager.ListSubmissions(ctx, formID, memberID, periodKey, "")
	}
	ids, err := s.lineage(ctx, recordRowID)
	if err != nil {
		return nil, err
	}
	var out []formsmodels.Submission
	for _, id := range ids {
		found, err := s.FormManager.ListSubmissions(ctx, formID, memberID, periodKey, id)
		if err != nil {
			return nil, err
		}
		out = append(out, found...)
	}
	sort.SliceStable(out, func(i, j int) bool {
		if out[i].SubmittedAt != out[j].SubmittedAt {
			return out[i].SubmittedAt < out[j].SubmittedAt
		}
		return out[i].ID < out[j].ID
	})
	return out, nil
}
