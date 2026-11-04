package models

import (
	"bytes"
	"encoding/json"
	"errors"
)

type EntrySeed struct {
	Slug    string          `json:"slug"`
	Name    string          `json:"name"`
	Summary string          `json:"summary,omitempty"`
	Doc     json.RawMessage `json:"doc"`
}

var ErrSeedsMalformed = errors.New("seeds setting is malformed")

func ParseEntrySeeds(value any) ([]EntrySeed, error) {
	raw, err := json.Marshal(value)
	if err != nil {
		return nil, ErrSeedsMalformed
	}
	if string(raw) == "null" {
		return nil, nil
	}
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.DisallowUnknownFields()
	var seeds []EntrySeed
	if err := dec.Decode(&seeds); err != nil {
		return nil, ErrSeedsMalformed
	}
	seen := map[string]bool{}
	for _, s := range seeds {
		if s.Slug == "" || s.Name == "" || seen[s.Slug] {
			return nil, ErrSeedsMalformed
		}
		seen[s.Slug] = true
		if len(s.Doc) > 0 && !isJSONObjectText(s.Doc) {
			return nil, ErrSeedsMalformed
		}
	}
	return seeds, nil
}

func (s EntrySeed) Entry() Entry {
	doc := "{}"
	if len(s.Doc) > 0 {
		doc = string(s.Doc)
	}
	return Entry{Slug: s.Slug, Name: s.Name, Summary: s.Summary, Doc: doc}
}

func isJSONObjectText(raw json.RawMessage) bool {
	var v map[string]any
	return json.Unmarshal(raw, &v) == nil && v != nil
}
