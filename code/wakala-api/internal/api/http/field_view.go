package http

import (
	"context"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
)

type fieldView struct {
	codes map[string]bool
}

func (d *Deps) fieldViewOfCaller(ctx context.Context, instanceID string, roles []agencymodels.Role) (fieldView, error) {
	ctx = withPartitionContext(ctx, instanceID)
	view := fieldView{codes: map[string]bool{}}
	for _, role := range roles {
		granted, err := d.agencyRolePermissions(ctx, role.ID)
		if err != nil {
			return fieldView{}, err
		}
		for _, code := range granted {
			view.codes[code] = true
		}
	}
	return view, nil
}

func (v fieldView) sees(record agencymodels.Record, question agencymodels.StepQuestion) bool {
	if v.codes[mwanachamaagency.RecordPermissionCode(record.Code, mwanachamaagency.RecordViewAction, mwanachamaagency.RecordFieldStar)] {
		return true
	}
	return question.Code != "" && v.codes[mwanachamaagency.RecordPermissionCode(record.Code, mwanachamaagency.RecordViewAction, question.Code)]
}
