package mwanachamacatalog

import (
	"context"
	"encoding/json"
	"strings"

	"wakalaserver/modules/shared/geo"
)

const (
	docLocation     = "location"
	docWard         = "ward"
	docWardMismatch = "ward_mismatch"
)

func (m *catalogManager) fillWard(ctx context.Context, e *Entry) error {
	if m.resolveArea == nil {
		return nil
	}
	var doc map[string]any
	if err := json.Unmarshal([]byte(e.Doc), &doc); err != nil || doc == nil {
		return nil
	}
	rawLocation, ok := doc[docLocation]
	if !ok {
		return nil
	}
	encoded, err := json.Marshal(rawLocation)
	if err != nil {
		return nil
	}
	location, err := geo.Parse(encoded)
	if err != nil || location.Kind != geo.KindPoint {
		return nil
	}
	derived, err := m.derivedArea(ctx, &location, "")
	if err != nil {
		return err
	}
	typed := ""
	if v, ok := doc[docWard].(string); ok {
		typed = strings.TrimSpace(v)
	}
	_, changed := doc[docWardMismatch]
	delete(doc, docWardMismatch)
	switch {
	case typed == "" && derived != "":
		doc[docWard] = derived
		changed = true
	case typed != "" && derived != "" && !strings.EqualFold(derived, typed):
		doc[docWardMismatch] = derived
		changed = true
	}
	if !changed {
		return nil
	}
	out, err := json.Marshal(doc)
	if err != nil {
		return err
	}
	e.Doc = string(out)
	return nil
}
