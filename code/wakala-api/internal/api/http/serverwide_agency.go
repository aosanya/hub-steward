package http

import (
	"context"
	"net/http"

	catalog "wakalaserver/modules/catalog"
	catalogroutes "wakalaserver/modules/catalog/routes"
	forms "wakalaserver/modules/forms"
	formsroutes "wakalaserver/modules/forms/routes"
	ratings "wakalaserver/modules/ratings"
	ratingsroutes "wakalaserver/modules/ratings/routes"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

const agencyQuery = "instance_id"

func (d *Deps) agencyOfRequest(r *http.Request, public bool) (string, error) {
	return d.agencyOfCaller(r.Context(), r.URL.Query().Get(agencyQuery), public)
}

func (d *Deps) agencyOfCaller(ctx context.Context, named string, public bool) (string, error) {
	caller := accounts.IDFromContext(ctx)
	if public {
		if named == "" {
			return "", agencies.ErrInstanceNotFound
		}
		if _, err := d.Registry.GetInstance(ctx, named); err != nil {
			return "", err
		}
		return named, nil
	}
	if caller == "" {
		return "", agencies.ErrInstanceNotFound
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

type agencyRatingsRoutes struct {
	deps  *Deps
	mount ratingsroutes.Mount
}

func (a agencyRatingsRoutes) handler(index int) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		instanceID, err := a.deps.agencyOfRequest(r, false)
		if err != nil {
			writeInstanceErr(w, err)
			return
		}
		rm, err := a.deps.Registry.RatingsManager(r.Context(), instanceID)
		if err != nil {
			writeInstanceErr(w, err)
			return
		}
		a.build(rm)[index].Handler(w, withPartition(r, instanceID))
	}
}

func (a agencyRatingsRoutes) build(rm ratings.RatingsManager) []ratingsroutes.Route {
	return ratingsroutes.OperatorRoutesFor(rm, a.mount)
}
