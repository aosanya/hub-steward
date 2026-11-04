package agencies

import (
	"context"
	"fmt"
	"sort"

	mwanachamaagency "wakalaserver/modules/agency"
	"wakalaserver/modules/agency/models"
)

type TouchedModule struct {
	ModuleID string
	Code     string
	Mounts   []string
}

type ScenarioModuleSource interface {
	GetScenario(ctx context.Context, id string) (models.Scenario, error)
	ListModules(ctx context.Context, draftID string, filter mwanachamaagency.ModuleFilter) ([]models.Module, error)
}

func ModulesTouched(ctx context.Context, src ScenarioModuleSource, scenarioID string) ([]TouchedModule, error) {
	scenario, err := src.GetScenario(ctx, scenarioID)
	if err != nil {
		return nil, fmt.Errorf("ModulesTouched: %w", err)
	}
	modules, err := src.ListModules(ctx, scenario.DraftID, mwanachamaagency.ModuleFilter{})
	if err != nil {
		return nil, fmt.Errorf("ModulesTouched: %w", err)
	}
	out := make([]TouchedModule, 0, len(modules))
	for _, mod := range modules {
		if mod.Deleted || !mod.Enabled || !(switchedOnBeyondDefault(mod) || playedInEveryRun(mod.Code)) {
			continue
		}
		out = append(out, TouchedModule{ModuleID: mod.ID, Code: mod.Code, Mounts: mountKeys(mod)})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Code < out[j].Code })
	return out, nil
}

func switchedOnBeyondDefault(mod models.Module) bool {
	entry, known := models.CatalogEntry(mod.Code)
	return mod.Explicit && !mod.Locked && known && !entry.Enabled
}

func mountKeys(mod models.Module) []string {
	mounts := models.EffectiveModuleMounts(mod.Code, mod.Mounts)
	keys := make([]string, len(mounts))
	for i, m := range mounts {
		keys[i] = m.Key
	}
	return keys
}

func playedInEveryRun(code string) bool {
	return code == moduleForms || code == moduleComm
}
