package http

import (
	"context"
	"errors"
	"net/http"

	forms "wakalaserver/modules/forms"
	formsmodels "wakalaserver/modules/forms/models"
	formsroutes "wakalaserver/modules/forms/routes"
	"wakalaserver/modules/shared/dispatch"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

const formsPrefix = "/forms"

const formsInstancePrefix = "/instances/{instanceID}/forms"

func (d *Deps) registerFormsRoutes(mux *http.ServeMux, auth callers) {
	d.registerInstanceFormsRoutes(mux, d.Registry, auth)
	d.registerReportPromisesRoute(mux, d.Registry, auth)
	d.registerPromiseOutcomeRoute(mux, d.Registry, auth)

	fm := d.Forms
	if fm == nil {
		return
	}
	writes := newAnonymousDoor(anonymousFormWritesPerMinute, anonymousFormBodyBytes)
	for _, rt := range anonymousFormsRoutes(fm) {
		mux.HandleFunc(rt.Pattern(formsPrefix), writes.guardedWhenWriting(rt.Action, rt.Handler))
	}
	for _, rt := range formsroutes.OperatorRoutesFor(fm, d.formsMount()) {
		mux.HandleFunc(rt.Pattern(formsPrefix), auth.require(rt.Handler))
	}
}

func (d *Deps) registerInstanceFormsRoutes(mux *http.ServeMux, reg agencies.Registry, auth callers) {
	if reg == nil {
		return
	}
	registerInstancePublicLinkRoutes(mux, reg, newAnonymousDoor(anonymousFormWritesPerMinute, anonymousFormBodyBytes))
	for i, rt := range formsGatedShape() {
		idx, action := i, rt.Action
		mux.HandleFunc(rt.Pattern(formsInstancePrefix), auth.require(func(w http.ResponseWriter, r *http.Request) {
			fm, role, err := formsManagerFor(r.Context(), reg, r.PathValue("instanceID"))
			if err != nil {
				writeInstanceErr(w, err)
				return
			}
			mount := d.instanceFormsMount(role)
			r = withPartition(r, r.PathValue("instanceID"))
			if refusedAsMissing(w, r, mount.Authorize, action) {
				return
			}
			mount.Authorize = nil
			promises, ok := takePublishedPromises(w, r, reg, action)
			if !ok {
				return
			}
			landed := sendsLanded(fm, reg, r.PathValue("instanceID"))
			recorded := sendsRecorded{FormManager: landed, catalogs: reg, instanceID: r.PathValue("instanceID")}
			announced := surveysAnnounced{FormManager: recorded, audience: reg, instanceID: r.PathValue("instanceID"), rules: d.NotifyRules, agency: reg, promises: promises}
			formsroutes.OperatorRoutesFor(announced, mount)[idx].Handler(w, r)
		}))
	}
}

func registerInstancePublicLinkRoutes(mux *http.ServeMux, reg agencies.Registry, writes *anonymousDoor) {
	unissued := formsroutes.PublicRoutes(noLinkIssued{})
	for i, rt := range formsAnonymousShape() {
		idx, namesAgency := i, rt.Action == openPublicLinkAction
		mux.HandleFunc(rt.Pattern(formsInstancePrefix), writes.guardedWhenWriting(rt.Action, func(w http.ResponseWriter, r *http.Request) {
			fm, err := reg.IssuingFormManager(r.Context(), r.PathValue("instanceID"))
			if errors.Is(err, agencies.ErrInstanceNotFound) {
				unissued[idx].Handler(w, r)
				return
			}
			if err != nil {
				writeInstanceErr(w, err)
				return
			}
			handler := formsroutes.PublicRoutes(fm)[idx].Handler
			if !namesAgency {
				handler(w, r)
				return
			}
			inst, err := reg.GetInstance(r.Context(), r.PathValue("instanceID"))
			if errors.Is(err, agencies.ErrInstanceNotFound) {
				unissued[idx].Handler(w, r)
				return
			}
			if err != nil {
				writeInstanceErr(w, err)
				return
			}
			serveNamingAgency(w, r, inst, handler)
		}))
	}
}

type noLinkIssued struct{ forms.FormManager }

func (noLinkIssued) OpenPublicLink(context.Context, string) (forms.ResolvedLink, error) {
	return forms.ResolvedLink{}, forms.ErrLinkNotFound
}

func (noLinkIssued) PublicLinkQuestions(context.Context, string) ([]formsmodels.LinkedQuestion, error) {
	return nil, forms.ErrLinkNotFound
}

func (noLinkIssued) PublicLinkQuestionsIn(context.Context, string, string) ([]formsmodels.LinkedQuestion, error) {
	return nil, forms.ErrLinkNotFound
}

func (noLinkIssued) RegisterRespondent(context.Context, string, string) (forms.RespondentPublicView, error) {
	return forms.RespondentPublicView{}, forms.ErrLinkNotFound
}

func (noLinkIssued) DeclareChapter(context.Context, string, string, string, string) (forms.Declaration, error) {
	return forms.Declaration{}, forms.ErrLinkNotFound
}

func formsGatedShape() []formsroutes.Route { return formsShape().Gated }

func formsAnonymousShape() []formsroutes.Route { return formsShape().Anonymous }

func formsShape() dispatch.Split {
	s, err := dispatch.Parse(forms.Operations())
	if err != nil {
		panic("forms operations: " + err.Error())
	}
	return dispatch.Anonymous(dispatch.Shape(s), formsroutes.AnonymousActions...)
}

func (d *Deps) formsMount() formsroutes.Mount {
	return formsroutes.Mount{
		Authorize: d.authorizer(formsScope),
		Caller:    accounts.IDFromContext,
	}
}

func anonymousFormsRoutes(fm forms.FormManager) []formsroutes.Route {
	return formsroutes.PublicRoutes(fm)
}
