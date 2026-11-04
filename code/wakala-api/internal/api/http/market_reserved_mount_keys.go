package http

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"sync"

	marketroutes "wakalaserver/modules/market/routes"

	mwanachamaagency "wakalaserver/modules/agency"
	"wakalaserver/modules/agency/models"
)

var marketRouteSegments = sync.OnceValue(func() map[string]bool {
	shape, err := marketroutes.Table.Shape()
	if err != nil {
		panic(err)
	}
	out := map[string]bool{}
	for _, rt := range shape {
		first, _, _ := strings.Cut(strings.TrimPrefix(rt.Path, "/"), "/")
		out[first] = true
	}
	return out
})

func (m rolesPublished) SetModuleMounts(ctx context.Context, id string, mounts []models.ModuleMount) (models.Module, error) {
	if err := m.refuseReservedMarketKeys(ctx, id, mounts); err != nil {
		return models.Module{}, err
	}
	return m.AgencyManager.SetModuleMounts(ctx, id, mounts)
}

func (m rolesPublished) refuseReservedMarketKeys(ctx context.Context, id string, mounts []models.ModuleMount) error {
	mod, err := m.AgencyManager.GetModule(ctx, id)
	if err != nil || mod.Code != marketModule {
		return nil
	}
	entry, ok := models.CatalogEntry(mod.Code)
	if !ok {
		return nil
	}
	used := map[string]bool{}
	for _, mount := range mounts {
		if mount.Key != "" {
			used[mount.Key] = true
		}
	}
	for _, mount := range mounts {
		if mount.Key != "" {
			continue
		}
		key := freshMarketMountKey(entry, mount.Name, used)
		used[key] = true
		if marketRouteSegments()[key] {
			return fmt.Errorf("%w: %q would make the key %q, which is a market route; name it something else", mwanachamaagency.ErrInvalidModuleMounts, mount.Name, key)
		}
	}
	return nil
}

func freshMarketMountKey(entry models.ModuleCatalogEntry, name string, used map[string]bool) string {
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
