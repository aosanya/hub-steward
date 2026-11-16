package mwanachamacatalog

import (
	"context"
	"encoding/json"
	"strings"

	"wakalaserver/modules/catalog/models"
)

const kindsSetting = "kinds"

const kindKey = "kind"

const formIDKey = "form_id"

func docObject(doc string) (map[string]any, bool) {
	if strings.TrimSpace(doc) == "" {
		return map[string]any{}, true
	}
	var fields map[string]any
	if err := json.Unmarshal([]byte(doc), &fields); err != nil || fields == nil {
		return nil, false
	}
	return fields, true
}

func withDocFields(e Entry) Entry {
	fields, ok := docObject(e.Doc)
	if !ok {
		return e
	}
	e.Kind, _ = fields[kindKey].(string)
	e.FormID, _ = fields[formIDKey].(string)
	return e
}

func putDocFields(e *Entry) error {
	fields, ok := docObject(e.Doc)
	if !ok {
		if e.Kind == "" && e.FormID == "" {
			return nil
		}
		return ErrInvalidEntry
	}
	if present, named := fields[formIDKey]; named {
		if _, isText := present.(string); !isText {
			return ErrInvalidEntry
		}
	}
	if e.Kind != "" {
		fields[kindKey] = e.Kind
	}
	if e.FormID != "" {
		fields[formIDKey] = e.FormID
	}
	if e.Kind == "" && e.FormID == "" {
		return nil
	}
	merged, err := json.Marshal(fields)
	if err != nil {
		return ErrInvalidEntry
	}
	e.Doc = string(merged)
	return nil
}

func (m *catalogManager) checkKind(ctx context.Context, doc string) error {
	var fields map[string]any
	if err := json.Unmarshal([]byte(doc), &fields); err != nil {
		return nil
	}
	named, present := fields[kindKey]
	if !present {
		return nil
	}
	kinds, err := m.entryKinds(ctx)
	if err != nil {
		return err
	}
	if len(kinds) == 0 {
		return nil
	}
	name, ok := named.(string)
	if !ok {
		return ErrEntryKind
	}
	for _, k := range kinds {
		if k.Name == name {
			if k.Fits(fields) {
				return nil
			}
			return ErrEntryKind
		}
	}
	return ErrEntryKind
}

func (m *catalogManager) entryKinds(ctx context.Context) ([]models.EntryKind, error) {
	if _, declared := m.spec.Setting(kindsSetting); !declared {
		return nil, nil
	}
	return resolveFitting(ctx, m, kindsSetting, models.ParseEntryKinds)
}
