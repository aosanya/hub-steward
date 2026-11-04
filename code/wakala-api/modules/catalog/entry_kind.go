package mwanachamacatalog

import (
	"context"
	"encoding/json"

	"wakalaserver/modules/catalog/models"
)

const kindsSetting = "kinds"

const kindKey = "kind"

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
