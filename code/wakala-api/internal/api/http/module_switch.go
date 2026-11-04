package http

import (
	"context"
	"errors"
	"sync"
	"time"

	mwanachamaagency "wakalaserver/modules/agency"
	"wakalaserver/modules/agency/models"

	"wakalaserver/internal/agencies"
)

const mountedModulesExpiry = 30 * time.Second

type mountedSet struct {
	ungated bool
	modules map[string]bool
	mounts  map[string][]models.ModuleMount
	readAt  time.Time
}

type mountedSets struct {
	mu   sync.Mutex
	sets map[string]mountedSet
	now  func() time.Time
}

var agencyMountedSets = &mountedSets{sets: map[string]mountedSet{}, now: time.Now}

func (c *mountedSets) get(instanceID string) (mountedSet, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()
	set, ok := c.sets[instanceID]
	if !ok || c.now().Sub(set.readAt) >= mountedModulesExpiry {
		return mountedSet{}, false
	}
	return set, true
}

func (c *mountedSets) put(instanceID string, set mountedSet) {
	c.mu.Lock()
	defer c.mu.Unlock()
	set.readAt = c.now()
	c.sets[instanceID] = set
}

func (c *mountedSets) forget(instanceID string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	delete(c.sets, instanceID)
}

func mountedSetOf(ctx context.Context, reg agencies.Registry, instanceID string) (mountedSet, error) {
	set, ok := agencyMountedSets.get(instanceID)
	if ok {
		return set, nil
	}
	read, err := readMountedSet(ctx, reg, instanceID)
	if err != nil {
		return mountedSet{}, err
	}
	agencyMountedSets.put(instanceID, read)
	return read, nil
}

func mustBeMounted(ctx context.Context, reg agencies.Registry, instanceID, module string) error {
	set, err := mountedSetOf(ctx, reg, instanceID)
	if err != nil {
		return err
	}
	if set.ungated || set.modules[module] {
		return nil
	}
	return agencies.ErrInstanceNotFound
}

func readMountedSet(ctx context.Context, reg agencies.Registry, instanceID string) (mountedSet, error) {
	m, err := reg.AgencyManager(ctx, instanceID)
	if err != nil {
		return mountedSet{}, err
	}
	pub, err := m.GetPublicationForChannel(ctx, models.DefaultChannel)
	if errors.Is(err, mwanachamaagency.ErrPublicationNotFound) {
		return mountedSet{ungated: true}, nil
	}
	if err != nil {
		return mountedSet{}, err
	}
	return mountedSet{modules: mountedModules(pub.Document), mounts: mountedMounts(pub.Document)}, nil
}

func mountedModules(doc models.AgencyDocument) map[string]bool {
	enabled := make(map[string]bool, len(doc.Modules))
	for _, mod := range doc.Modules {
		if mod.Enabled {
			enabled[mod.Code] = true
		}
	}
	return models.WithRequiredModules(enabled)
}

func mountedMounts(doc models.AgencyDocument) map[string][]models.ModuleMount {
	out := map[string][]models.ModuleMount{}
	for _, mod := range doc.Modules {
		if mod.Enabled {
			out[mod.Code] = models.EffectiveModuleMounts(mod.Code, string(mod.Mounts))
		}
	}
	return out
}

func (s mountedSet) mountsOf(code string) []models.ModuleMount {
	if !s.ungated && !s.modules[code] {
		return nil
	}
	if held, ok := s.mounts[code]; ok && len(held) > 0 {
		return held
	}
	entry, ok := models.CatalogEntry(code)
	if !ok {
		return nil
	}
	return models.DefaultModuleMounts(entry)
}
