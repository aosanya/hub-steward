package mwanachamaratings

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"time"

	"gorm.io/gorm"

	"wakalaserver/modules/ratings/models"
	"wakalaserver/modules/shared/specstore"
)

var errNoRow = errors.New("no row")

type neighbour struct {
	other   string
	score   float64
	overlap int
}

type SimilarityFilter struct {
	Key   string
	Kind  Kind
	Limit int
}

func (m *ratingsManager) similarities(ctx context.Context) *gorm.DB {
	return m.q(ctx, roleSimilarity)
}

func (m *ratingsManager) ListSimilarities(ctx context.Context, f SimilarityFilter) ([]Similarity, error) {
	if f.Key == "" {
		return nil, ErrInvalidSimilarity
	}
	if f.Kind == "" {
		f.Kind = models.KindRater
	}
	if err := m.declares(roleSimilarity, "kind", string(f.Kind)); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidSimilarity, err)
	}
	if f.Limit <= 0 || f.Limit > models.MaxSimilarityListLimit {
		f.Limit = models.MaxSimilarityListLimit
	}
	q := m.similarities(ctx).Where("a = ? and kind = ?", f.Key, string(f.Kind)).
		Order("score desc, b asc").Limit(f.Limit)
	return specstore.List[Similarity](m.st, q, roleSimilarity)
}

func (m *ratingsManager) score(ctx context.Context, s sides, self string, groups map[string][]valuePair, st Settings) ([]neighbour, error) {
	measure := metricFor(st.Metric)
	counts := map[string]int{}
	if st.Metric == models.MetricJaccard {
		keys := []string{self}
		for other := range groups {
			keys = append(keys, other)
		}
		var err error
		if counts, err = m.ratedCounts(ctx, s, keys); err != nil {
			return nil, err
		}
	}
	var out []neighbour
	for other, shared := range groups {
		if len(shared) < st.Overlap {
			continue
		}
		sc := measure(shared, ratedCounts{mine: counts[self], theirs: counts[other]})
		if sc <= 0 {
			continue
		}
		out = append(out, neighbour{other: other, score: sc, overlap: len(shared)})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].score != out[j].score {
			return out[i].score > out[j].score
		}
		return out[i].other < out[j].other
	})
	return out, nil
}

func (m *ratingsManager) place(ctx context.Context, kind Kind, a string, n neighbour, st Settings, now time.Time) error {
	row := models.Similarity{A: a, Kind: kind, B: n.other, Metric: st.Metric, Score: n.score, Overlap: n.overlap, At: now}
	var existing Similarity
	err := m.take(m.similarities(ctx).Where("a = ? and kind = ? and b = ?", a, string(kind), n.other),
		roleSimilarity, &existing, errNoRow)
	if err == nil {
		return m.similarities(ctx).Where("a = ? and kind = ? and b = ?", a, string(kind), n.other).
			Updates(map[string]any{"metric": string(st.Metric), "score": n.score, "overlap": n.overlap,
				"at": now.UTC().Format(specstore.TimeLayout)}).Error
	}
	if !errors.Is(err, errNoRow) {
		return err
	}
	var held int64
	if err := m.similarities(ctx).Where("a = ? and kind = ?", a, string(kind)).Count(&held).Error; err != nil {
		return err
	}
	if int(held) >= st.K {
		var weakest Similarity
		err := m.take(m.similarities(ctx).Where("a = ? and kind = ?", a, string(kind)).Order("score asc, b desc"),
			roleSimilarity, &weakest, errNoRow)
		if err != nil {
			return err
		}
		if weakest.Score >= n.score {
			return nil
		}
		if _, err := m.drop(ctx, kind, a, weakest.B); err != nil {
			return err
		}
	}
	return m.insert(ctx, roleSimilarity, row)
}

func (m *ratingsManager) drop(ctx context.Context, kind Kind, a, b string) (bool, error) {
	res := m.db.WithContext(ctx).Exec("delete from "+m.st.Table(roleSimilarity)+" where a = ? and kind = ? and b = ?",
		a, string(kind), b)
	return res.RowsAffected > 0, res.Error
}

func (m *ratingsManager) link(ctx context.Context, kind Kind, self string, n neighbour, st Settings, now time.Time) error {
	if err := m.place(ctx, kind, self, n, st, now); err != nil {
		return err
	}
	return m.place(ctx, kind, n.other, neighbour{other: self, score: n.score, overlap: n.overlap}, st, now)
}

func (m *ratingsManager) unlink(ctx context.Context, kind Kind, self, other string) (selfShrank, otherShrank bool, err error) {
	if selfShrank, err = m.drop(ctx, kind, self, other); err != nil {
		return
	}
	otherShrank, err = m.drop(ctx, kind, other, self)
	return
}

func (m *ratingsManager) refresh(ctx context.Context, s sides, self string, st Settings, now time.Time) error {
	groups, err := m.shared(ctx, s, self, "")
	if err != nil {
		return err
	}
	found, err := m.score(ctx, s, self, groups, st)
	if err != nil {
		return err
	}
	if len(found) > st.K {
		found = found[:st.K]
	}
	if err := m.db.WithContext(ctx).Exec("delete from "+m.st.Table(roleSimilarity)+" where a = ? and kind = ?",
		self, string(s.kind)).Error; err != nil {
		return err
	}
	for _, n := range found {
		row := models.Similarity{A: self, Kind: s.kind, B: n.other, Metric: st.Metric, Score: n.score, Overlap: n.overlap, At: now}
		if err := m.insert(ctx, roleSimilarity, row); err != nil {
			return err
		}
	}
	return nil
}
