package agencies

import (
	"context"
	"fmt"
	"strings"
	"sync"

	"gorm.io/gorm"

	"wakalaserver/internal/specs"
	mwanachamaforms "wakalaserver/modules/forms"
	mwanachamaratings "wakalaserver/modules/ratings"
)

const (
	moduleRatings = "ratings"
	recordRating  = "rating"
)

var ratingFormFields = []string{"item", "value"}

type ratingWriter struct {
	ratings func(ctx context.Context) (mwanachamaratings.RatingsManager, error)
}

func (w ratingWriter) Write(ctx context.Context, landed mwanachamaforms.LandedRecord) error {
	module, name, err := landed.Target()
	if err != nil {
		return err
	}
	if module != moduleRatings || name != recordRating {
		return fmt.Errorf("ratings takes the record %s.%s from a form, not %s", moduleRatings, recordRating, landed.Record)
	}
	rater := strings.TrimSpace(landed.Key["member"])
	if rater == "" {
		return fmt.Errorf("ratings.rating is given by the member who answered, so the form must be keyed by member")
	}
	for field := range landed.Fields {
		if !contains(ratingFormFields, field) {
			return fmt.Errorf("ratings.rating has no field %q a form may fill; the fields are %s", field, strings.Join(ratingFormFields, ", "))
		}
	}
	item, _ := landed.Fields["item"].(string)
	if strings.TrimSpace(item) == "" {
		return fmt.Errorf("ratings.rating needs an item")
	}
	value, err := ratingValueOf(landed.Fields["value"])
	if err != nil {
		return err
	}
	manager, err := w.ratings(ctx)
	if err != nil {
		return err
	}
	_, err = manager.PutRating(ctx, mwanachamaratings.Rating{Rater: rater, Item: strings.TrimSpace(item), Value: value})
	return err
}

func (ratingWriter) CheckFields(record string, fields []string) error {
	return checkFormFields(moduleRatings, recordRating, record, ratingFormFields, fields)
}

func ratingValueOf(raw any) (float64, error) {
	switch v := raw.(type) {
	case float64:
		return v, nil
	case float32:
		return float64(v), nil
	case int:
		return float64(v), nil
	case int64:
		return float64(v), nil
	case string:
		var parsed float64
		if _, err := fmt.Sscanf(strings.TrimSpace(v), "%g", &parsed); err != nil {
			return 0, fmt.Errorf("ratings.rating value %q is not a number", v)
		}
		return parsed, nil
	}
	return 0, fmt.Errorf("ratings.rating needs a value between 0 and 1")
}

type ratingsKey struct {
	db *gorm.DB
	id string
}

var ratingsManagers sync.Map

func (r *registry) ratingsManagerFor(ctx context.Context, id string) (mwanachamaratings.RatingsManager, error) {
	key := ratingsKey{db: r.db, id: id}
	if cached, found := ratingsManagers.Load(key); found {
		return cached.(mwanachamaratings.RatingsManager), nil
	}
	inst, err := r.GetInstance(ctx, id)
	if err != nil {
		return nil, err
	}
	raw, err := specs.For(mwanachamaratings.Module, inst.TableSlug)
	if err != nil {
		return nil, err
	}
	s, err := mwanachamaratings.ParseSpec(raw)
	if err != nil {
		return nil, fmt.Errorf("ratings for instance %s: %w", id, err)
	}
	if err := mwanachamaratings.Provision(r.db, s); err != nil {
		return nil, fmt.Errorf("ratings for instance %s: %w", id, err)
	}
	built, err := mwanachamaratings.NewRatingsManager(r.db, s)
	if err != nil {
		return nil, err
	}
	actual, _ := ratingsManagers.LoadOrStore(key, built)
	return actual.(mwanachamaratings.RatingsManager), nil
}
