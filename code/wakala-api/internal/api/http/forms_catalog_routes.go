package http

import (
	"context"
	"errors"
	"net/http"

	catalog "wakalaserver/modules/catalog"
	catalogroutes "wakalaserver/modules/catalog/routes"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

const formsCatalogMount = agencies.MountFormRecords

const formsCatalogInstancePrefix = "/instances/{instanceID}/forms-catalog"

var formsCatalogRouteMount = catalogroutes.Mount{Caller: accounts.IDFromContext}

func (d *Deps) registerFormsCatalogRoutes(mux *http.ServeMux, reg agencies.Registry, auth callers) {
	if reg == nil {
		return
	}
	for i, rt := range catalogroutes.OperatorRoutesFor(formsCatalogShape{}, formsCatalogRouteMount) {
		idx := i
		action := rt.Action
		mux.HandleFunc(rt.Pattern(formsCatalogInstancePrefix), auth.require(func(w http.ResponseWriter, r *http.Request) {
			cm, err := formsCatalogForRequest(r, reg, action)
			if err != nil {
				writeInstanceErr(w, err)
				return
			}
			if d.linkedAgentRefused(r.Context(), r.PathValue("instanceID"), action) {
				writeInstanceErr(w, agencies.ErrInstanceNotFound)
				return
			}
			catalogroutes.OperatorRoutesFor(cm, formsCatalogRouteMount)[idx].Handler(w, r)
		}))
	}
}

var groupLeaderRecordReads = map[string]bool{
	"catalog.record.list":  true,
	"catalog.record.count": true,
}

func formsCatalogForRequest(r *http.Request, reg agencies.Registry, action string) (catalog.CatalogManager, error) {
	return formsCatalogForAction(r.Context(), reg, r.PathValue("instanceID"), action, r.PathValue("subject_id"), r.URL.Query().Get("scope_id"))
}

func formsCatalogForAction(ctx context.Context, reg agencies.Registry, instanceID, action, formID, scopeID string) (catalog.CatalogManager, error) {
	cm, err := formsCatalogFor(ctx, reg, instanceID)
	if !errors.Is(err, agencies.ErrInstanceNotFound) || !groupLeaderRecordReads[action] {
		return cm, err
	}
	if err := callerLeadsTheScopeNamed(ctx, reg, instanceID, scopeID); err != nil {
		return nil, err
	}
	if err := mustBeMounted(ctx, reg, instanceID, "forms"); err != nil {
		return nil, err
	}
	if err := formWasSentTo(ctx, reg, instanceID, formID, scopeID); err != nil {
		return nil, err
	}
	return reg.CatalogManager(ctx, instanceID, formsCatalogMount)
}

func formWasSentTo(ctx context.Context, reg agencies.Registry, instanceID, formID, groupID string) error {
	if formID == "" {
		return agencies.ErrInstanceNotFound
	}
	fm, err := reg.FormManager(ctx, instanceID)
	if err != nil {
		return err
	}
	targets, err := fm.ListTargets(ctx, formID)
	if err != nil {
		return agencies.ErrInstanceNotFound
	}
	for _, t := range targets {
		if t.ChapterID == groupID {
			return nil
		}
	}
	return agencies.ErrInstanceNotFound
}

func callerLeadsTheScopeNamed(ctx context.Context, reg agencies.Registry, instanceID, scopeID string) error {
	caller := accounts.IDFromContext(ctx)
	if caller == "" || scopeID == "" {
		return agencies.ErrInstanceNotFound
	}
	role, err := reg.RoleOf(ctx, instanceID, caller)
	if err != nil {
		return err
	}
	if role != agencies.RoleResident {
		return agencies.ErrInstanceNotFound
	}
	directory, err := reg.ActorManager(ctx, instanceID)
	if err != nil {
		return err
	}
	leads, err := directory.IsGroupLeader(ctx, scopeID, caller)
	if err != nil || !leads {
		return agencies.ErrInstanceNotFound
	}
	return nil
}

func formsCatalogFor(ctx context.Context, reg agencies.Registry, instanceID string) (catalog.CatalogManager, error) {
	caller := accounts.IDFromContext(ctx)
	if caller == "" {
		return nil, agencies.ErrInstanceNotFound
	}
	role, err := reg.RoleOf(ctx, instanceID, caller)
	if err != nil {
		return nil, err
	}
	if role != agencies.RoleOwner && role != agencies.RoleAgent {
		return nil, agencies.ErrInstanceNotFound
	}
	if err := mustBeMounted(ctx, reg, instanceID, "forms"); err != nil {
		return nil, err
	}
	return reg.CatalogManager(ctx, instanceID, formsCatalogMount)
}

type formsCatalogShape struct{ catalog.CatalogManager }

func (d *Deps) linkedAgentRefused(ctx context.Context, instanceID, action string) bool {
	role, err := d.Registry.RoleOf(ctx, instanceID, accounts.IDFromContext(ctx))
	if err != nil {
		return false
	}
	ctx = context.WithValue(ctx, partitionKey{}, instanceID)
	authorize := agentPermissioned(role, d.Registry, d.agencyRolePermissions, nil)
	return authorize != nil && authorize(ctx, action) != nil
}
