package http

import (
	"context"
	"slices"

	mwanachamaaccounting "github.com/aosanya/mwanachama-backend-accounting"

	"wakalaserver/internal/agencies"
)

const (
	accountingViewPermission   = "accounting.view"
	accountingManagePermission = "accounting.manage"
)

func holdsAccountingPermission(codes []string) bool {
	return slices.Contains(codes, accountingViewPermission) || slices.Contains(codes, accountingManagePermission)
}

func (d *Deps) ledgerFor(ctx context.Context, reg agencies.Registry, instanceID string) (mwanachamaaccounting.LedgerRepository, error) {
	if err := mustBeMounted(ctx, reg, instanceID, "accounting"); err != nil {
		return nil, err
	}
	if err := d.admittedHolding(ctx, instanceID, agencies.ErrInstanceNotFound, holdsAccountingPermission); err != nil {
		return nil, err
	}
	repo, err := reg.LedgerRepository(ctx, instanceID)
	if err != nil {
		return nil, err
	}
	return withRowLineage(repo, liveRowLineage(reg, instanceID)), nil
}
