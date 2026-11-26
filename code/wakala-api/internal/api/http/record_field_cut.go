package http

import (
	"context"
	"slices"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
)

func (d *Deps) callerMayDoField(ctx context.Context, instanceID string, m mwanachamaagency.AgencyManager, record agencymodels.Record, action string, q agencymodels.StepQuestion) bool {
	field := q.Code
	if field == anyFieldOfRecord {
		field = mwanachamaagency.RecordFieldStar
	}
	return d.callerMayDoRow(ctx, instanceID, m, record, action, field, nil)
}

func (d *Deps) questionsHeldFor(ctx context.Context, instanceID string, m mwanachamaagency.AgencyManager, record agencymodels.Record, action string) []agencymodels.StepQuestion {
	out := []agencymodels.StepQuestion{}
	for _, q := range record.Questions {
		if d.callerMayDoField(ctx, instanceID, m, record, action, q) {
			out = append(out, q)
		}
	}
	return out
}

func identitiesOf(q agencymodels.StepQuestion) []string {
	out := []string{}
	for _, name := range []string{q.Key, q.Code, q.Prompt} {
		if name != "" {
			out = append(out, name)
		}
	}
	return out
}

func withoutFields[V any](kept map[string]V, hidden []agencymodels.StepQuestion) map[string]V {
	if kept == nil {
		return nil
	}
	out := make(map[string]V, len(kept))
	for name, value := range kept {
		out[name] = value
	}
	for _, q := range hidden {
		for _, name := range identitiesOf(q) {
			delete(out, name)
		}
	}
	return out
}

func rowSeenThrough(row agencymodels.RecordRow, hidden []agencymodels.StepQuestion) agencymodels.RecordRow {
	row.Answers = withoutFields(row.Answers, hidden)
	row.PlaceRefs = withoutFields(row.PlaceRefs, hidden)
	return row
}

func questionsOutside(all, seen []agencymodels.StepQuestion) []agencymodels.StepQuestion {
	return slices.DeleteFunc(slices.Clone(all), func(q agencymodels.StepQuestion) bool {
		return slices.ContainsFunc(seen, func(s agencymodels.StepQuestion) bool { return fieldIdentity(s) == fieldIdentity(q) })
	})
}

func refuseHiddenConditions(constraints []rowConstraint, hidden []agencymodels.StepQuestion) error {
	for i, c := range constraints {
		if slices.ContainsFunc(hidden, func(q agencymodels.StepQuestion) bool { return fieldIdentity(q) == fieldIdentity(c.question) }) {
			return refusedCondition(i+1, "names "+echoed(c.question.Prompt)+", a field the caller does not hold view for")
		}
	}
	return nil
}

func refuseHiddenPeople(record agencymodels.Record, seen []agencymodels.StepQuestion) error {
	people := slices.DeleteFunc(slices.Clone(record.Questions), func(q agencymodels.StepQuestion) bool { return !picksAPerson(q) })
	if len(people) > 0 && !slices.ContainsFunc(people, func(p agencymodels.StepQuestion) bool {
		return slices.ContainsFunc(seen, func(s agencymodels.StepQuestion) bool { return fieldIdentity(s) == fieldIdentity(p) })
	}) {
		return badRowError("answer_actor_id filters on " + echoed(people[0].Prompt) + ", a field the caller does not hold view for")
	}
	return nil
}

func addFieldsOf(adding []agencymodels.StepQuestion) []string {
	out := []string{}
	for _, q := range adding {
		if q.Code != "" {
			out = append(out, q.Code)
		}
	}
	return out
}

func questionsOf(record agencymodels.Record, viewing, adding []agencymodels.StepQuestion) []agencymodels.StepQuestion {
	out := []agencymodels.StepQuestion{}
	for _, q := range record.Questions {
		if slices.ContainsFunc(viewing, func(s agencymodels.StepQuestion) bool { return fieldIdentity(s) == fieldIdentity(q) }) ||
			slices.ContainsFunc(adding, func(s agencymodels.StepQuestion) bool { return fieldIdentity(s) == fieldIdentity(q) }) {
			out = append(out, q)
		}
	}
	return out
}
