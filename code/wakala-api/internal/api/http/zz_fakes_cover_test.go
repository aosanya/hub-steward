package http

import (
	"context"
	"encoding/json"
	"testing"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
	"wakalaserver/internal/approvals"
	mwanachamaagency "wakalaserver/modules/agency"
	agencymodels "wakalaserver/modules/agency/models"
	mwanachamamarket "wakalaserver/modules/market"
)

type applyWorld struct {
	reg        agencies.Registry
	instanceID string
	ctx        context.Context
}

func newApplyWorld(t *testing.T) applyWorld {
	t.Helper()
	reg, err := agencies.NewRegistry(stepRunDB(t))
	if err != nil {
		t.Fatalf("NewRegistry: %v", err)
	}
	ctx := accounts.WithID(context.Background(), "owner-1")
	instance, err := reg.CreateInstance(ctx, "Town hall")
	if err != nil {
		t.Fatalf("CreateInstance: %v", err)
	}
	if err := reg.AddMember(ctx, instance.ID, "owner-1", agencies.RoleOwner); err != nil {
		t.Fatalf("AddMember: %v", err)
	}
	w := applyWorld{reg: reg, instanceID: instance.ID, ctx: ctx}
	if _, err := w.agency(t).CreateAgency(ctx, agencymodels.Agency{Name: "Town hall"}); err != nil {
		t.Fatalf("CreateAgency: %v", err)
	}
	return w
}

func (w applyWorld) agency(t *testing.T) mwanachamaagency.AgencyManager {
	t.Helper()
	m, err := agencyManagerFor(w.ctx, w.reg, w.instanceID)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	return m
}

func (w applyWorld) apply(kind string, payload any) error {
	raw, _ := json.Marshal(payload)
	return approvalAppliers[kind](w.ctx, w.reg, w.instanceID, string(raw))
}

func (w applyWorld) approved(t *testing.T, kind string, payload any) (approvals.Approval, error) {
	t.Helper()
	store, err := w.reg.Approvals(w.ctx, w.instanceID)
	if err != nil {
		t.Fatalf("Approvals: %v", err)
	}
	raw, _ := json.Marshal(payload)
	proposed, err := store.Propose(w.ctx, "proposer", kind, "a proposal", string(raw))
	if err != nil {
		t.Fatalf("Propose: %v", err)
	}
	decided, err := store.Decide(w.ctx, proposed.ID, "owner", approvals.StatusApproved, "", "")
	if err != nil {
		t.Fatalf("Decide: %v", err)
	}
	env := applyEnv{announce: func(m mwanachamamarket.MarketManager, instanceID string) mwanachamamarket.MarketManager { return m }}
	return applyApproved(w.ctx, w.reg, env, w.instanceID, store, decided)
}
