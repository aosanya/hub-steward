package http

import (
	"context"
	"errors"
	"slices"

	mwanachamaforms "github.com/aosanya/mwanachama-backend-forms"
	mwanachamaaccounting "wakalaserver/modules/accounting"
	mwanachamaactor "wakalaserver/modules/actor"
	mwanachamaagency "wakalaserver/modules/agency"
	mwanachamaassetmanager "wakalaserver/modules/assetmanager"
	mwanachamacomm "wakalaserver/modules/comm"
	mwanachamacustody "wakalaserver/modules/custody"
	mwanachamadigitaltwin "wakalaserver/modules/digitaltwin"
	mwanachamaengage "wakalaserver/modules/engage"
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
	return admittedAgencyManager(ctx, reg, instanceID)
}

func admittedAgencyManager(ctx context.Context, reg agencies.Registry, instanceID string) (mwanachamaagency.AgencyManager, error) {
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
	repo, err := reg.LedgerRepository(ctx, instanceID)
	if err != nil {
		return nil, err
	}
	return withRowLineage(repo, liveRowLineage(reg, instanceID)), nil
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

func (d *Deps) taskManagerFor(ctx context.Context, reg agencies.Registry, instanceID string) (mwanachamataskmanager.TaskManager, error) {
	if err := mustBeMounted(ctx, reg, instanceID, "taskmanager"); err != nil {
		return nil, err
	}
	if err := d.taskManagerAdmitted(ctx, instanceID); err != nil {
		return nil, err
	}
	board, err := reg.TaskManager(ctx, instanceID)
	if err != nil {
		return nil, err
	}
	return stepRoleBoard{TaskManager: board, reg: reg, instanceID: instanceID}, nil
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

func opaqueMembershipError(err error) error {
	if err == nil || errors.Is(err, agencies.ErrInstanceNotFound) {
		return err
	}
	return membershipUnavailable{cause: err}
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
	if _, err := admittedRole(ctx, reg, instanceID); err != nil {
		return nil, err
	}
	return reg.PollManager(ctx, instanceID)
}

func twinManagerFor(ctx context.Context, reg agencies.Registry, instanceID string) (mwanachamadigitaltwin.TwinManager, error) {
	if err := mustBeMounted(ctx, reg, instanceID, "digitaltwin"); err != nil {
		return nil, err
	}
	if err := mustBeMember(ctx, reg, instanceID); err != nil {
		return nil, err
	}
	return twinFollowingCorrections(ctx, reg, instanceID)
}

func twinFollowingCorrections(ctx context.Context, reg agencies.Registry, instanceID string) (mwanachamadigitaltwin.TwinManager, error) {
	twin, err := reg.TwinManager(ctx, instanceID)
	if err != nil {
		return nil, err
	}
	return withTenureRowLineage(twin, liveRowLineage(reg, instanceID)), nil
}

func postManagerFor(ctx context.Context, reg agencies.Registry, instanceID string) (mwanachamaengage.PostManager, error) {
	if err := mustBeMounted(ctx, reg, instanceID, "engage"); err != nil {
		return nil, err
	}
	if err := mustBeMember(ctx, reg, instanceID); err != nil {
		return nil, err
	}
	return reg.PostManager(ctx, instanceID)
}

func (d *Deps) custodyManagerFor(ctx context.Context, reg agencies.Registry, instanceID, action string) (*mwanachamacustody.CustodyManager, error) {
	if err := mustBeMounted(ctx, reg, instanceID, "custody"); err != nil {
		return nil, err
	}
	if err := d.custodyAdmitted(ctx, reg, instanceID, action); err != nil {
		return nil, err
	}
	return reg.CustodyManager(ctx, instanceID)
}

func (d *Deps) custodyAdmitted(ctx context.Context, reg agencies.Registry, instanceID, action string) error {
	switch {
	case slices.Contains(residentCustodyActions, action):
		return mustBeAdmitted(ctx, reg, instanceID)
	case slices.Contains(permissionedCustodyActions, action):
		return d.admittedByRolePermission(ctx, reg, instanceID, action)
	}
	return mustBeMember(ctx, reg, instanceID)
}

var residentCustodyConsentActions = []string{"custody.consent.give", "custody.consent.withdraw", "custody.consent.mine", "custody.consent_text.read"}

var permissionedCustodyActions = []string{"custody.consent_version.list", "custody.consent_text.publish", "custody.consent.record"}

var residentCustodyActions = append(slices.Clone(residentCustodyConsentActions), "custody.consent_version.in_force")

func mustBeAdmitted(ctx context.Context, reg agencies.Registry, instanceID string) error {
	_, err := admittedRole(ctx, reg, instanceID)
	return err
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
