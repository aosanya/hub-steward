package agencies

import (
	"context"
	"errors"
	"fmt"

	mwanachamaactor "github.com/aosanya/mwanachama-backend-actor"
	mwanachamacatalog "wakalaserver/modules/catalog"
)

type areaDirectory struct {
	actors mwanachamaactor.UserManager
}

func newAreaDirectory(actors mwanachamaactor.UserManager) mwanachamacatalog.AreaDirectory {
	return areaDirectory{actors: actors}
}

func (d areaDirectory) areaGroups(ctx context.Context) ([]mwanachamaactor.Group, error) {
	levels, err := d.actors.ListLevels(ctx, "")
	if err != nil {
		return nil, fmt.Errorf("areaDirectory: %w", err)
	}
	areaLevels := map[string]bool{}
	for _, l := range levels {
		if l.IsArea {
			areaLevels[l.ID] = true
		}
	}
	if len(areaLevels) == 0 {
		return nil, nil
	}
	groups, err := d.actors.ListGroups(ctx, "")
	if err != nil {
		return nil, fmt.Errorf("areaDirectory: %w", err)
	}
	out := make([]mwanachamaactor.Group, 0, len(groups))
	for _, g := range groups {
		if !g.Deleted && areaLevels[g.LevelID] {
			out = append(out, g)
		}
	}
	return out, nil
}

func (d areaDirectory) AreasOf(ctx context.Context, personIDs []string) (map[string]string, error) {
	wanted := make(map[string]bool, len(personIDs))
	for _, id := range personIDs {
		wanted[id] = true
	}
	placed := map[string]string{}
	if len(wanted) == 0 {
		return placed, nil
	}
	groups, err := d.areaGroups(ctx)
	if err != nil {
		return nil, err
	}
	for _, g := range groups {
		seats, err := d.actors.ListActorsForGroup(ctx, g.ID)
		if err != nil {
			return nil, fmt.Errorf("areaDirectory: seats of group %s: %w", g.ID, err)
		}
		for _, seat := range seats {
			if _, taken := placed[seat.ActorID]; !taken && !seat.Deleted && wanted[seat.ActorID] {
				placed[seat.ActorID] = g.Name
			}
		}
	}
	return placed, nil
}

func (d areaDirectory) Areas(ctx context.Context) ([]mwanachamacatalog.AreaPopulation, error) {
	groups, err := d.areaGroups(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]mwanachamacatalog.AreaPopulation, 0, len(groups))
	for _, g := range groups {
		figure, err := d.actors.LatestGroupPopulation(ctx, g.ID)
		if err != nil && !errors.Is(err, mwanachamaactor.ErrPopulationNotFound) {
			return nil, fmt.Errorf("areaDirectory: population of group %s: %w", g.ID, err)
		}
		out = append(out, mwanachamacatalog.AreaPopulation{Area: g.Name, Population: figure.Population})
	}
	return out, nil
}
