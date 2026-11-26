package http

import (
	"context"
	"sort"

	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
)

type memberChoice struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

func asksForAPerson(questions []agencymodels.StepQuestion) bool {
	for _, q := range questions {
		if picksAPerson(q) {
			return true
		}
	}
	return false
}

func (d *Deps) memberChoices(ctx context.Context, instanceID string) ([]memberChoice, error) {
	directory, err := d.Registry.ActorManager(ctx, instanceID)
	if err != nil {
		return nil, err
	}
	actors, err := directory.ListActors(ctx)
	if err != nil {
		return nil, err
	}
	choices := make([]memberChoice, 0, len(actors))
	for _, a := range actors {
		if !a.Deleted {
			choices = append(choices, memberChoice{ID: a.ID, Name: personNameOf(a)})
		}
	}
	sort.SliceStable(choices, func(i, j int) bool { return choices[i].Name < choices[j].Name })
	return choices, nil
}

func namesOf(choices []memberChoice) map[string]string {
	names := make(map[string]string, len(choices))
	for _, c := range choices {
		names[c.ID] = c.Name
	}
	return names
}

func (d *Deps) withMembers(ctx context.Context, instanceID string, listed openSteps) (openSteps, error) {
	var choices []memberChoice
	for i, item := range listed.Items {
		if !asksForAPerson(item.Questions) {
			continue
		}
		if choices == nil {
			var err error
			if choices, err = d.memberChoices(ctx, instanceID); err != nil {
				return openSteps{}, err
			}
		}
		listed.Items[i].Members = choices
	}
	return listed, nil
}

func (d *Deps) peopleNamedInRecords(ctx context.Context, instanceID string, records []agencymodels.Record) (map[string]string, error) {
	for _, r := range records {
		if !r.Deleted && asksForAPerson(r.Questions) {
			choices, err := d.memberChoices(ctx, instanceID)
			return namesOf(choices), err
		}
	}
	return nil, nil
}
