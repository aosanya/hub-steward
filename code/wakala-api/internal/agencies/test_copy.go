package agencies

import (
	"context"
	"fmt"

	"gorm.io/gorm"

	mwanachamaactor "wakalaserver/modules/actor"
	mwanachamaagency "wakalaserver/modules/agency"
	"wakalaserver/modules/agency/models"
	mwanachamacomm "wakalaserver/modules/comm"
	mwanachamacustody "wakalaserver/modules/custody"
	mwanachamadigitaltwin "wakalaserver/modules/digitaltwin"
	mwanachamaengage "wakalaserver/modules/engage"
	mwanachamaforms "wakalaserver/modules/forms"
	mwanachamamarket "wakalaserver/modules/market"
	mwanachamariskmanager "wakalaserver/modules/riskmanager"
	"wakalaserver/modules/shared/spec"
	"wakalaserver/modules/shared/specstore"
	mwanachamataskmanager "wakalaserver/modules/taskmanager"
	mwanachamavoting "wakalaserver/modules/voting"
)

const (
	moduleMarket      = "market"
	moduleTaskmanager = "taskmanager"
	moduleVoting      = "voting"
	moduleActor       = "actor"
	moduleForms       = "forms"
	moduleComm        = "comm"
	moduleCustody     = "custody"
	moduleDigitaltwin = "digitaltwin"
	moduleEngage      = "engage"
	moduleRiskmanager = "riskmanager"
)

type TestCopy struct {
	registry   Registry
	db         *gorm.DB
	instanceID string
	slug       string
}

func (r *registry) TestCopy(ctx context.Context, id string) (TestCopy, error) {
	inst, err := r.GetInstance(ctx, id)
	if err != nil {
		return TestCopy{}, err
	}
	return TestCopy{registry: r, db: r.db, instanceID: id, slug: inst.TableSlug}, nil
}

func (c TestCopy) Market(ctx context.Context, runID string) (mwanachamamarket.MarketManager, error) {
	live, err := c.registry.MarketManager(ctx, c.instanceID, MountMarket)
	if err != nil {
		return nil, err
	}
	return live.ForRun(runID)
}

func (c TestCopy) Forms(ctx context.Context, runID string) (mwanachamaforms.FormManager, error) {
	live, err := c.registry.FormManager(ctx, c.instanceID)
	if err != nil {
		return nil, err
	}
	return live.ForRun(runID)
}

func (c TestCopy) Comm(ctx context.Context, runID string) (*mwanachamacomm.CommManager, error) {
	if runID == "" {
		return nil, specstore.ErrRunIDEmpty
	}
	live, err := c.registry.CommManager(ctx, c.instanceID)
	if err != nil {
		return nil, err
	}
	return live.ForRun(runID)
}

func (c TestCopy) Board(ctx context.Context, runID string) (mwanachamataskmanager.TaskManager, error) {
	live, err := c.registry.TaskManager(ctx, c.instanceID)
	if err != nil {
		return nil, err
	}
	return live.ForRun(runID)
}

func (c TestCopy) Polls(ctx context.Context, runID string) (mwanachamavoting.PollManager, error) {
	live, err := c.registry.PollManager(ctx, c.instanceID)
	if err != nil {
		return nil, err
	}
	return live.ForRun(runID)
}

func (c TestCopy) Directory(ctx context.Context, runID string) (mwanachamaactor.UserManager, error) {
	live, err := c.registry.ActorManager(ctx, c.instanceID)
	if err != nil {
		return nil, err
	}
	return live.ForRun(runID)
}

func (c TestCopy) Specs(modules []TouchedModule) ([]*spec.Spec, error) {
	var out []*spec.Spec
	for _, m := range modules {
		specs, err := c.specsOf(m)
		if err != nil {
			return nil, err
		}
		out = append(out, specs...)
	}
	return out, nil
}

func (c TestCopy) specsOf(m TouchedModule) ([]*spec.Spec, error) {
	mounted := func(forMount func(instance, mount string) (*spec.Spec, error)) ([]*spec.Spec, error) {
		out := make([]*spec.Spec, 0, len(m.Mounts))
		for _, key := range m.Mounts {
			s, err := forMount(c.slug, key)
			if err != nil {
				return nil, fmt.Errorf("TestCopy: spec of %s mount %s: %w", m.Code, key, err)
			}
			out = append(out, s)
		}
		return out, nil
	}
	single := func(forInstance func(instance string) (*spec.Spec, error)) ([]*spec.Spec, error) {
		s, err := forInstance(c.slug)
		if err != nil {
			return nil, fmt.Errorf("TestCopy: spec of %s: %w", m.Code, err)
		}
		return []*spec.Spec{s}, nil
	}
	switch m.Code {
	case moduleMarket:
		return mounted(mwanachamamarket.SpecForMount)
	case moduleTaskmanager:
		return mounted(mwanachamataskmanager.SpecForMount)
	case moduleVoting:
		return mounted(mwanachamavoting.SpecForMount)
	case moduleActor:
		return mounted(mwanachamaactor.SpecForMount)
	case moduleForms:
		return single(mwanachamaforms.SpecFor)
	case moduleCustody:
		return mounted(mwanachamacustody.SpecForMount)
	case moduleDigitaltwin:
		return mounted(mwanachamadigitaltwin.SpecForMount)
	case moduleEngage:
		return mounted(mwanachamaengage.SpecForMount)
	case moduleRiskmanager:
		return mounted(mwanachamariskmanager.SpecForMount)
	case moduleComm:
		return single(mwanachamacomm.SpecFor)
	}
	return nil, nil
}

func (c TestCopy) Remove(ctx context.Context, runID string, modules []TouchedModule) (int64, error) {
	specs, err := c.Specs(modules)
	if err != nil {
		return 0, err
	}
	var removed int64
	for _, s := range specs {
		n, err := specstore.RemoveRun(ctx, c.db, s, runID)
		removed += n
		if err != nil {
			return removed, err
		}
	}
	return removed, nil
}

func (c TestCopy) Stored(ctx context.Context, runID string, modules []TouchedModule) ([]specstore.RunRows, error) {
	specs, err := c.Specs(modules)
	if err != nil {
		return nil, err
	}
	var out []specstore.RunRows
	for _, s := range specs {
		rows, err := specstore.RowsOfRun(ctx, c.db, s, runID)
		if err != nil {
			return nil, err
		}
		out = append(out, rows...)
	}
	return out, nil
}

type ModuleSource interface {
	ListDrafts(ctx context.Context, filter mwanachamaagency.DraftFilter) ([]models.Draft, error)
	ListModules(ctx context.Context, draftID string, filter mwanachamaagency.ModuleFilter) ([]models.Module, error)
}

func ModulesOfAgency(ctx context.Context, src ModuleSource) ([]TouchedModule, error) {
	drafts, err := src.ListDrafts(ctx, mwanachamaagency.DraftFilter{})
	if err != nil {
		return nil, fmt.Errorf("ModulesOfAgency: %w", err)
	}
	scopes := []string{""}
	for _, d := range drafts {
		scopes = append(scopes, d.ID)
	}
	byCode := map[string]*TouchedModule{}
	var order []string
	for _, scope := range scopes {
		mods, err := src.ListModules(ctx, scope, mwanachamaagency.ModuleFilter{})
		if err != nil {
			return nil, fmt.Errorf("ModulesOfAgency: %w", err)
		}
		for _, mod := range mods {
			if mod.Deleted || !mod.Enabled {
				continue
			}
			held, ok := byCode[mod.Code]
			if !ok {
				held = &TouchedModule{ModuleID: mod.ID, Code: mod.Code}
				byCode[mod.Code] = held
				order = append(order, mod.Code)
			}
			held.Mounts = withKeys(held.Mounts, mountKeys(mod))
		}
	}
	out := make([]TouchedModule, 0, len(order))
	for _, code := range order {
		out = append(out, *byCode[code])
	}
	return out, nil
}

func withKeys(held, more []string) []string {
	seen := make(map[string]bool, len(held))
	for _, k := range held {
		seen[k] = true
	}
	for _, k := range more {
		if !seen[k] {
			held = append(held, k)
			seen[k] = true
		}
	}
	return held
}
