package http

import (
	"context"
	"net/http"

	mwanachamagit "wakalaserver/modules/git"
	gitroutes "wakalaserver/modules/git/routes"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

const formsGitInstancePrefix = "/instances/{instanceID}/forms-git"

var formsGitRouteMount = gitroutes.Mount{Caller: accounts.IDFromContext}

func registerFormsGitRoutes(mux *http.ServeMux, reg agencies.Registry, auth callers) {
	if reg == nil {
		return
	}
	for i, rt := range gitroutes.OperatorRoutes(formsGitShape{}, formsGitRouteMount) {
		idx := i
		mux.HandleFunc(rt.Pattern(formsGitInstancePrefix), auth.require(func(w http.ResponseWriter, r *http.Request) {
			gm, err := formsGitFor(r.Context(), reg, r.PathValue("instanceID"))
			if err != nil {
				writeInstanceErr(w, err)
				return
			}
			gitroutes.OperatorRoutes(gm, formsGitRouteMount)[idx].Handler(w, r)
		}))
	}
}

func formsGitFor(ctx context.Context, reg agencies.Registry, instanceID string) (mwanachamagit.GitManager, error) {
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
	return reg.GitManager(ctx, instanceID)
}

type formsGitShape struct{ mwanachamagit.GitManager }
