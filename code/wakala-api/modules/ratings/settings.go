package mwanachamaratings

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"gorm.io/gorm"
	"wakalaserver/modules/ratings/models"
	"wakalaserver/modules/shared/specstore"
)

const (
	SettingMetric       = "metric"
	SettingSimilarities = "similarities"
	SettingK            = "k"
	SettingOverlap      = "overlap"
)

type Settings struct {
	Metric       Metric
	Similarities []Kind
	K            int
	Overlap      int
}

func DefaultSettings() Settings {
	return Settings{
		Metric:       models.MetricEuclidean,
		Similarities: []Kind{models.KindRater},
		K:            30,
		Overlap:      3,
	}
}

func (s Settings) Runs(k Kind) bool {
	for _, held := range s.Similarities {
		if held == k {
			return true
		}
	}
	return false
}

func (m *ratingsManager) settings(ctx context.Context) *gorm.DB {
	return m.q(ctx, roleSetting)
}

func (m *ratingsManager) Settings(ctx context.Context) (Settings, error) {
	rows, err := specstore.List[Setting](m.st, m.settings(ctx), roleSetting)
	if err != nil {
		return Settings{}, err
	}
	out := DefaultSettings()
	for _, row := range rows {
		if err := m.apply(&out, row.Key, row.Value); err != nil {
			return Settings{}, err
		}
	}
	return out, nil
}

func (m *ratingsManager) apply(into *Settings, key, value string) error {
	switch key {
	case SettingMetric:
		if err := m.declares(roleSimilarity, "metric", value); err != nil {
			return fmt.Errorf("%w: %v", ErrInvalidSetting, err)
		}
		into.Metric = Metric(value)
	case SettingSimilarities:
		kinds, err := m.kinds(value)
		if err != nil {
			return err
		}
		into.Similarities = kinds
	case SettingK:
		n, err := positive(key, value)
		if err != nil {
			return err
		}
		into.K = n
	case SettingOverlap:
		n, err := positive(key, value)
		if err != nil {
			return err
		}
		into.Overlap = n
	default:
		return fmt.Errorf("%w: %q is not a knob this module reads", ErrInvalidSetting, key)
	}
	return nil
}

func (m *ratingsManager) kinds(value string) ([]Kind, error) {
	var out []Kind
	for _, part := range strings.Split(value, ",") {
		part = strings.TrimSpace(part)
		if err := m.declares(roleSimilarity, "kind", part); err != nil {
			return nil, fmt.Errorf("%w: %v", ErrInvalidSetting, err)
		}
		out = append(out, Kind(part))
	}
	return out, nil
}

func (m *ratingsManager) declares(role, column, value string) error {
	for _, f := range m.st.Object(role).Fields {
		if f.Name != column {
			continue
		}
		for _, v := range f.Values {
			if v == value {
				return nil
			}
		}
		return fmt.Errorf("%s is %q, which is not one of %s", column, value, strings.Join(f.Values, ", "))
	}
	return fmt.Errorf("%s declares no field %q", role, column)
}

func positive(key, value string) (int, error) {
	n, err := strconv.Atoi(strings.TrimSpace(value))
	if err != nil || n < 1 {
		return 0, fmt.Errorf("%w: %s is %q, want a whole number of at least 1", ErrInvalidSetting, key, value)
	}
	return n, nil
}

func (m *ratingsManager) PutSetting(ctx context.Context, key, value string) (Setting, error) {
	probe := DefaultSettings()
	if err := m.apply(&probe, key, value); err != nil {
		return Setting{}, err
	}
	s := models.Setting{Key: key, Value: value, UpdatedAt: m.now()}

	var existing Setting
	err := m.take(m.settings(ctx).Where("key = ?", key), roleSetting, &existing, ErrSettingNotFound)
	switch {
	case errors.Is(err, ErrSettingNotFound):
		if err := m.insert(ctx, roleSetting, s); err != nil {
			return Setting{}, err
		}
		return s, nil
	case err != nil:
		return Setting{}, err
	}

	row, err := encode(m.st.Object(roleSetting), s)
	if err != nil {
		return Setting{}, err
	}
	if err := m.settings(ctx).Where("key = ?", key).Updates(row).Error; err != nil {
		return Setting{}, err
	}
	return s, nil
}

func (m *ratingsManager) GetSetting(ctx context.Context, key string) (Setting, error) {
	var s Setting
	if err := m.take(m.settings(ctx).Where("key = ?", key), roleSetting, &s, ErrSettingNotFound); err != nil {
		return Setting{}, err
	}
	return s, nil
}
