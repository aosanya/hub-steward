package agencies

import (
	"context"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
)

type roleEdits struct {
	mwanachamaagency.AgencyManager
	changed func()
}

func (m roleEdits) UpdateRole(ctx context.Context, r agencymodels.Role) (agencymodels.Role, error) {
	defer m.changed()
	return m.AgencyManager.UpdateRole(ctx, r)
}

func (m roleEdits) SetRolePermissions(ctx context.Context, id string, permissions []string) (agencymodels.Role, error) {
	defer m.changed()
	return m.AgencyManager.SetRolePermissions(ctx, id, permissions)
}

func (m roleEdits) DeleteRole(ctx context.Context, id string) error {
	defer m.changed()
	return m.AgencyManager.DeleteRole(ctx, id)
}

func (m roleEdits) PublishAgency(ctx context.Context, draftID, tag, channel string) (agencymodels.AgencyPublication, error) {
	defer m.changed()
	return m.AgencyManager.PublishAgency(ctx, draftID, tag, channel)
}

func (m roleEdits) SetPublicationChannel(ctx context.Context, version int, channel string) (agencymodels.AgencyPublication, error) {
	defer m.changed()
	return m.AgencyManager.SetPublicationChannel(ctx, version, channel)
}

func (m roleEdits) Unwrap() mwanachamaagency.AgencyManager {
	return m.AgencyManager
}
