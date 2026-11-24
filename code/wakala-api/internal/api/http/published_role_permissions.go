package http

import (
	"context"
	"errors"
	"slices"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
)

func publishedRolePermissions(ctx context.Context, m mwanachamaagency.AgencyManager, roleID string) ([]string, error) {
	pub, err := m.GetPublicationForChannel(ctx, agencymodels.DefaultChannel)
	if err != nil && !errors.Is(err, mwanachamaagency.ErrPublicationNotFound) {
		return nil, err
	}
	if err == nil {
		at := slices.IndexFunc(pub.Document.Roles, func(r agencymodels.DocumentRole) bool { return r.ID == roleID })
		if at >= 0 {
			return slices.Clone(pub.Document.Roles[at].Permissions), nil
		}
	}
	if _, err := m.GetRole(ctx, roleID); err != nil {
		return nil, err
	}
	return []string{}, nil
}
