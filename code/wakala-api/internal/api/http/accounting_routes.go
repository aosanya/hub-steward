package http

import (
	"net/http"

	accountingroutes "wakalaserver/modules/accounting/routes"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

const accountingScope = "module:accounting"

const accountingInstancePrefix = "/instances/{instanceID}/accounting"

func (d *Deps) registerAccountingRoutes(mux *http.ServeMux, reg agencies.Registry, auth callers) {
	for i, rt := range accountingroutes.Shape() {
		idx := i
		mux.HandleFunc(rt.Pattern(accountingInstancePrefix), auth.require(func(w http.ResponseWriter, r *http.Request) {
			repo, err := ledgerFor(r.Context(), reg, r.PathValue("instanceID"))
			if err != nil {
				writeInstanceErr(w, err)
				return
			}
			instanceID := r.PathValue("instanceID")
			mount := d.instanceAccountingMount(d.callerRole(r, instanceID))
			accountingroutes.RoutesFor(repo, mount)[idx].Handler(w, withPartition(r, instanceID))
		}))
	}
}

func (d *Deps) instanceAccountingMount(role string) accountingroutes.Mount {
	mount := d.accountingMount()
	mount.Authorize = agentPermissioned(role, d.Registry, d.agencyRolePermissions, mount.Authorize)
	return mount
}

func (d *Deps) accountingMount() accountingroutes.Mount {
	return accountingroutes.Mount{
		Authorize: d.authorizer(accountingScope),
		Caller:    accounts.IDFromContext,
	}
}
