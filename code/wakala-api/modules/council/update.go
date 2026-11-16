package mwanachamacouncil

import (
	"context"
	"fmt"
	"strings"

	"wakalaserver/modules/council/models"
)

type MeetingUpdate struct {
	InstanceID string `json:"instance_id"`
	ID         string `json:"id"`
	Name       string `json:"name"`
	Date       string `json:"date"`
	Place      string `json:"place"`
	Committee  string `json:"committee"`
}

type ResolutionUpdate struct {
	InstanceID string `json:"instance_id"`
	ID         string `json:"id"`
	Title      string `json:"title"`
	Date       string `json:"date"`
	Outcome    string `json:"outcome"`
}

type BylawUpdate struct {
	InstanceID string `json:"instance_id"`
	ID         string `json:"id"`
	Title      string `json:"title"`
	Year       int64  `json:"year"`
	Text       string `json:"text"`
}

func (m *councilManager) write(ctx context.Context, role, id string, record any) error {
	row, err := m.st.Row(role, record)
	if err != nil {
		return err
	}
	delete(row, "id")
	delete(row, "instance_id")
	delete(row, "created_at")
	return m.st.Query(ctx, role).Where("id = ?", id).Updates(row).Error
}

func (m *councilManager) UpdateMeeting(ctx context.Context, in MeetingUpdate) (models.Meeting, error) {
	current, err := m.GetMeeting(ctx, MeetingKey{InstanceID: in.InstanceID, ID: in.ID})
	if err != nil {
		return models.Meeting{}, err
	}
	current.Name = strings.TrimSpace(in.Name)
	current.Date = in.Date
	current.Place = in.Place
	current.Committee = in.Committee
	if err := check(m.st.Object(roleMeeting), current); err != nil {
		return models.Meeting{}, fmt.Errorf("%w: %s", ErrInvalidMeeting, err)
	}
	if err := m.write(ctx, roleMeeting, current.ID, current); err != nil {
		return models.Meeting{}, fmt.Errorf("UpdateMeeting: %w", err)
	}
	return current, nil
}

func (m *councilManager) UpdateResolution(ctx context.Context, in ResolutionUpdate) (models.Resolution, error) {
	current, err := m.GetResolution(ctx, ResolutionKey{InstanceID: in.InstanceID, ID: in.ID})
	if err != nil {
		return models.Resolution{}, err
	}
	current.Title = strings.TrimSpace(in.Title)
	current.Date = in.Date
	current.Outcome = in.Outcome
	if err := check(m.st.Object(roleResolution), current); err != nil {
		return models.Resolution{}, fmt.Errorf("%w: %s", ErrInvalidResolution, err)
	}
	if err := m.checkOutcome(current.Outcome); err != nil {
		return models.Resolution{}, err
	}
	if err := m.write(ctx, roleResolution, current.ID, current); err != nil {
		return models.Resolution{}, fmt.Errorf("UpdateResolution: %w", err)
	}
	return current, nil
}

func (m *councilManager) UpdateBylaw(ctx context.Context, in BylawUpdate) (models.Bylaw, error) {
	current, err := m.GetBylaw(ctx, BylawKey{InstanceID: in.InstanceID, ID: in.ID})
	if err != nil {
		return models.Bylaw{}, err
	}
	current.Title = strings.TrimSpace(in.Title)
	current.Year = in.Year
	current.Text = strings.TrimSpace(in.Text)
	if err := check(m.st.Object(roleBylaw), current); err != nil {
		return models.Bylaw{}, fmt.Errorf("%w: %s", ErrInvalidBylaw, err)
	}
	if current.Year < firstBylawYear || current.Year > lastBylawYear {
		return models.Bylaw{}, fmt.Errorf("%w: year must be a four-digit year", ErrInvalidBylaw)
	}
	if err := m.write(ctx, roleBylaw, current.ID, current); err != nil {
		return models.Bylaw{}, fmt.Errorf("UpdateBylaw: %w", err)
	}
	return current, nil
}
