package http

import (
	"context"
	"errors"

	mwanachamaaccounting "wakalaserver/modules/accounting"
	mwanachamaactor "wakalaserver/modules/actor"
	mwanachamaagency "wakalaserver/modules/agency"
	mwanachamaassetmanager "wakalaserver/modules/assetmanager"
	mwanachamacomm "wakalaserver/modules/comm"
	mwanachamaforms "wakalaserver/modules/forms"
	mwanachamariskmanager "wakalaserver/modules/riskmanager"
	mwanachamasources "wakalaserver/modules/sources"
	mwanachamataskmanager "wakalaserver/modules/taskmanager"
	mwanachamavoting "wakalaserver/modules/voting"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

func agencyManagerFor(ctx context.Context, reg agencies.Registry, instanceID string) (mwanachamaagency.AgencyManager, error) {
	if err := mustBeMember(ctx, reg, instanceID); err != nil {
		return nil, err
	}
	m, err := reg.AgencyManager(ctx, instanceID)
	if err != nil {
		return nil, err
	}
	return reviewsBySignedIn{AgencyManager: rolesPublished{AgencyManager: m, holder: reg, instanceID: instanceID}}, nil
}

func ledgerFor(ctx context.Context, reg agencies.Registry, instanceID string) (mwanachamaaccounting.LedgerRepository, error) {
	if err := mustBeMounted(ctx, reg, instanceID, "accounting"); err != nil {
		return nil, err
	}
	if err := mustBeMember(ctx, reg, instanceID); err != nil {
		return nil, err
	}
	return reg.LedgerRepository(ctx, instanceID)
}

func taskManagerFor(ctx context.Context, reg agencies.Registry, instanceID string) (mwanachamataskmanager.TaskManager, error) {
	if err := mustBeMounted(ctx, reg, instanceID, "taskmanager"); err != nil {
		return nil, err
	}
	if err := mustBeMember(ctx, reg, instanceID); err != nil {
		return nil, err
	}
	return reg.TaskManager(ctx, instanceID)
}

func sourceManagerFor(ctx context.Context, reg agencies.Registry, instanceID string) (mwanachamasources.SourceManager, error) {
	if err := mustBeMember(ctx, reg, instanceID); err != nil {
		return nil, err
	}
	return reg.SourceManager(ctx, instanceID)
}

func assetManagerFor(ctx context.Context, reg agencies.Registry, instanceID string) (mwanachamaassetmanager.AssetManager, error) {
	if err := mustBeMember(ctx, reg, instanceID); err != nil {
		return nil, err
	}
	return reg.AssetManager(ctx, instanceID)
}

func actorManagerFor(ctx context.Context, reg agencies.Registry, instanceID string) (mwanachamaactor.UserManager, string, error) {
	role, err := admittedRole(ctx, reg, instanceID)
	if err != nil {
		return nil, "", err
	}
	um, err := reg.ActorManager(ctx, instanceID)
	return um, role, err
}

func formsManagerFor(ctx context.Context, reg agencies.Registry, instanceID string) (mwanachamaforms.FormManager, string, error) {
	if err := mustBeMounted(ctx, reg, instanceID, "forms"); err != nil {
		return nil, "", err
	}
	role, err := admittedRole(ctx, reg, instanceID)
	if err != nil {
		return nil, "", err
	}
	fm, err := reg.FormManager(ctx, instanceID)
	return fm, role, err
}

func admittedRole(ctx context.Context, reg agencies.Registry, instanceID string) (string, error) {
	caller := accounts.IDFromContext(ctx)
	if caller == "" {
		return "", agencies.ErrInstanceNotFound
	}
	role, err := reg.RoleOf(ctx, instanceID, caller)
	if err != nil {
		return "", opaqueMembershipError(err)
	}
	switch role {
	case agencies.RoleOwner, agencies.RoleAgent, agencies.RoleResident:
		return role, opaqueMembershipError(adoptCallerAsActor(ctx, reg, instanceID, caller))
	}
	return "", agencies.ErrInstanceNotFound
}

func commManagerFor(ctx context.Context, reg agencies.Registry, instanceID, action string) (*mwanachamacomm.CommManager, string, error) {
	if err := mustBeMounted(ctx, reg, instanceID, "comm"); err != nil {
		return nil, "", err
	}
	role, err := commAdmittedRole(ctx, reg, instanceID, action)
	if err != nil {
		return nil, "", err
	}
	cm, err := reg.CommManager(ctx, instanceID)
	return cm, role, err
}

func mustBeMember(ctx context.Context, reg agencies.Registry, instanceID string) error {
	caller := accounts.IDFromContext(ctx)
	if caller == "" {
		return agencies.ErrInstanceNotFound
	}
	ok, err := reg.IsMember(ctx, instanceID, caller)
	if err != nil {
		return opaqueMembershipError(err)
	}
	if !ok {
		return agencies.ErrInstanceNotFound
	}
	return opaqueMembershipError(adoptCallerAsActor(ctx, reg, instanceID, caller))
}

var errMembershipUnavailable = errors.New("internal error")

func opaqueMembershipError(err error) error {
	if err == nil || errors.Is(err, agencies.ErrInstanceNotFound) {
		return err
	}
	return errMembershipUnavailable
}

func adoptCallerAsActor(ctx context.Context, reg agencies.Registry, instanceID, caller string) error {
	if adopter, ok := reg.(agencies.ActorAdopter); ok {
		return adopter.AdoptCaller(ctx, instanceID, caller)
	}
	directory, err := reg.ActorManager(ctx, instanceID)
	if err != nil {
		return err
	}
	_, err = directory.EnsureActor(ctx, caller)
	return err
}

func pollManagerFor(ctx context.Context, reg agencies.Registry, instanceID string) (mwanachamavoting.PollManager, error) {
	if err := mustBeMounted(ctx, reg, instanceID, "voting"); err != nil {
		return nil, err
	}
	if err := mustBeMember(ctx, reg, instanceID); err != nil {
		return nil, err
	}
	return reg.PollManager(ctx, instanceID)
}

func riskManagerFor(ctx context.Context, reg agencies.Registry, instanceID string) (mwanachamariskmanager.RiskManager, error) {
	if err := mustBeMounted(ctx, reg, instanceID, riskModule); err != nil {
		return nil, err
	}
	if err := mustBeMember(ctx, reg, instanceID); err != nil {
		return nil, err
	}
	return reg.RiskManager(ctx, instanceID)
}
