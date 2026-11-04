package mwanachamaratings

import (
	"context"
	"fmt"
	"time"

	"gorm.io/gorm"

	"wakalaserver/modules/ratings/models"
	"wakalaserver/modules/shared/spec"
)

type (
	Rating     = models.Rating
	Similarity = models.Similarity
	Setting    = models.Setting
	Kind       = models.Kind
	Metric     = models.Metric
)

const (
	KindRater = models.KindRater
	KindItem  = models.KindItem

	MetricEuclidean = models.MetricEuclidean
	MetricCosine    = models.MetricCosine
	MetricJaccard   = models.MetricJaccard
)

type RatingsManager interface {
	PutRating(ctx context.Context, r Rating) (Rating, error)

	GetRating(ctx context.Context, rater, item string) (Rating, error)

	ListRatings(ctx context.Context, f RatingFilter) ([]Rating, error)

	DeleteRating(ctx context.Context, rater, item string) error

	ListSimilarities(ctx context.Context, f SimilarityFilter) ([]Similarity, error)

	Recommend(ctx context.Context, rater string, n int) ([]Recommendation, error)

	Settings(ctx context.Context) (Settings, error)

	PutSetting(ctx context.Context, key, value string) (Setting, error)

	GetSetting(ctx context.Context, key string) (Setting, error)
}

type ratingsManager struct {
	db  *gorm.DB
	st  *store
	now func() time.Time
}

func NewRatingsManager(db *gorm.DB, s *spec.Spec) (RatingsManager, error) {
	st, err := newStore(db, s, map[string]any{
		roleRating:     models.Rating{},
		roleSimilarity: models.Similarity{},
		roleSetting:    models.Setting{},
	})
	if err != nil {
		return nil, fmt.Errorf("NewRatingsManager: %w", err)
	}
	return &ratingsManager{db: db, st: st, now: func() time.Time { return time.Now().UTC() }}, nil
}

func (m *ratingsManager) q(ctx context.Context, role string) *gorm.DB {
	return m.st.Query(ctx, role)
}

func (m *ratingsManager) take(q *gorm.DB, role string, out any, notFound error) error {
	return m.st.Take(q, role, out, notFound)
}

func (m *ratingsManager) insert(ctx context.Context, role string, v any) error {
	return m.st.Insert(ctx, role, v)
}
