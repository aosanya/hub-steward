package mwanachamacouncil

import (
	"context"
	"fmt"
	"strings"
	"time"

	"wakalaserver/modules/council/models"
	"wakalaserver/modules/shared/versioncheck"
)

const roleAgenda = "agenda"

type Agenda = models.Agenda

type AgendaKey struct {
	InstanceID string `query:"instance_id"`
	MeetingID  string `query:"meeting_id"`
}

type AgendaSet struct {
	InstanceID string   `json:"instance_id"`
	MeetingID  string   `json:"meeting_id"`
	Items      []string `json:"items"`
	Version    string   `json:"version"`
}

func (m *councilManager) SetAgenda(ctx context.Context, set AgendaSet) (models.Agenda, error) {
	items, err := cleanItems(set.Items)
	if err != nil {
		return models.Agenda{}, fmt.Errorf("%w: %s", ErrInvalidAgenda, err)
	}
	in := models.Agenda{InstanceID: set.InstanceID, MeetingID: set.MeetingID, Items: items}
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
			if err := staleAgenda(set.Version, out, in); err != nil {
				return err
			}
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
		if _, stale := versioncheck.IsStale(err); stale {
			return models.Agenda{}, err
		}
		return models.Agenda{}, fmt.Errorf("SetAgenda: %w", err)
	}
	return out, nil
}

func staleAgenda(version string, stored, sent models.Agenda) error {
	updatedAt, _ := time.Parse(time.RFC3339Nano, stored.UpdatedAt)
	return versioncheck.Stale(version, updatedAt, []versioncheck.Field{
		{Name: "items", Sent: strings.Join(sent.Items, "\n"), Stored: strings.Join(stored.Items, "\n")},
	})
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
