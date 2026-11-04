package agencies

import (
	"context"

	mwanachamaagency "wakalaserver/modules/agency"
	agencymodels "wakalaserver/modules/agency/models"
)

type roleEdits struct {
	mwanachamaagency.AgencyManager
	changed func()
}

func (m roleEdits) UpdateRole(ctx context.Context, r agencymodels.Role) (agencymodels.Role, error) {
	defer m.changed()
	return m.AgencyManager.UpdateRole(ctx, r)
}

func (m roleEdits) DeleteRole(ctx context.Context, id string) error {
	defer m.changed()
	return m.AgencyManager.DeleteRole(ctx, id)
}

func (m roleEdits) Unwrap() mwanachamaagency.AgencyManager {
	return m.AgencyManager
}
