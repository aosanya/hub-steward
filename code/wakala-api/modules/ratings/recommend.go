package mwanachamaratings

import (
	"context"
	"fmt"

	"wakalaserver/modules/ratings/models"
)

type Recommendation struct {
	Item      string  `json:"item"`
	Predicted float64 `json:"predicted"`
	Support   int     `json:"support"`
}

func (m *ratingsManager) Recommend(ctx context.Context, rater string, n int) ([]Recommendation, error) {
	if rater == "" {
		return nil, fmt.Errorf("%w: recommend needs a rater", ErrInvalidRating)
	}
	if n <= 0 {
		n = models.DefaultRecommendLimit
	}
	if n > models.MaxRecommendLimit {
		n = models.MaxRecommendLimit
	}
	ratingsTable := m.st.Table(roleRating)
	similarityTable := m.st.Table(roleSimilarity)
	sql := fmt.Sprintf(`select r.item as item, sum(s.score * r.value) / sum(s.score) as predicted, count(*) as support
from %[2]s s join %[1]s r on r.rater = s.b
where s.a = ? and s.kind = ?
  and r.item not in (select item from %[1]s where rater = ?)
group by r.item
order by predicted desc, item asc
limit %[3]d`, ratingsTable, similarityTable, n)
	out := []Recommendation{}
	err := m.db.WithContext(ctx).Raw(sql, rater, string(models.KindRater), rater).Scan(&out).Error
	if err != nil {
		return nil, err
	}
	return out, nil
}
