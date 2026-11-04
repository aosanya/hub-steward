package models

import (
	"encoding/json"
	"sort"
)

type Record struct {
	ID          string `json:"id"`
	SubjectID   string `json:"subject_id"`
	HolderID    string `json:"holder_id"`
	ScopeID     string `json:"scope_id"`
	Doc         string `json:"doc"`
	Changes     string `json:"changes"`
	CreatedAt   string `json:"created_at"`
	LastUpdated string `json:"last_updated"`
}

type FieldTally struct {
	Field   string         `json:"field"`
	Counted int            `json:"counted"`
	Holders int            `json:"holders"`
	Yes     int            `json:"yes,omitempty"`
	No      int            `json:"no,omitempty"`
	Options map[string]int `json:"options,omitempty"`
	Numbers int            `json:"numbers,omitempty"`
	Average *float64       `json:"average,omitempty"`
	Lowest  *float64       `json:"lowest,omitempty"`
	Highest *float64       `json:"highest,omitempty"`
}

func TallyRecords(records []Record) ([]FieldTally, error) {
	tallies := map[string]*FieldTally{}
	sums := map[string]float64{}
	holders := map[string]map[string]bool{}
	for _, r := range records {
		var values map[string]any
		if err := json.Unmarshal([]byte(r.Doc), &values); err != nil {
			return nil, err
		}
		for field, value := range values {
			t := tallies[field]
			if t == nil {
				t = &FieldTally{Field: field}
				tallies[field] = t
			}
			if countValue(t, sums, value) {
				t.Counted++
				holders[field] = withHolder(holders[field], r.HolderID)
			}
		}
	}
	out := make([]FieldTally, 0, len(tallies))
	for field, t := range tallies {
		if t.Numbers > 0 {
			average := sums[field] / float64(t.Numbers)
			t.Average = &average
		}
		t.Holders = len(holders[field])
		out = append(out, *t)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Field < out[j].Field })
	return out, nil
}

func countValue(t *FieldTally, sums map[string]float64, value any) bool {
	switch v := value.(type) {
	case bool:
		if v {
			t.Yes++
		} else {
			t.No++
		}
	case string:
		addOption(t, v)
	case []any:
		for _, item := range v {
			if s, ok := item.(string); ok {
				addOption(t, s)
			}
		}
	case float64:
		addNumber(t, sums, v)
	default:
		return false
	}
	return true
}

func addOption(t *FieldTally, option string) {
	if t.Options == nil {
		t.Options = map[string]int{}
	}
	t.Options[option]++
}

func addNumber(t *FieldTally, sums map[string]float64, n float64) {
	t.Numbers++
	sums[t.Field] += n
	if t.Lowest == nil || n < *t.Lowest {
		low := n
		t.Lowest = &low
	}
	if t.Highest == nil || n > *t.Highest {
		high := n
		t.Highest = &high
	}
}

func withHolder(seen map[string]bool, holder string) map[string]bool {
	if seen == nil {
		seen = map[string]bool{}
	}
	seen[holder] = true
	return seen
}
