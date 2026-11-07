package engage

import (
	"context"
	"fmt"
)

func (m *postManager) ReleaseParticipant(ctx context.Context, participantID string) error {
	if participantID == "" {
		return ErrNoResponder
	}
	if err := m.st.Query(ctx, objectRSVP).Where("participant_id = ?", participantID).Delete(map[string]any{}).Error; err != nil {
		return fmt.Errorf("ReleaseParticipant: %w", err)
	}
	picked := m.st.Query(ctx, objectPick).Select("offer_id")
	err := m.st.Query(ctx, objectOffer).Where("participant_id = ? AND id NOT IN (?)", participantID, picked).Delete(map[string]any{}).Error
	if err != nil {
		return fmt.Errorf("ReleaseParticipant: %w", err)
	}
	return nil
}
