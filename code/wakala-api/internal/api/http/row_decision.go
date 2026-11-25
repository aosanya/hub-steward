package http

import (
	"context"
	"errors"
	"slices"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
)

const anyFieldOfRecord = ""

type rowCodes map[string]bool

func (d *Deps) callerRowCodes(ctx context.Context, instanceID string, m mwanachamaagency.AgencyManager) (rowCodes, error) {
	ctx = withPartitionContext(ctx, instanceID)
	held, err := heldAgencyRoles(ctx, d.Registry, instanceID, m)
	if errors.Is(err, errNoLiveVersion) {
		return rowCodes{}, nil
	}
	if err != nil {
		return nil, err
	}
	codes := rowCodes{}
	for _, role := range held.Roles {
		if role.Deleted {
			continue
		}
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

func (c rowCodes) allow(record agencymodels.Record, action, field string) bool {
	if action == agencymodels.RowActionDelete {
		return c[mwanachamaagency.RecordPermissionCode(record.Code, action)]
	}
	if c[mwanachamaagency.RecordPermissionCode(record.Code, action, mwanachamaagency.RecordFieldStar)] {
		return true
	}
	if field != anyFieldOfRecord {
		return c[mwanachamaagency.RecordPermissionCode(record.Code, action, field)]
	}
	return slices.ContainsFunc(record.Questions, func(q agencymodels.StepQuestion) bool {
		return q.Code != "" && c[mwanachamaagency.RecordPermissionCode(record.Code, action, q.Code)]
	})
}

func (d *Deps) callerMayDoRow(ctx context.Context, instanceID string, m mwanachamaagency.AgencyManager, record agencymodels.Record, action, field string, row *agencymodels.RecordRow) bool {
	codes, err := d.callerRowCodes(ctx, instanceID, m)
	if err != nil || !codes.allow(record, action, field) {
		return false
	}
	if row == nil {
		return true
	}
	reach, err := d.rowReachOfCaller(ctx, instanceID)
	return err == nil && reach.reaches(*row)
}

func (d *Deps) refuseAddOutsideAUsableGroup(ctx context.Context, instanceID string) error {
	_, err := d.tagsOfNewRow(ctx, instanceID)
	return err
}
