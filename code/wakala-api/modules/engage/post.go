package engage

import (
	"context"
	"fmt"

	"wakalaserver/modules/engage/models"
)

func (m *postManager) CreatePost(ctx context.Context, in Post) (Post, error) {
	if in.PostedBy == "" {
		return Post{}, ErrNoPoster
	}
	in.State = models.StateSent
	if err := m.checks(objectPost, in, ErrInvalidPost); err != nil {
		return Post{}, err
	}
	if err := postHolds(in); err != nil {
		return Post{}, fmt.Errorf("%w: %s", ErrInvalidPost, err)
	}
	in.ID = newID()
	in.PostedAt = m.now()
	if err := m.st.Insert(ctx, objectPost, in); err != nil {
		return Post{}, fmt.Errorf("CreatePost: %w", err)
	}
	return in, nil
}

func postHolds(p Post) error {
	if len(p.GroupIDs) == 0 {
		return fmt.Errorf("a post goes to at least one group")
	}
	switch p.Kind {
	case models.KindEvent:
		if p.StartsAt == "" || p.EndsAt <= p.StartsAt {
			return fmt.Errorf("an event names a start and an end after it")
		}
	case models.KindVolunteerCall:
		if p.NeededCount < 1 {
			return fmt.Errorf("a volunteer call needs at least one person")
		}
		if p.StartsAt == "" || (p.EndsAt != "" && p.EndsAt <= p.StartsAt) {
			return fmt.Errorf("a volunteer call names a start and any end after it")
		}
	}
	return nil
}

func (m *postManager) GetPost(ctx context.Context, postID string) (Post, error) {
	var out Post
	q := m.st.Query(ctx, objectPost).Where("id = ?", postID)
	if err := m.st.Take(q, objectPost, &out, ErrPostNotFound); err != nil {
		return Post{}, err
	}
	return out, nil
}
