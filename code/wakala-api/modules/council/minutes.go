package mwanachamacouncil

import (
	"context"
	"fmt"
	"strings"

	"wakalaserver/modules/council/models"
)

const roleMinutes = "minutes"

type Minutes = models.Minutes

type MinutesKey struct {
	InstanceID string `query:"instance_id"`
	MeetingID  string `query:"meeting_id"`
}

func (m *councilManager) SetMinutes(ctx context.Context, in models.Minutes) (models.Minutes, error) {
	in.Text = strings.TrimSpace(in.Text)
	in.ID = ""
	in.CreatedAt = ""
	in.UpdatedAt = ""
	if err := check(m.st.Object(roleMinutes), in); err != nil {
		return models.Minutes{}, fmt.Errorf("%w: %s", ErrInvalidMinutes, err)
	}
	if _, err := m.GetMeeting(ctx, MeetingKey{InstanceID: in.InstanceID, ID: in.MeetingID}); err != nil {
		return models.Minutes{}, err
	}

	now := formatTime(m.clock())
	var out models.Minutes
	err := m.st.InTransaction(ctx, func(tx *store) error {
		q := tx.Query(ctx, roleMinutes).Where("instance_id = ? AND meeting_id = ?", in.InstanceID, in.MeetingID)
		switch err := tx.Take(q, roleMinutes, &out, ErrMinutesNotFound); err {
		case nil:
			out.Text = in.Text
			out.UpdatedAt = now
			row, err := tx.Row(roleMinutes, out)
			if err != nil {
				return err
			}
			delete(row, "id")
			return tx.Query(ctx, roleMinutes).Where("id = ?", out.ID).Updates(row).Error
		case ErrMinutesNotFound:
			in.ID = newID()
			in.CreatedAt = now
			in.UpdatedAt = now
			out = in
			return tx.Insert(ctx, roleMinutes, in)
		default:
			return err
		}
	})
	if err != nil {
		return models.Minutes{}, fmt.Errorf("SetMinutes: %w", err)
	}
	return out, nil
}

func (m *councilManager) GetMinutes(ctx context.Context, key MinutesKey) (models.Minutes, error) {
	if key.InstanceID == "" {
		return models.Minutes{}, fmt.Errorf("%w: instance_id is required", ErrInvalidMinutes)
	}
	if key.MeetingID == "" {
		return models.Minutes{}, fmt.Errorf("%w: the meeting id is required", ErrInvalidMinutes)
	}
	var out models.Minutes
	q := m.st.Query(ctx, roleMinutes).Where("meeting_id = ? AND instance_id = ?", key.MeetingID, key.InstanceID)
	if err := m.st.Take(q, roleMinutes, &out, ErrMinutesNotFound); err != nil {
		if err == ErrMinutesNotFound {
			return models.Minutes{}, err
		}
		return models.Minutes{}, fmt.Errorf("GetMinutes: %w", err)
	}
	return out, nil
}
