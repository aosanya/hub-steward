package engage

import (
	"context"
	"fmt"

	"wakalaserver/modules/shared/specstore"
)

const hiddenRows = "participant_id = ? AND withdrawn_at <> ''"

type Hidden struct {
	RSVPs  []RSVP  `json:"rsvps"`
	Offers []Offer `json:"offers"`
}

func (m *postManager) ReleaseParticipant(ctx context.Context, participantID string) error {
	if participantID == "" {
		return ErrNoResponder
	}
	at := map[string]any{"withdrawn_at": m.now()}
	if err := m.st.Query(ctx, objectRSVP).Where("participant_id = ? AND withdrawn_at = ''", participantID).Updates(at).Error; err != nil {
		return fmt.Errorf("ReleaseParticipant: %w", err)
	}
	picked := m.st.Query(ctx, objectPick).Select("offer_id")
	unpicked := m.st.Query(ctx, objectOffer).Where("participant_id = ? AND withdrawn_at = '' AND id NOT IN (?)", participantID, picked)
	if err := unpicked.Updates(at).Error; err != nil {
		return fmt.Errorf("ReleaseParticipant: %w", err)
	}
	return nil
}

func (m *postManager) RestoreParticipant(ctx context.Context, participantID string) error {
	if participantID == "" {
		return ErrNoResponder
	}
	shown := map[string]any{"withdrawn_at": ""}
	for _, object := range []string{objectRSVP, objectOffer} {
		if err := m.st.Query(ctx, object).Where(hiddenRows, participantID).Updates(shown).Error; err != nil {
			return fmt.Errorf("RestoreParticipant: %w", err)
		}
	}
	return nil
}

func (m *postManager) ListHidden(ctx context.Context, participantID string) (Hidden, error) {
	if participantID == "" {
		return Hidden{}, ErrNoResponder
	}
	rsvps, err := specstore.List[RSVP](m.st, m.st.Query(ctx, objectRSVP).Where(hiddenRows, participantID).Order("answered_at, id"), objectRSVP)
	if err != nil {
		return Hidden{}, fmt.Errorf("ListHidden: %w", err)
	}
	offers, err := specstore.List[Offer](m.st, m.st.Query(ctx, objectOffer).Where(hiddenRows, participantID).Order("offered_at, id"), objectOffer)
	if err != nil {
		return Hidden{}, fmt.Errorf("ListHidden: %w", err)
	}
	return Hidden{RSVPs: rsvps, Offers: offers}, nil
}
