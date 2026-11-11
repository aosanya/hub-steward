package http

import (
	"context"
	"errors"

	mwanachamaagency "wakalaserver/modules/agency"
	agencymodels "wakalaserver/modules/agency/models"
	mwanachamamarket "wakalaserver/modules/market"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

const unknownRunMessage = "order_id is not a run of this record's workflow or a group order of this agency"

func (d *Deps) rowRunIsReal(ctx context.Context, instanceID string, m mwanachamaagency.AgencyManager, record agencymodels.Record, orderID string) (bool, error) {
	if orderID == "" {
		return true, nil
	}
	isGroupOrder, err := groupOrderExists(ctx, d.Registry, instanceID, orderID)
	if err != nil || isGroupOrder {
		return isGroupOrder, err
	}
	return workflowHasRun(ctx, m, record, orderID)
}

func groupOrderExists(ctx context.Context, reg agencies.Registry, instanceID, orderID string) (bool, error) {
	set, err := mountedSetOf(ctx, reg, instanceID)
	if err != nil {
		return false, err
	}
	for _, mount := range set.mountsOf(marketModule) {
		market, err := reg.MarketManager(ctx, instanceID, mount.Key)
		if err != nil {
			return false, err
		}
		_, err = market.GetGroupOrder(ctx, accounts.IDFromContext(ctx), orderID)
		if err == nil {
			return true, nil
		}
		if !errors.Is(err, mwanachamamarket.ErrNotFound) {
			return false, err
		}
	}
	return false, nil
}

func workflowHasRun(ctx context.Context, m mwanachamaagency.AgencyManager, record agencymodels.Record, orderID string) (bool, error) {
	draftID, err := liveDraftOf(ctx, m)
	if err != nil {
		return false, err
	}
	steps, err := m.ListWorkItems(ctx, draftID, mwanachamaagency.WorkItemFilter{})
	if err != nil {
		return false, err
	}
	records, err := m.ListRecords(ctx, draftID, mwanachamaagency.RecordFilter{})
	if err != nil {
		return false, err
	}
	chain := formStepsByWorkflow(steps, records)[record.WorkflowID]
	if len(chain) == 0 {
		return false, nil
	}
	runs, err := runsOf(ctx, m, chain)
	if err != nil {
		return false, err
	}
	for _, run := range runs {
		if run.orderID == orderID {
			return true, nil
		}
	}
	return false, nil
}
