package http

import (
	"context"
	"sort"
	"sync"

	"wakalaserver/modules/agency/models"

	"wakalaserver/internal/agencies"
)

var toolsOfNoModule = map[string]bool{
	"agency_create_instance": true,
	"agency_list_instances":  true,
}

type serverModuleTools struct {
	once  sync.Once
	tools []moduleToolView
	err   error
}

func (m *mcpServers) moduleToolsOfServer(ctx context.Context) ([]moduleToolView, error) {
	m.moduleTools.once.Do(func() {
		m.moduleTools.tools, m.moduleTools.err = moduleToolsServedBy(context.WithoutCancel(ctx), m.full)
	})
	return m.moduleTools.tools, m.moduleTools.err
}

func (m *mcpServers) hiddenByModule(ctx context.Context, subject string) ([]string, error) {
	shown, err := m.modulesShownTo(ctx, subject)
	if err != nil {
		return nil, err
	}
	all, err := m.moduleToolsOfServer(ctx)
	if err != nil {
		return nil, err
	}
	var hidden []string
	for _, tool := range all {
		if !shown[tool.Module] && !toolsOfNoModule[tool.Name] {
			hidden = append(hidden, tool.Name)
		}
	}
	sort.Strings(hidden)
	return hidden, nil
}

func (m *mcpServers) modulesShownTo(ctx context.Context, subject string) (map[string]bool, error) {
	memberships, err := m.deps.Registry.MembershipsFor(ctx, subject)
	if err != nil {
		return nil, err
	}
	shown := map[string]bool{}
	for _, membership := range memberships {
		if err := m.addModulesShownIn(ctx, shown, membership); err != nil {
			return nil, err
		}
	}
	return shown, nil
}

func (m *mcpServers) addModulesShownIn(ctx context.Context, shown map[string]bool, membership agencies.Membership) error {
	set, err := mountedSetOf(ctx, m.deps.Registry, membership.ID)
	if err != nil {
		return err
	}
	may := func(string) bool { return true }
	if membership.Role != agencies.RoleOwner {
		may, err = m.deps.moduleVisibility(ctx, m.deps.Registry, membership.ID)
		if err != nil {
			return err
		}
	}
	for _, entry := range models.ModuleCatalog {
		if (set.ungated || len(set.mountsOf(entry.Code)) > 0) && may(entry.Code) {
			shown[entry.Code] = true
		}
	}
	return nil
}
