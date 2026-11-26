package http

import (
	"context"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
)

func (d *Deps) rowCodesOfRoles(ctx context.Context, instanceID string, roles []agencymodels.Role) (rowCodes, error) {
	ctx = withPartitionContext(ctx, instanceID)
	codes := rowCodes{}
	for _, role := range roles {
		granted, err := d.agencyRolePermissions(ctx, role.ID)
		if err != nil {
			return nil, err
		}
		for _, code := range granted {
			codes[code] = true
		}
	}
	return codes, nil
}

func (c rowCodes) sees(record agencymodels.Record, question agencymodels.StepQuestion) bool {
	if c[mwanachamaagency.RecordPermissionCode(record.Code, mwanachamaagency.RecordViewAction, mwanachamaagency.RecordFieldStar)] {
		return true
	}
	return question.Code != "" && c[mwanachamaagency.RecordPermissionCode(record.Code, mwanachamaagency.RecordViewAction, question.Code)]
}
