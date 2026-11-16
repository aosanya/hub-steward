package http

import (
	"context"
	"errors"
	"net/http"

	catalog "wakalaserver/modules/catalog"
	catalogroutes "wakalaserver/modules/catalog/routes"
	formsmodels "wakalaserver/modules/forms/models"

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
	d.registerFormsCatalogEntrySubmissions(mux, auth)
	for i, rt := range catalogroutes.OperatorRoutesFor(formsCatalogShape{}, formsCatalogRouteMount) {
		idx := i
		action := rt.Action
		mux.HandleFunc(rt.Pattern(formsCatalogInstancePrefix), auth.require(func(w http.ResponseWriter, r *http.Request) {
			cm, err := d.formsCatalogForRequest(r, reg, action)
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

func (d *Deps) formsCatalogForRequest(r *http.Request, reg agencies.Registry, action string) (catalog.CatalogManager, error) {
	return d.formsCatalogForAction(r.Context(), reg, r.PathValue("instanceID"), action, r.PathValue("subject_id"), r.URL.Query().Get("scope_id"))
}

func (d *Deps) formsCatalogForAction(ctx context.Context, reg agencies.Registry, instanceID, action, formID, scopeID string) (catalog.CatalogManager, error) {
	cm, err := d.formsCatalogFor(ctx, reg, instanceID, action)
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

func (d *Deps) formsCatalogFor(ctx context.Context, reg agencies.Registry, instanceID, action string) (catalog.CatalogManager, error) {
	caller := accounts.IDFromContext(ctx)
	if caller == "" {
		return nil, agencies.ErrInstanceNotFound
	}
	role, err := reg.RoleOf(ctx, instanceID, caller)
	if err != nil {
		return nil, err
	}
	if role != agencies.RoleOwner && role != agencies.RoleAgent && !d.residentHoldsAction(ctx, instanceID, role, action) {
		return nil, agencies.ErrInstanceNotFound
	}
	if err := mustBeMounted(ctx, reg, instanceID, "forms"); err != nil {
		return nil, err
	}
	cm, err := reg.CatalogManager(ctx, instanceID, formsCatalogMount)
	if err != nil {
		return cm, err
	}
	fm, err := reg.FormManager(ctx, instanceID)
	if err != nil {
		return nil, err
	}
	cm = formChecked{CatalogManager: cm, forms: fm}
	if role != agencies.RoleOwner {
		return cm, nil
	}
	return agencyOwnedCatalog{CatalogManager: cm}, nil
}

type formReader interface {
	Get(ctx context.Context, id string) (formsmodels.Form, error)
}

type formChecked struct {
	catalog.CatalogManager
	forms formReader
}

func (c formChecked) formExists(ctx context.Context, e catalog.Entry) error {
	id := catalog.FormIDOf(e)
	if id == "" {
		return nil
	}
	if _, err := c.forms.Get(ctx, id); err != nil {
		return catalog.ErrInvalidEntry
	}
	return nil
}

func (c formChecked) CreateEntry(ctx context.Context, e catalog.Entry) (catalog.Entry, error) {
	if err := c.formExists(ctx, e); err != nil {
		return catalog.Entry{}, err
	}
	return c.CatalogManager.CreateEntry(ctx, e)
}

func (c formChecked) UpsertEntry(ctx context.Context, e catalog.Entry) (catalog.Entry, error) {
	if err := c.formExists(ctx, e); err != nil {
		return catalog.Entry{}, err
	}
	return c.CatalogManager.UpsertEntry(ctx, e)
}

func (c formChecked) UpdateEntry(ctx context.Context, e catalog.Entry) (catalog.Entry, error) {
	if err := c.formExists(ctx, e); err != nil {
		return catalog.Entry{}, err
	}
	return c.CatalogManager.UpdateEntry(ctx, e)
}

type agencyOwnedCatalog struct{ catalog.CatalogManager }

func (c agencyOwnedCatalog) UpsertEntry(ctx context.Context, e catalog.Entry) (catalog.Entry, error) {
	return c.CatalogManager.UpsertEntry(catalog.AsAgencyOwner(ctx), e)
}

func (c agencyOwnedCatalog) UpdateEntry(ctx context.Context, e catalog.Entry) (catalog.Entry, error) {
	return c.CatalogManager.UpdateEntry(catalog.AsAgencyOwner(ctx), e)
}

func (c agencyOwnedCatalog) DeleteEntry(ctx context.Context, slug, deletedBy string) error {
	return c.CatalogManager.DeleteEntry(catalog.AsAgencyOwner(ctx), slug, deletedBy)
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

func (d *Deps) residentHoldsAction(ctx context.Context, instanceID, role, action string) bool {
	return role == agencies.RoleResident && d.callerHoldsAction(withPartitionContext(ctx, instanceID), role, action)
}
