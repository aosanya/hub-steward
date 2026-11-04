package mwanachamaagency

import (
	"context"
	"fmt"

	"wakalaserver/modules/agency/models"
)

const agencyPickerName = "The agency"

type GroupLister func(ctx context.Context) ([]models.PickerActor, error)

func WithGroupLister(list GroupLister) Option {
	return func(m *agencyManager) { m.groups = list }
}

func (m *agencyManager) ListPickers(ctx context.Context, draftID string) (models.Pickers, error) {
	roles, err := m.ListRoles(ctx, draftID, RoleFilter{})
	if err != nil {
		return models.Pickers{}, fmt.Errorf("ListPickers: %w", err)
	}
	agency := models.PickerActor{Name: agencyPickerName, Kind: models.PickerAgency}
	if a, err := m.GetAgency(ctx); err == nil {
		agency.ID = a.ID
	}
	out := models.Pickers{Actors: []models.PickerActor{agency}, AnswerTypes: models.AnswerTypes()}
	for _, r := range roles {
		out.Actors = append(out.Actors, models.PickerActor{ID: r.ID, Name: r.Name, Kind: models.PickerRole})
	}
	if m.groups == nil {
		return out, nil
	}
	groups, err := m.groups(ctx)
	if err != nil {
		return models.Pickers{}, fmt.Errorf("ListPickers: the groups: %w", err)
	}
	for _, g := range groups {
		out.Actors = append(out.Actors, models.PickerActor{ID: g.ID, Name: g.Name, Kind: models.PickerGroup})
	}
	return out, nil
}
