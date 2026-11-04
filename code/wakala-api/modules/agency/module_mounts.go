package mwanachamaagency

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"

	"gorm.io/gorm"

	"wakalaserver/modules/agency/models"
)

func (m *agencyManager) SetModuleMounts(ctx context.Context, id string, mounts []models.ModuleMount) (models.Module, error) {
	current, err := m.findModule(ctx, m.db, id)
	if err != nil {
		return models.Module{}, fmt.Errorf("SetModuleMounts: %w", err)
	}
	if err := m.validateOpenDraftID(ctx, current.DraftID); err != nil {
		return models.Module{}, fmt.Errorf("SetModuleMounts: %w", err)
	}
	err = m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		mod, err := m.findModule(ctx, tx, id)
		if err != nil {
			return err
		}
		stored, err := storedMounts(mod, mounts)
		if err != nil {
			return err
		}
		mod.Mounts = stored
		mod.LastUpdated = models.NowRFC3339()
		return m.writeUpdate(ctx, tx, roleModule, id, mod, ErrModuleNotFound, "draft_id", "code", "created_at")
	})
	if err != nil {
		return models.Module{}, fmt.Errorf("SetModuleMounts: %w", err)
	}
	return m.GetModule(ctx, id)
}

func storedMounts(mod models.Module, wanted []models.ModuleMount) (string, error) {
	if len(wanted) == 0 {
		return "", nil
	}
	entry, ok := models.CatalogEntry(mod.Code)
	if !ok {
		return "", ErrInvalidModuleMounts
	}
	keyed, err := withMountKeys(entry, models.EffectiveModuleMounts(mod.Code, mod.Mounts), wanted)
	if err != nil {
		return "", err
	}
	if err := models.ValidateModuleMounts(mod.Code, keyed); err != nil {
		return "", err
	}
	raw, err := json.Marshal(keyed)
	if err != nil {
		return "", err
	}
	return string(raw), nil
}

func withMountKeys(entry models.ModuleCatalogEntry, current, wanted []models.ModuleMount) ([]models.ModuleMount, error) {
	known := make(map[string]bool, len(current))
	for _, mount := range current {
		known[mount.Key] = true
	}
	used := make(map[string]bool, len(wanted))
	out := make([]models.ModuleMount, len(wanted))
	copy(out, wanted)
	for _, mount := range out {
		if mount.Key == "" {
			continue
		}
		if !known[mount.Key] {
			return nil, ErrInvalidModuleMounts
		}
		used[mount.Key] = true
	}
	for i := range out {
		if out[i].Key != "" {
			continue
		}
		out[i].Key = freshMountKey(entry, out[i].Name, used)
		used[out[i].Key] = true
	}
	return out, nil
}

func freshMountKey(entry models.ModuleCatalogEntry, name string, used map[string]bool) string {
	if entry.Mount != "" && !used[entry.Mount] {
		return entry.Mount
	}
	base := models.MountKeyFromName(name)
	key := base
	for n := 2; used[key]; n++ {
		key = base + strconv.Itoa(n)
	}
	return key
}

func withEffectiveMounts(mod models.Module) models.Module {
	if entry, ok := models.CatalogEntry(mod.Code); ok && mod.Icon == "" {
		mod.Icon = entry.Icon
	}
	effective := models.EffectiveModuleMounts(mod.Code, mod.Mounts)
	if len(effective) == 0 {
		mod.Mounts = ""
		return mod
	}
	raw, err := json.Marshal(effective)
	if err != nil {
		return mod
	}
	mod.Mounts = string(raw)
	return mod
}
