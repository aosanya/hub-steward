package http

import (
	"context"
	"slices"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
)

func (c rowCodes) mayAddField(record agencymodels.Record, q agencymodels.StepQuestion) bool {
	if c[mwanachamaagency.RecordPermissionCode(record.Code, agencymodels.RowActionAdd, mwanachamaagency.RecordFieldStar)] {
		return true
	}
	return q.Code != "" && c[mwanachamaagency.RecordPermissionCode(record.Code, agencymodels.RowActionAdd, q.Code)]
}

func answerKeysOf(q agencymodels.StepQuestion) []string {
	return slices.DeleteFunc([]string{q.Key, q.Code, q.Prompt}, func(key string) bool { return key == "" })
}

func (w rowWrite) sendsAValueFor(q agencymodels.StepQuestion) bool {
	for _, key := range answerKeysOf(q) {
		if w.Answers[key] != "" || w.PlaceRefs[key] != "" {
			return true
		}
	}
	return false
}

func (d *Deps) addableAnswers(ctx context.Context, instanceID string, m mwanachamaagency.AgencyManager, record agencymodels.Record, write rowWrite) (rowWrite, error) {
	codes, err := d.callerRowCodes(ctx, instanceID, m)
	if err != nil {
		return rowWrite{}, err
	}
	for _, q := range record.Questions {
		if codes.mayAddField(record, q) {
			continue
		}
		if write.sendsAValueFor(q) {
			return rowWrite{}, badRowError(q.Prompt + " cannot be added by your role, so nothing was saved")
		}
		if q.Required {
			return rowWrite{}, badRowError(q.Prompt + " is required and your role cannot add it")
		}
	}
	return write, nil
}
