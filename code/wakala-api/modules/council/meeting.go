package mwanachamacouncil

import (
	"context"
	"fmt"
	"strings"

	"gorm.io/gorm"

	"github.com/aosanya/mwanachama-backend-shared/spec"
	"github.com/aosanya/mwanachama-backend-shared/specstore"
	"wakalaserver/modules/council/models"
)

type Meeting = models.Meeting

type MeetingFilter struct {
	InstanceID string `query:"instance_id"`
	Committee  string `query:"committee"`
}

type MeetingKey struct {
	InstanceID string `query:"instance_id"`
	ID         string `query:"id"`
}

type CouncilManager interface {
	CreateMeeting(ctx context.Context, m models.Meeting) (models.Meeting, error)
	ListMeetings(ctx context.Context, filter MeetingFilter) ([]models.Meeting, error)
	GetMeeting(ctx context.Context, key MeetingKey) (models.Meeting, error)
	UpdateMeeting(ctx context.Context, in MeetingUpdate) (models.Meeting, error)
	UpdateResolution(ctx context.Context, in ResolutionUpdate) (models.Resolution, error)
	UpdateBylaw(ctx context.Context, in BylawUpdate) (models.Bylaw, error)
	SetAgenda(ctx context.Context, in AgendaSet) (models.Agenda, error)
	GetAgenda(ctx context.Context, key AgendaKey) (models.Agenda, error)
	SetMinutes(ctx context.Context, in MinutesSet) (models.Minutes, error)
	GetMinutes(ctx context.Context, key MinutesKey) (models.Minutes, error)
	CreateBylaw(ctx context.Context, in models.Bylaw) (models.Bylaw, error)
	ListBylaws(ctx context.Context, filter BylawFilter) ([]models.Bylaw, error)
	GetBylaw(ctx context.Context, key BylawKey) (models.Bylaw, error)
	CreateResolution(ctx context.Context, in models.Resolution) (models.Resolution, error)
	ListResolutions(ctx context.Context, filter ResolutionFilter) ([]models.Resolution, error)
	GetResolution(ctx context.Context, key ResolutionKey) (models.Resolution, error)
}

type councilManager struct {
	st    *store
	clock Clock
}

func NewCouncilManager(db *gorm.DB, s *spec.Spec) (CouncilManager, error) {
	return NewCouncilManagerWithClock(db, s, SystemClock)
}

func NewCouncilManagerWithClock(db *gorm.DB, s *spec.Spec, clock Clock) (CouncilManager, error) {
	if db == nil {
		return nil, fmt.Errorf("NewCouncilManager: db must not be nil")
	}
	if clock == nil {
		return nil, fmt.Errorf("NewCouncilManager: clock must not be nil")
	}
	st, err := newStore(db, s, map[string]any{roleMeeting: models.Meeting{}, roleAgenda: models.Agenda{}, roleMinutes: models.Minutes{}, roleBylaw: models.Bylaw{}, roleResolution: models.Resolution{}})
	if err != nil {
		return nil, fmt.Errorf("NewCouncilManager: %w", err)
	}
	return &councilManager{st: st, clock: clock}, nil
}

func (m *councilManager) CreateMeeting(ctx context.Context, in models.Meeting) (models.Meeting, error) {
	in.ID = ""
	in.CreatedAt = ""
	in.Name = strings.TrimSpace(in.Name)
	if err := check(m.st.Object(roleMeeting), in); err != nil {
		return models.Meeting{}, fmt.Errorf("%w: %s", ErrInvalidMeeting, err)
	}
	in.ID = newID()
	in.CreatedAt = formatTime(m.clock())

	if err := m.st.Insert(ctx, roleMeeting, in); err != nil {
		return models.Meeting{}, fmt.Errorf("CreateMeeting: %w", err)
	}
	return in, nil
}

func (m *councilManager) ListMeetings(ctx context.Context, filter MeetingFilter) ([]models.Meeting, error) {
	if filter.InstanceID == "" {
		return nil, fmt.Errorf("%w: instance_id is required", ErrInvalidMeeting)
	}
	q := m.st.Query(ctx, roleMeeting).Where("instance_id = ?", filter.InstanceID)
	if filter.Committee != "" {
		q = q.Where("committee = ?", filter.Committee)
	}
	out, err := specstore.List[models.Meeting](m.st, q.Order("date asc").Order("created_at asc"), roleMeeting)
	if err != nil {
		return nil, fmt.Errorf("ListMeetings: %w", err)
	}
	return out, nil
}

func (m *councilManager) GetMeeting(ctx context.Context, key MeetingKey) (models.Meeting, error) {
	if key.InstanceID == "" {
		return models.Meeting{}, fmt.Errorf("%w: instance_id is required", ErrInvalidMeeting)
	}
	if key.ID == "" {
		return models.Meeting{}, fmt.Errorf("%w: the meeting id is required", ErrInvalidMeeting)
	}
	var out models.Meeting
	q := m.st.Query(ctx, roleMeeting).Where("id = ? AND instance_id = ?", key.ID, key.InstanceID)
	if err := m.st.Take(q, roleMeeting, &out, ErrMeetingNotFound); err != nil {
		if err == ErrMeetingNotFound {
			return models.Meeting{}, err
		}
		return models.Meeting{}, fmt.Errorf("GetMeeting: %w", err)
	}
	return out, nil
}
