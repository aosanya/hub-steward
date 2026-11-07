package engage

import (
	"context"
	"fmt"
	"time"
	"wakalaserver/modules/shared/consent"

	"wakalaserver/modules/engage/models"
)

func (m *postManager) AnswerRSVP(ctx context.Context, in RSVP) (RSVP, error) {
	if in.ParticipantID == "" {
		return RSVP{}, ErrNoResponder
	}
	if err := consent.Require(ctx, m.consent, in.ParticipantID); err != nil {
		return RSVP{}, err
	}
	if err := m.checks(objectRSVP, in, ErrInvalidRSVP); err != nil {
		return RSVP{}, err
	}
	p, err := m.GetPost(ctx, in.PostID)
	if err != nil {
		return RSVP{}, err
	}
	reaches, err := m.reaches(ctx, in.ParticipantID, p)
	if err != nil {
		return RSVP{}, err
	}
	if !reaches {
		return RSVP{}, ErrPostNotFound
	}
	if p.Kind != models.KindEvent || p.State != models.StateSent {
		return RSVP{}, ErrNotAnOpenEvent
	}
	if hasStarted(p.StartsAt, m.now()) {
		return RSVP{}, ErrEventStarted
	}
	in.AnsweredAt = m.now()
	var existing RSVP
	q := m.st.Query(ctx, objectRSVP).Where("post_id = ? AND participant_id = ?", in.PostID, in.ParticipantID)
	if err := m.st.Take(q, objectRSVP, &existing, ErrPostNotFound); err == nil {
		in.ID = existing.ID
		upd := m.st.Query(ctx, objectRSVP).Where("id = ?", existing.ID)
		if err := upd.Updates(map[string]any{"answer": in.Answer, "answered_at": in.AnsweredAt}).Error; err != nil {
			return RSVP{}, fmt.Errorf("AnswerRSVP: %w", err)
		}
		return in, nil
	}
	in.ID = newID()
	if err := m.st.Insert(ctx, objectRSVP, in); err != nil {
		return RSVP{}, fmt.Errorf("AnswerRSVP: %w", err)
	}
	return in, nil
}

func hasStarted(startsAt, now string) bool {
	s, err := time.Parse(time.RFC3339, startsAt)
	if err != nil {
		return true
	}
	n, err := time.Parse(time.RFC3339, now)
	if err != nil {
		return true
	}
	return !n.Before(s)
}
