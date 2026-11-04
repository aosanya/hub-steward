package mwanachamaratings

import (
	"context"
	"fmt"

	"wakalaserver/modules/ratings/models"
)

const (
	columnRater = "rater"
	columnItem  = "item"
)

type sides struct {
	kind  Kind
	self  string
	other string
}

func sidesFor(k Kind) sides {
	if k == models.KindItem {
		return sides{kind: k, self: columnItem, other: columnRater}
	}
	return sides{kind: k, self: columnRater, other: columnItem}
}

func (s sides) keysOf(r Rating) (self, via string) {
	if s.kind == models.KindItem {
		return r.Item, r.Rater
	}
	return r.Rater, r.Item
}

type sharedRow struct {
	Other  string
	Mine   float64
	Theirs float64
}

func (m *ratingsManager) shared(ctx context.Context, s sides, self, via string) (map[string][]valuePair, error) {
	t := m.st.Table(roleRating)
	sql := fmt.Sprintf(`select b.%[2]s as other, a.value as mine, b.value as theirs
from %[1]s a join %[1]s b on b.%[3]s = a.%[3]s
where a.%[2]s = ? and b.%[2]s <> ?`, t, s.self, s.other)
	args := []any{self, self}
	if via != "" {
		sql += fmt.Sprintf(` and b.%[2]s in (select %[2]s from %[1]s where %[3]s = ?)`, t, s.self, s.other)
		args = append(args, via)
	}
	var rows []sharedRow
	if err := m.db.WithContext(ctx).Raw(sql, args...).Scan(&rows).Error; err != nil {
		return nil, err
	}
	out := map[string][]valuePair{}
	for _, r := range rows {
		out[r.Other] = append(out[r.Other], valuePair{mine: r.Mine, theirs: r.Theirs})
	}
	return out, nil
}

func (m *ratingsManager) sharing(ctx context.Context, s sides, self, via string) ([]string, error) {
	var keys []string
	err := m.q(ctx, roleRating).Distinct(s.self).
		Where(s.other+" = ? and "+s.self+" <> ?", via, self).
		Pluck(s.self, &keys).Error
	return keys, err
}

type countRow struct {
	Key string
	N   int
}

func (m *ratingsManager) ratedCounts(ctx context.Context, s sides, keys []string) (map[string]int, error) {
	out := map[string]int{}
	if len(keys) == 0 {
		return out, nil
	}
	var rows []countRow
	err := m.q(ctx, roleRating).Select(s.self+" as key, count(*) as n").
		Where(s.self+" in ?", keys).Group(s.self).Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	for _, r := range rows {
		out[r.Key] = r.N
	}
	return out, nil
}
