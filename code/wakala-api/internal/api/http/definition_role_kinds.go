package http

import (
	"context"
	"errors"
	"log/slog"

	mwanachamaactor "wakalaserver/modules/actor"
	mwanachamaagency "wakalaserver/modules/agency"
	agencymodels "wakalaserver/modules/agency/models"

	"wakalaserver/internal/accounts"
)

type roleKindHolder interface {
	ActorManager(ctx context.Context, id string) (mwanachamaactor.UserManager, error)
}

type rolesPublished struct {
	mwanachamaagency.AgencyManager
	holder     roleKindHolder
	instanceID string
}

func (m rolesPublished) PublishAgency(ctx context.Context, draftID, tag, channel string) (agencymodels.AgencyPublication, error) {
	m.ensureStepRecordsBeforePublish(ctx, draftID)
	pub, err := m.AgencyManager.PublishAgency(ctx, draftID, tag, channel)
	agencyMountedSets.forget(m.instanceID)
	if err == nil {
		if syncErr := m.syncRoleKinds(ctx, pub.Document.Roles); syncErr != nil {
			slog.Warn("definition role kinds not synced", "instance", m.instanceID, "tag", pub.Tag, "err", syncErr)
		}
	}
	return pub, err
}

func (m rolesPublished) SetPublicationChannel(ctx context.Context, version int, channel string) (agencymodels.AgencyPublication, error) {
	pub, err := m.AgencyManager.SetPublicationChannel(ctx, version, channel)
	agencyMountedSets.forget(m.instanceID)
	return pub, err
}

func (m rolesPublished) syncRoleKinds(ctx context.Context, roles []agencymodels.DocumentRole) error {
	if m.holder == nil {
		return nil
	}
	um, err := m.holder.ActorManager(ctx, m.instanceID)
	if err != nil {
		return err
	}
	return syncDefinitionRoleKinds(ctx, um, roles, accounts.IDFromContext(ctx))
}

func definitionRoleID(r agencymodels.DocumentRole) string {
	if r.Code != "" {
		return r.Code
	}
	return r.ID
}

func syncDefinitionRoleKinds(ctx context.Context, um mwanachamaactor.UserManager, roles []agencymodels.DocumentRole, actorID string) error {
	defs := make([]mwanachamaactor.DefinitionRole, 0, len(roles))
	for _, r := range roles {
		id := definitionRoleID(r)
		if id == "" {
			continue
		}
		defs = append(defs, mwanachamaactor.DefinitionRole{ID: id, Name: r.Name, Staff: r.Staff})
		kind, err := um.RoleKindForDefinitionRole(ctx, id)
		if err == nil {
			if kind.Retired() {
				if _, err := um.UnretireRoleKind(ctx, kind.ID); err != nil {
					return err
				}
			}
			continue
		}
		if !errors.Is(err, mwanachamaactor.ErrRoleKindNotFound) {
			return err
		}
		if _, err := um.CreateRoleKind(ctx, mwanachamaactor.RoleKind{
			Name:             r.Name,
			Description:      r.Description,
			DefinitionRoleID: id,
			Staff:            r.Staff,
		}); err != nil {
			return err
		}
	}
	_, err := um.SyncDefinitionRoles(ctx, defs, actorID)
	return err
}
