package mwanachamacouncil

import (
	"context"
	"fmt"
	"slices"
	"strings"

	"wakalaserver/modules/council/models"
	"github.com/aosanya/mwanachama-backend-shared/specstore"
)

const roleResolution = "resolution"

type Resolution = models.Resolution

type ResolutionFilter struct {
	InstanceID string `query:"instance_id"`
	MeetingID  string `query:"meeting_id"`
	Outcome    string `query:"outcome"`
}

type ResolutionKey struct {
	InstanceID string `query:"instance_id"`
	ID         string `query:"id"`
}

func (m *councilManager) CreateResolution(ctx context.Context, in models.Resolution) (models.Resolution, error) {
	in.ID = ""
	in.CreatedAt = ""
	in.Title = strings.TrimSpace(in.Title)
	if err := check(m.st.Object(roleResolution), in); err != nil {
		return models.Resolution{}, fmt.Errorf("%w: %s", ErrInvalidResolution, err)
	}
	if err := m.checkOutcome(in.Outcome); err != nil {
		return models.Resolution{}, err
	}
	if in.MeetingID != "" {
		if _, err := m.GetMeeting(ctx, MeetingKey{InstanceID: in.InstanceID, ID: in.MeetingID}); err != nil {
			return models.Resolution{}, err
		}
	}
	in.ID = newID()
	in.CreatedAt = formatTime(m.clock())

	if err := m.st.Insert(ctx, roleResolution, in); err != nil {
		return models.Resolution{}, fmt.Errorf("CreateResolution: %w", err)
	}
	return in, nil
}

func (m *councilManager) ListResolutions(ctx context.Context, filter ResolutionFilter) ([]models.Resolution, error) {
	if filter.InstanceID == "" {
		return nil, fmt.Errorf("%w: instance_id is required", ErrInvalidResolution)
	}
	q := m.st.Query(ctx, roleResolution).Where("instance_id = ?", filter.InstanceID)
	if filter.MeetingID != "" {
		q = q.Where("meeting_id = ?", filter.MeetingID)
	}
	if filter.Outcome != "" {
		q = q.Where("outcome = ?", filter.Outcome)
	}
	out, err := specstore.List[models.Resolution](m.st, q.Order("date asc").Order("created_at asc"), roleResolution)
	if err != nil {
		return nil, fmt.Errorf("ListResolutions: %w", err)
	}
	return out, nil
}

func (m *councilManager) GetResolution(ctx context.Context, key ResolutionKey) (models.Resolution, error) {
	if key.InstanceID == "" {
		return models.Resolution{}, fmt.Errorf("%w: instance_id is required", ErrInvalidResolution)
	}
	if key.ID == "" {
		return models.Resolution{}, fmt.Errorf("%w: the resolution id is required", ErrInvalidResolution)
	}
	var out models.Resolution
	q := m.st.Query(ctx, roleResolution).Where("id = ? AND instance_id = ?", key.ID, key.InstanceID)
	if err := m.st.Take(q, roleResolution, &out, ErrResolutionNotFound); err != nil {
		if err == ErrResolutionNotFound {
			return models.Resolution{}, err
		}
		return models.Resolution{}, fmt.Errorf("GetResolution: %w", err)
	}
	return out, nil
}

func (m *councilManager) checkOutcome(outcome string) error {
	for _, f := range m.st.Object(roleResolution).Fields {
		if f.Name == "outcome" && !slices.Contains(f.Values, outcome) {
			return fmt.Errorf("%w: outcome must be one of %s", ErrInvalidResolution, strings.Join(f.Values, ", "))
		}
	}
	return nil
}
