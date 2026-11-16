package mwanachamacouncil

import (
	"context"
	"fmt"
	"strings"

	"wakalaserver/modules/council/models"
)

const roleAgenda = "agenda"

type Agenda = models.Agenda

type AgendaKey struct {
	InstanceID string `query:"instance_id"`
	MeetingID  string `query:"meeting_id"`
}

func (m *councilManager) SetAgenda(ctx context.Context, in models.Agenda) (models.Agenda, error) {
	items, err := cleanItems(in.Items)
	if err != nil {
		return models.Agenda{}, fmt.Errorf("%w: %s", ErrInvalidAgenda, err)
	}
	in.Items = items
	in.ID = ""
	in.CreatedAt = ""
	in.UpdatedAt = ""
	if err := check(m.st.Object(roleAgenda), in); err != nil {
		return models.Agenda{}, fmt.Errorf("%w: %s", ErrInvalidAgenda, err)
	}
	if _, err := m.GetMeeting(ctx, MeetingKey{InstanceID: in.InstanceID, ID: in.MeetingID}); err != nil {
		return models.Agenda{}, err
	}

	now := formatTime(m.clock())
	var out models.Agenda
	err = m.st.InTransaction(ctx, func(tx *store) error {
		q := tx.Query(ctx, roleAgenda).Where("instance_id = ? AND meeting_id = ?", in.InstanceID, in.MeetingID)
		switch err := tx.Take(q, roleAgenda, &out, ErrAgendaNotFound); err {
		case nil:
			out.Items = in.Items
			out.UpdatedAt = now
			row, err := tx.Row(roleAgenda, out)
			if err != nil {
				return err
			}
			delete(row, "id")
			return tx.Query(ctx, roleAgenda).Where("id = ?", out.ID).Updates(row).Error
		case ErrAgendaNotFound:
			in.ID = newID()
			in.CreatedAt = now
			in.UpdatedAt = now
			out = in
			return tx.Insert(ctx, roleAgenda, in)
		default:
			return err
		}
	})
	if err != nil {
		return models.Agenda{}, fmt.Errorf("SetAgenda: %w", err)
	}
	return out, nil
}

func (m *councilManager) GetAgenda(ctx context.Context, key AgendaKey) (models.Agenda, error) {
	if key.InstanceID == "" {
		return models.Agenda{}, fmt.Errorf("%w: instance_id is required", ErrInvalidAgenda)
	}
	if key.MeetingID == "" {
		return models.Agenda{}, fmt.Errorf("%w: the meeting id is required", ErrInvalidAgenda)
	}
	var out models.Agenda
	q := m.st.Query(ctx, roleAgenda).Where("meeting_id = ? AND instance_id = ?", key.MeetingID, key.InstanceID)
	if err := m.st.Take(q, roleAgenda, &out, ErrAgendaNotFound); err != nil {
		if err == ErrAgendaNotFound {
			return models.Agenda{}, err
		}
		return models.Agenda{}, fmt.Errorf("GetAgenda: %w", err)
	}
	return out, nil
}

func cleanItems(items []string) ([]string, error) {
	out := make([]string, 0, len(items))
	for _, item := range items {
		item = strings.TrimSpace(item)
		if item == "" {
			return nil, fmt.Errorf("an agenda item is blank")
		}
		out = append(out, item)
	}
	if len(out) == 0 {
		return nil, fmt.Errorf("an agenda needs at least one item")
	}
	return out, nil
}
