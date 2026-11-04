package mwanachamaratings

import (
	"context"
	"errors"
	"fmt"

	"gorm.io/gorm"

	"wakalaserver/modules/ratings/models"
	"wakalaserver/modules/shared/specstore"
)

type RatingFilter struct {
	Rater string
	Item  string
	Limit int
}

func (m *ratingsManager) ratings(ctx context.Context) *gorm.DB {
	return m.q(ctx, roleRating)
}

func (m *ratingsManager) one(ctx context.Context, rater, item string) *gorm.DB {
	return m.ratings(ctx).Where("rater = ? and item = ?", rater, item)
}

func (m *ratingsManager) GetRating(ctx context.Context, rater, item string) (Rating, error) {
	var r Rating
	if err := m.take(m.one(ctx, rater, item), roleRating, &r, ErrRatingNotFound); err != nil {
		return Rating{}, err
	}
	return r, nil
}

func (m *ratingsManager) ListRatings(ctx context.Context, f RatingFilter) ([]Rating, error) {
	if f.Rater == "" && f.Item == "" {
		return nil, fmt.Errorf("%w: a listing names a rater or an item", ErrInvalidRating)
	}
	if f.Limit <= 0 || f.Limit > models.MaxRatingListLimit {
		f.Limit = models.MaxRatingListLimit
	}
	q := m.ratings(ctx)
	if f.Rater != "" {
		q = q.Where("rater = ?", f.Rater)
	}
	if f.Item != "" {
		q = q.Where("item = ?", f.Item)
	}
	return specstore.List[Rating](m.st, q.Order("at desc, item asc, rater asc").Limit(f.Limit), roleRating)
}

func (m *ratingsManager) PutRating(ctx context.Context, r Rating) (Rating, error) {
	r.At = m.now()
	if err := Check(m.st.Spec(), roleRating, r); err != nil {
		return Rating{}, fmt.Errorf("%w: %v", ErrInvalidRating, err)
	}
	_, err := m.GetRating(ctx, r.Rater, r.Item)
	switch {
	case errors.Is(err, ErrRatingNotFound):
		if err := m.insert(ctx, roleRating, r); err != nil {
			return Rating{}, err
		}
	case err != nil:
		return Rating{}, err
	default:
		if err := m.one(ctx, r.Rater, r.Item).Updates(map[string]any{
			"value": r.Value, "at": r.At.UTC().Format(specstore.TimeLayout),
		}).Error; err != nil {
			return Rating{}, err
		}
	}
	st, err := m.Settings(ctx)
	if err != nil {
		return Rating{}, err
	}
	for _, kind := range st.Similarities {
		s := sidesFor(kind)
		self, via := s.keysOf(r)
		if err := m.relink(ctx, s, self, via, st); err != nil {
			return Rating{}, err
		}
	}
	return r, nil
}

func (m *ratingsManager) relink(ctx context.Context, s sides, self, via string, st Settings) error {
	groups, err := m.shared(ctx, s, self, via)
	if err != nil {
		return err
	}
	found, err := m.score(ctx, s, self, groups, st)
	if err != nil {
		return err
	}
	now := m.now()
	for _, n := range found {
		if err := m.link(ctx, s.kind, self, n, st, now); err != nil {
			return err
		}
	}
	return nil
}

func (m *ratingsManager) DeleteRating(ctx context.Context, rater, item string) error {
	existing, err := m.GetRating(ctx, rater, item)
	if err != nil {
		return err
	}
	st, err := m.Settings(ctx)
	if err != nil {
		return err
	}
	if err := m.db.WithContext(ctx).Exec("delete from "+m.st.Table(roleRating)+" where rater = ? and item = ?",
		rater, item).Error; err != nil {
		return err
	}
	for _, kind := range st.Similarities {
		s := sidesFor(kind)
		self, via := s.keysOf(existing)
		if err := m.rescore(ctx, s, self, via, st); err != nil {
			return err
		}
	}
	return nil
}

func (m *ratingsManager) rescore(ctx context.Context, s sides, self, via string, st Settings) error {
	candidates, err := m.sharing(ctx, s, self, via)
	if err != nil {
		return err
	}
	groups, err := m.shared(ctx, s, self, via)
	if err != nil {
		return err
	}
	found, err := m.score(ctx, s, self, groups, st)
	if err != nil {
		return err
	}
	kept := map[string]bool{}
	now := m.now()
	for _, n := range found {
		kept[n.other] = true
		if err := m.link(ctx, s.kind, self, n, st, now); err != nil {
			return err
		}
	}
	shrunk := map[string]bool{}
	for _, other := range candidates {
		if kept[other] {
			continue
		}
		selfShrank, otherShrank, err := m.unlink(ctx, s.kind, self, other)
		if err != nil {
			return err
		}
		if selfShrank {
			shrunk[self] = true
		}
		if otherShrank {
			shrunk[other] = true
		}
	}
	for key := range shrunk {
		if err := m.refresh(ctx, s, key, st, now); err != nil {
			return err
		}
	}
	return nil
}
