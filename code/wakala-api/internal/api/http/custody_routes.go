package http

import (
	"context"
	"net/http"

	custody "wakalaserver/modules/custody"
	custodyroutes "wakalaserver/modules/custody/routes"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

const custodyInstancePrefix = "/instances/{instanceID}/custody"

type custodyManagers interface {
	CustodyManager(ctx context.Context, id string) (*custody.CustodyManager, error)
}

func custodyManagerFor(ctx context.Context, reg agencies.Registry, instanceID string) (*custody.CustodyManager, error) {
	if err := mustBeMounted(ctx, reg, instanceID, "custody"); err != nil {
		return nil, err
	}
	if err := mustBeMember(ctx, reg, instanceID); err != nil {
		return nil, err
	}
	managers, ok := reg.(custodyManagers)
	if !ok {
		return nil, agencies.ErrInstanceNotFound
	}
	return managers.CustodyManager(ctx, instanceID)
}

func custodyMount() custodyroutes.Mount {
	return custodyroutes.Mount{Caller: accounts.IDFromContext}
}

func (d *Deps) instanceCustodyMount(role string) custodyroutes.Mount {
	mount := custodyMount()
	mount.Authorize = agentPermissioned(role, d.Registry, d.agencyRolePermissions, mount.Authorize)
	return mount
}

func (d *Deps) registerCustodyRoutes(mux *http.ServeMux, reg agencies.Registry, auth callers) {
	shape, err := custodyroutes.Table.Shape()
	if err != nil {
		panic(err)
	}
	for i, rt := range shape {
		idx := i
		mux.HandleFunc(rt.Pattern(custodyInstancePrefix), auth.require(func(w http.ResponseWriter, r *http.Request) {
			instanceID := r.PathValue("instanceID")
			m, err := custodyManagerFor(r.Context(), reg, instanceID)
			if err != nil {
				writeInstanceErr(w, err)
				return
			}
			r = withPartition(r, instanceID)
			custodyroutes.RoutesFor(m, d.instanceCustodyMount(d.callerRole(r, instanceID)))[idx].Handler(w, r)
		}))
	}
}
