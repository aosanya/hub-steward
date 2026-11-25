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

func (d *Deps) addableAnswers(ctx context.Context, instanceID string, m mwanachamaagency.AgencyManager, record agencymodels.Record, write rowWrite) (rowWrite, error) {
	codes, err := d.callerRowCodes(ctx, instanceID, m)
	if err != nil {
		return rowWrite{}, err
	}
	answers := make(map[string]string, len(write.Answers))
	for key, text := range write.Answers {
		answers[key] = text
	}
	var placeRefs map[string]string
	if write.PlaceRefs != nil {
		placeRefs = make(map[string]string, len(write.PlaceRefs))
		for key, ref := range write.PlaceRefs {
			placeRefs[key] = ref
		}
	}
	for _, q := range record.Questions {
		if codes.mayAddField(record, q) {
			continue
		}
		if q.Required {
			return rowWrite{}, badRowError(q.Prompt + " is required and your role cannot add it")
		}
		for _, key := range answerKeysOf(q) {
			delete(answers, key)
			delete(placeRefs, key)
		}
	}
	write.Answers, write.PlaceRefs = answers, placeRefs
	return write, nil
}
