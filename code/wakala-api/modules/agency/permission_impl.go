package mwanachamaagency

import (
	"context"

	"wakalaserver/modules/agency/models"
)

func (m *agencyManager) ListPermissions(ctx context.Context) ([]models.Permission, error) {
	return models.PermissionCatalog(), nil
}
