package http

import (
	"context"
	"errors"
	"net/http"

	riskroutes "wakalaserver/modules/riskmanager/routes"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

const riskInstancePrefix = "/instances/{instanceID}/risks"

const riskModule = "riskmanager"

func riskMount() riskroutes.Mount {
	return riskroutes.Mount{Caller: accounts.IDFromContext}
}

func (d *Deps) instanceRiskMount(role string) riskroutes.Mount {
	mount := riskMount()
	mount.Authorize = agentPermissioned(role, d.Registry, d.agencyRolePermissions, mount.Authorize)
	return mount
}

func (d *Deps) registerRiskRoutes(mux *http.ServeMux, reg agencies.Registry, auth callers) {
	shape, err := riskroutes.Table.Shape()
	if err != nil {
		panic(err)
	}
	for i, rt := range shape {
		idx := i
		mux.HandleFunc(rt.Pattern(riskInstancePrefix), auth.require(func(w http.ResponseWriter, r *http.Request) {
			instanceID := r.PathValue("instanceID")
			m, err := riskManagerFor(r.Context(), reg, instanceID)
			if err != nil {
				writeInstanceErr(w, err)
				return
			}
			r = withPartition(r, instanceID)
			riskroutes.RoutesFor(m, d.instanceRiskMount(d.callerRole(r, instanceID)))[idx].Handler(w, r)
		}))
	}
}

func RiskMounted(ctx context.Context, reg agencies.Registry, instanceID string) (bool, error) {
	err := mustBeMounted(ctx, reg, instanceID, riskModule)
	if errors.Is(err, agencies.ErrInstanceNotFound) {
		return false, nil
	}
	return err == nil, err
}
