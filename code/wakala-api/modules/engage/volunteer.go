package engage

import (
	"context"
	"fmt"

	"wakalaserver/modules/shared/specstore"

	"wakalaserver/modules/engage/models"
)

type Picked struct {
	Pick          Pick   `json:"pick"`
	ParticipantID string `json:"participant_id"`
}

type Filled struct {
	Post           Post     `json:"post"`
	ParticipantIDs []string `json:"participant_ids"`
}

func (m *postManager) OfferHelp(ctx context.Context, postID, participantID string) (Offer, error) {
	if participantID == "" {
		return Offer{}, ErrNoVolunteer
	}
	p, err := m.GetPost(ctx, postID)
	if err != nil {
		return Offer{}, err
	}
	reaches, err := m.reaches(ctx, participantID, p)
	if err != nil {
		return Offer{}, err
	}
	if !reaches {
		return Offer{}, ErrPostNotFound
	}
	if p.Kind != models.KindVolunteerCall || p.State != models.StateSent {
		return Offer{}, ErrNotAnOpenCall
	}
	var existing Offer
	q := m.st.Query(ctx, objectOffer).Where("post_id = ? AND participant_id = ?", postID, participantID)
	if err := m.st.Take(q, objectOffer, &existing, ErrPostNotFound); err == nil {
		return existing, nil
	}
	o := Offer{ID: newID(), PostID: postID, ParticipantID: participantID, OfferedAt: m.now()}
	if err := m.st.Insert(ctx, objectOffer, o); err != nil {
		return Offer{}, fmt.Errorf("OfferHelp: %w", err)
	}
	return o, nil
}

func (m *postManager) PickOffer(ctx context.Context, in Pick) (Picked, error) {
	p, err := m.ownOpenCall(ctx, in.PostID, in.PickedBy)
	if err != nil {
		return Picked{}, err
	}
	var offer Offer
	q := m.st.Query(ctx, objectOffer).Where("id = ? AND post_id = ?", in.OfferID, p.ID)
	if err := m.st.Take(q, objectOffer, &offer, ErrOfferNotFound); err != nil {
		return Picked{}, err
	}
	var existing Pick
	pq := m.st.Query(ctx, objectPick).Where("post_id = ? AND offer_id = ?", p.ID, offer.ID)
	if err := m.st.Take(pq, objectPick, &existing, ErrOfferNotFound); err == nil {
		return Picked{Pick: existing, ParticipantID: offer.ParticipantID}, nil
	}
	var picked int64
	if err := m.st.Query(ctx, objectPick).Where("post_id = ?", p.ID).Count(&picked).Error; err != nil {
		return Picked{}, fmt.Errorf("PickOffer: %w", err)
	}
	if picked >= int64(p.NeededCount) {
		return Picked{}, ErrCallFull
	}
	pk := Pick{ID: newID(), PostID: p.ID, OfferID: offer.ID, PickedAt: m.now(), PickedBy: in.PickedBy}
	if err := m.st.Insert(ctx, objectPick, pk); err != nil {
		return Picked{}, fmt.Errorf("PickOffer: %w", err)
	}
	return Picked{Pick: pk, ParticipantID: offer.ParticipantID}, nil
}

func (m *postManager) FillCall(ctx context.Context, postID, callerID string) (Filled, error) {
	p, err := m.ownOpenCall(ctx, postID, callerID)
	if err != nil {
		return Filled{}, err
	}
	picks, err := specstore.List[Pick](m.st, m.st.Query(ctx, objectPick).Where("post_id = ?", p.ID), objectPick)
	if err != nil {
		return Filled{}, fmt.Errorf("FillCall: %w", err)
	}
	ids := make([]string, 0, len(picks))
	for _, pk := range picks {
		var o Offer
		if err := m.st.Take(m.st.Query(ctx, objectOffer).Where("id = ?", pk.OfferID), objectOffer, &o, ErrOfferNotFound); err != nil {
			return Filled{}, err
		}
		ids = append(ids, o.ParticipantID)
	}
	closed := models.StateFilled
	if len(ids) == 0 {
		closed = models.StateCancelled
	}
	upd := m.st.Query(ctx, objectPost).Where("id = ? AND state = ?", p.ID, models.StateSent)
	if err := upd.Updates(map[string]any{"state": closed}).Error; err != nil {
		return Filled{}, fmt.Errorf("FillCall: %w", err)
	}
	p.State = closed
	return Filled{Post: p, ParticipantIDs: ids}, nil
}

func (m *postManager) ownOpenCall(ctx context.Context, postID, callerID string) (Post, error) {
	if callerID == "" {
		return Post{}, ErrNoPoster
	}
	p, err := m.GetPost(ctx, postID)
	if err != nil {
		return Post{}, err
	}
	if p.PostedBy != callerID {
		return Post{}, ErrNotThePoster
	}
	if p.Kind != models.KindVolunteerCall || p.State != models.StateSent {
		return Post{}, ErrNotAnOpenCall
	}
	return p, nil
}

func (m *postManager) WithdrawOffer(ctx context.Context, postID, participantID string) (Offer, error) {
	if participantID == "" {
		return Offer{}, ErrNoVolunteer
	}
	p, err := m.GetPost(ctx, postID)
	if err != nil {
		return Offer{}, err
	}
	reaches, err := m.reaches(ctx, participantID, p)
	if err != nil {
		return Offer{}, err
	}
	if !reaches {
		return Offer{}, ErrPostNotFound
	}
	if p.Kind != models.KindVolunteerCall || p.State != models.StateSent {
		return Offer{}, ErrNotAnOpenCall
	}
	var offer Offer
	q := m.st.Query(ctx, objectOffer).Where("post_id = ? AND participant_id = ?", postID, participantID)
	if err := m.st.Take(q, objectOffer, &offer, ErrOfferNotFound); err != nil {
		return Offer{}, err
	}
	var picked int64
	if err := m.st.Query(ctx, objectPick).Where("post_id = ? AND offer_id = ?", postID, offer.ID).Count(&picked).Error; err != nil {
		return Offer{}, fmt.Errorf("WithdrawOffer: %w", err)
	}
	if picked > 0 {
		return Offer{}, ErrOfferPicked
	}
	if err := m.st.Query(ctx, objectOffer).Where("id = ?", offer.ID).Delete(map[string]any{}).Error; err != nil {
		return Offer{}, fmt.Errorf("WithdrawOffer: %w", err)
	}
	return offer, nil
}

func (m *postManager) Unpick(ctx context.Context, postID, pickID, callerID string) (Picked, error) {
	p, err := m.ownOpenCall(ctx, postID, callerID)
	if err != nil {
		return Picked{}, err
	}
	var pk Pick
	q := m.st.Query(ctx, objectPick).Where("id = ? AND post_id = ?", pickID, p.ID)
	if err := m.st.Take(q, objectPick, &pk, ErrPickNotFound); err != nil {
		return Picked{}, err
	}
	var o Offer
	if err := m.st.Take(m.st.Query(ctx, objectOffer).Where("id = ?", pk.OfferID), objectOffer, &o, ErrOfferNotFound); err != nil {
		return Picked{}, err
	}
	if err := m.st.Query(ctx, objectPick).Where("id = ?", pk.ID).Delete(map[string]any{}).Error; err != nil {
		return Picked{}, fmt.Errorf("Unpick: %w", err)
	}
	return Picked{Pick: pk, ParticipantID: o.ParticipantID}, nil
}
