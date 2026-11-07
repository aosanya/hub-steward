package engage

import (
	"context"
	"fmt"
	"time"

	"wakalaserver/modules/shared/consent"
	"wakalaserver/modules/shared/specstore"

	"wakalaserver/modules/engage/models"
)

type EventChange struct {
	PostID    string `json:"post_id"`
	ChangedBy string `json:"changed_by,omitempty"`
	StartsAt  string `json:"starts_at,omitempty"`
	EndsAt    string `json:"ends_at,omitempty"`
	TimeZone  string `json:"time_zone,omitempty"`
	Place     string `json:"place,omitempty"`
}

type Changed struct {
	Post           Post     `json:"post"`
	ParticipantIDs []string `json:"participant_ids"`
}

func (m *postManager) ChangeEvent(ctx context.Context, in EventChange) (Changed, error) {
	p, err := m.openEvent(ctx, in.PostID, in.ChangedBy)
	if err != nil {
		return Changed{}, err
	}
	if in.StartsAt != "" {
		p.StartsAt = in.StartsAt
	}
	if in.EndsAt != "" {
		p.EndsAt = in.EndsAt
	}
	if in.TimeZone != "" {
		p.TimeZone = in.TimeZone
	}
	if in.Place != "" {
		p.Place = in.Place
	}
	if err := m.checks(objectPost, p, ErrInvalidPost); err != nil {
		return Changed{}, err
	}
	if err := postHolds(p); err != nil {
		return Changed{}, fmt.Errorf("%w: %s", ErrInvalidPost, err)
	}
	cols := map[string]any{"starts_at": p.StartsAt, "ends_at": p.EndsAt, "time_zone": p.TimeZone, "place": p.Place}
	return m.settle(ctx, p, cols)
}

func (m *postManager) CancelEvent(ctx context.Context, postID, callerID string) (Changed, error) {
	p, err := m.openEvent(ctx, postID, callerID)
	if err != nil {
		return Changed{}, err
	}
	p.State = models.StateCancelled
	return m.settle(ctx, p, map[string]any{"state": models.StateCancelled})
}

func (m *postManager) openEvent(ctx context.Context, postID, callerID string) (Post, error) {
	if callerID == "" {
		return Post{}, ErrNoPoster
	}
	p, err := m.GetPost(ctx, postID)
	if err != nil {
		return Post{}, err
	}
	if p.Kind != models.KindEvent || p.State != models.StateSent {
		return Post{}, ErrNotAnOpenEvent
	}
	return p, nil
}

func (m *postManager) settle(ctx context.Context, p Post, cols map[string]any) (Changed, error) {
	upd := m.st.Query(ctx, objectPost).Where("id = ? AND state = ?", p.ID, models.StateSent)
	if err := upd.Updates(cols).Error; err != nil {
		return Changed{}, fmt.Errorf("settle: %w", err)
	}
	q := m.st.Query(ctx, objectRSVP).Where("post_id = ? AND answer = ?", p.ID, models.AnswerGoing)
	going, err := specstore.List[RSVP](m.st, q, objectRSVP)
	if err != nil {
		return Changed{}, fmt.Errorf("settle: %w", err)
	}
	ids := make([]string, 0, len(going))
	for _, r := range going {
		ids = append(ids, r.ParticipantID)
	}
	return Changed{Post: p, ParticipantIDs: ids}, nil
}

func (m *postManager) CheckInSelf(ctx context.Context, postID, participantID string) (Attendance, error) {
	if participantID == "" {
		return Attendance{}, ErrNoAttendee
	}
	if err := consent.Require(ctx, m.consent, participantID); err != nil {
		return Attendance{}, err
	}
	p, err := m.reachedEvent(ctx, postID, participantID)
	if err != nil {
		return Attendance{}, err
	}
	if !within(p.StartsAt, p.EndsAt, m.now()) {
		return Attendance{}, ErrOutsideEvent
	}
	return m.tick(ctx, p.ID, participantID, participantID)
}

func (m *postManager) CheckIn(ctx context.Context, postID, participantID, callerID string) (Attendance, error) {
	if callerID == "" {
		return Attendance{}, ErrNoAttendee
	}
	if err := consent.Require(ctx, m.consent, participantID); err != nil {
		return Attendance{}, err
	}
	p, err := m.reachedEvent(ctx, postID, participantID)
	if err != nil {
		return Attendance{}, err
	}
	if !onTheDay(p, m.now()) {
		return Attendance{}, ErrOutsideEvent
	}
	return m.tick(ctx, p.ID, participantID, callerID)
}

func (m *postManager) Untick(ctx context.Context, postID, participantID, callerID string) (Attendance, error) {
	if callerID == "" {
		return Attendance{}, ErrNoAttendee
	}
	var a Attendance
	q := m.st.Query(ctx, objectAttendance).Where("post_id = ? AND participant_id = ?", postID, participantID)
	if err := m.st.Take(q, objectAttendance, &a, ErrNotCheckedIn); err != nil {
		return Attendance{}, err
	}
	if err := m.st.Query(ctx, objectAttendance).Where("id = ?", a.ID).Updates(map[string]any{"unticked": true}).Error; err != nil {
		return Attendance{}, fmt.Errorf("Untick: %w", err)
	}
	a.Unticked = true
	return a, nil
}

func (m *postManager) reachedEvent(ctx context.Context, postID, participantID string) (Post, error) {
	p, err := m.GetPost(ctx, postID)
	if err != nil {
		return Post{}, err
	}
	reaches, err := m.reaches(ctx, participantID, p)
	if err != nil {
		return Post{}, err
	}
	if !reaches {
		return Post{}, ErrPostNotFound
	}
	if p.Kind != models.KindEvent || p.State != models.StateSent {
		return Post{}, ErrNotAnOpenEvent
	}
	return p, nil
}

func (m *postManager) tick(ctx context.Context, postID, participantID, by string) (Attendance, error) {
	now := m.now()
	var existing Attendance
	q := m.st.Query(ctx, objectAttendance).Where("post_id = ? AND participant_id = ?", postID, participantID)
	if err := m.st.Take(q, objectAttendance, &existing, ErrNotCheckedIn); err == nil {
		cols := map[string]any{"checked_in_at": now, "checked_in_by": by, "unticked": false}
		if err := m.st.Query(ctx, objectAttendance).Where("id = ?", existing.ID).Updates(cols).Error; err != nil {
			return Attendance{}, fmt.Errorf("tick: %w", err)
		}
		existing.CheckedInAt, existing.CheckedInBy, existing.Unticked = now, by, false
		return existing, nil
	}
	a := Attendance{ID: newID(), PostID: postID, ParticipantID: participantID, CheckedInAt: now, CheckedInBy: by}
	if err := m.st.Insert(ctx, objectAttendance, a); err != nil {
		return Attendance{}, fmt.Errorf("tick: %w", err)
	}
	return a, nil
}

func within(startsAt, endsAt, now string) bool {
	return hasStarted(startsAt, now) && !hasStarted(endsAt, now)
}

func onTheDay(p Post, now string) bool {
	loc, err := time.LoadLocation(p.TimeZone)
	if err != nil {
		loc = time.UTC
	}
	s, err := time.Parse(time.RFC3339, p.StartsAt)
	if err != nil {
		return false
	}
	n, err := time.Parse(time.RFC3339, now)
	if err != nil {
		return false
	}
	return s.In(loc).Format(time.DateOnly) == n.In(loc).Format(time.DateOnly)
}
