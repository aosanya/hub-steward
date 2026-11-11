package http

import (
	"net/http"

	catalog "wakalaserver/modules/catalog"
	catalogroutes "wakalaserver/modules/catalog/routes"
	forms "wakalaserver/modules/forms"
	formsroutes "wakalaserver/modules/forms/routes"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

const agencyQuery = "instance_id"

func (d *Deps) agencyOfRequest(r *http.Request, public bool) (string, error) {
	ctx := r.Context()
	named := r.URL.Query().Get(agencyQuery)
	caller := accounts.IDFromContext(ctx)
	if public || caller == "" {
		if named == "" {
			return "", agencies.ErrInstanceNotFound
		}
		if _, err := d.Registry.GetInstance(ctx, named); err != nil {
			return "", err
		}
		return named, nil
	}
	if named != "" {
		member, err := d.Registry.IsMember(ctx, named, caller)
		if err != nil {
			return "", err
		}
		if !member {
			return "", agencies.ErrInstanceNotFound
		}
		return named, nil
	}
	memberships, err := d.Registry.MembershipsFor(ctx, caller)
	if err != nil {
		return "", err
	}
	if len(memberships) != 1 {
		return "", agencies.ErrInstanceNotFound
	}
	return memberships[0].ID, nil
}

type agencyCatalogRoutes struct {
	deps   *Deps
	mount  string
	build  func(catalog.CatalogManager) []catalogroutes.Route
	public bool
}

func (a agencyCatalogRoutes) handler(index int) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		instanceID, err := a.deps.agencyOfRequest(r, a.public)
		if err != nil {
			writeInstanceErr(w, err)
			return
		}
		cm, err := a.deps.Registry.CatalogManager(r.Context(), instanceID, a.mount)
		if err != nil {
			writeInstanceErr(w, err)
			return
		}
		a.build(cm)[index].Handler(w, withPartition(r, instanceID))
	}
}

type agencyFormRoutes struct {
	deps   *Deps
	build  func(forms.FormManager) []formsroutes.Route
	public bool
}

func (a agencyFormRoutes) handler(index int) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		instanceID, err := a.deps.agencyOfRequest(r, a.public)
		if err != nil {
			writeInstanceErr(w, err)
			return
		}
		fm, err := a.manager(r, instanceID)
		if err != nil {
			writeInstanceErr(w, err)
			return
		}
		a.build(fm)[index].Handler(w, withPartition(r, instanceID))
	}
}

func (a agencyFormRoutes) manager(r *http.Request, instanceID string) (forms.FormManager, error) {
	if a.public {
		return a.deps.Registry.IssuingFormManager(r.Context(), instanceID)
	}
	return a.deps.Registry.FormManager(r.Context(), instanceID)
}
