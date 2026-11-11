package engage

import (
	"context"
	"fmt"
	"wakalaserver/modules/shared/consent"

	"wakalaserver/modules/shared/specstore"

	"wakalaserver/modules/engage/models"
)

type Groups func(ctx context.Context, callerID string) ([]string, error)

type GroupExists func(ctx context.Context, groupID string) (bool, error)

type UnreadCount struct {
	Count int `json:"count"`
}

func (m *postManager) UseGroups(g Groups) { m.groups = g }

func (m *postManager) UseGroupExists(g GroupExists) { m.exists = g }

func (m *postManager) UseConsentGate(g consent.Gate) { m.consent = g }

func (m *postManager) MarkRead(ctx context.Context, postID, participantID string) (ReadMarker, error) {
	if participantID == "" {
		return ReadMarker{}, ErrNoReader
	}
	if err := consent.Require(ctx, m.consent, participantID); err != nil {
		return ReadMarker{}, err
	}
	p, err := m.GetPost(ctx, postID)
	if err != nil {
		return ReadMarker{}, err
	}
	if p.Kind != models.KindNotice || p.State != models.StateSent {
		return ReadMarker{}, ErrNotANotice
	}
	reaches, err := m.reaches(ctx, participantID, p)
	if err != nil {
		return ReadMarker{}, err
	}
	if !reaches {
		return ReadMarker{}, ErrPostNotFound
	}
	var existing ReadMarker
	q := m.st.Query(ctx, objectReadMarker).Where("post_id = ? AND participant_id = ?", postID, participantID)
	if err := m.st.Take(q, objectReadMarker, &existing, ErrPostNotFound); err == nil {
		return existing, nil
	}
	mk := ReadMarker{ID: newID(), PostID: postID, ParticipantID: participantID, ReadAt: m.now()}
	if err := m.st.Insert(ctx, objectReadMarker, mk); err != nil {
		return ReadMarker{}, fmt.Errorf("MarkRead: %w", err)
	}
	return mk, nil
}

func (m *postManager) CountUnread(ctx context.Context, participantID string) (UnreadCount, error) {
	groups, err := m.groupsOf(ctx, participantID)
	if err != nil || len(groups) == 0 {
		return UnreadCount{}, err
	}
	q := m.st.Query(ctx, objectPost).Where("kind = ? AND state = ?", models.KindNotice, models.StateSent)
	notices, err := specstore.List[Post](m.st, q, objectPost)
	if err != nil {
		return UnreadCount{}, fmt.Errorf("CountUnread: %w", err)
	}
	mq := m.st.Query(ctx, objectReadMarker).Where("participant_id = ?", participantID)
	markers, err := specstore.List[ReadMarker](m.st, mq, objectReadMarker)
	if err != nil {
		return UnreadCount{}, fmt.Errorf("CountUnread: %w", err)
	}
	read := map[string]bool{}
	for _, mk := range markers {
		read[mk.PostID] = true
	}
	n := 0
	for _, p := range notices {
		if !read[p.ID] && sharesAGroup(groups, p.GroupIDs) {
			n++
		}
	}
	return UnreadCount{Count: n}, nil
}

func (m *postManager) groupsOf(ctx context.Context, participantID string) (map[string]bool, error) {
	if m.groups == nil || participantID == "" {
		return nil, nil
	}
	ids, err := m.groups(ctx, participantID)
	if err != nil {
		return nil, fmt.Errorf("groups: %w", err)
	}
	out := map[string]bool{}
	for _, id := range ids {
		out[id] = true
	}
	return out, nil
}

func (m *postManager) reaches(ctx context.Context, participantID string, p Post) (bool, error) {
	groups, err := m.groupsOf(ctx, participantID)
	if err != nil {
		return false, err
	}
	return sharesAGroup(groups, p.GroupIDs), nil
}

func sharesAGroup(groups map[string]bool, postGroups []string) bool {
	for _, g := range postGroups {
		if groups[g] {
			return true
		}
	}
	return false
}
