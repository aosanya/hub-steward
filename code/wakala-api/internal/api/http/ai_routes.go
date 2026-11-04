package http

import (
	"context"
	"net/http"
	"strings"

	"wakalaserver/modules/shared/dispatch"

	ai "wakalaserver/modules/ai"
	airoutes "wakalaserver/modules/ai/routes"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

const aiInstancePrefix = "/instances/{instanceID}/ai"

type AIResolver func(ctx context.Context, instanceID string) (ai.Manager, error)

var aiOwnerOnlyActions = map[string]bool{
	"ai.account.create":  true,
	"ai.account.update":  true,
	"ai.account.delete":  true,
	"ai.account.key_set": true,
	"ai.role.set_limits": true,
	"ai.usage.breakdown": true,
}

var aiRefusalLines = map[string]string{
	"ai.usage.breakdown": "Only the hub's manager can see where the tokens went.",
}

func aiAuthorize(role string) dispatch.Authorizer {
	return func(_ context.Context, action string) error {
		if role == agencies.RoleOwner {
			return nil
		}
		if role == agencies.RoleAgent && !aiOwnerOnlyActions[action] {
			return nil
		}
		return dispatch.ErrForbidden
	}
}

func (d *Deps) aiPermissioned(role string, reg agencies.Registry, authorize dispatch.Authorizer) dispatch.Authorizer {
	return agentPermissioned(role, reg, d.agencyRolePermissions, authorize)
}

func (d *Deps) registerAIRoutes(mux *http.ServeMux, reg agencies.Registry, auth callers) {
	if d.AI == nil {
		return
	}
	shape, err := airoutes.Table.Shape()
	if err != nil {
		panic(err)
	}
	for i, rt := range shape {
		idx, action := i, rt.Action
		pattern := strings.Replace(rt.Pattern(aiInstancePrefix), "/agencies/{agencyID}", "", 1)
		mux.HandleFunc(pattern, auth.require(func(w http.ResponseWriter, r *http.Request) {
			instanceID := r.PathValue("instanceID")
			caller := accounts.IDFromContext(r.Context())
			role, err := reg.RoleOf(r.Context(), instanceID, caller)
			if err != nil {
				writeInstanceErr(w, err)
				return
			}
			pctx := context.WithValue(r.Context(), partitionKey{}, instanceID)
			if err := d.aiPermissioned(role, reg, aiAuthorize(role))(pctx, action); err != nil {
				if line, ok := aiRefusalLines[action]; ok && role == agencies.RoleAgent {
					http.Error(w, line, http.StatusForbidden)
					return
				}
				writeInstanceErr(w, agencies.ErrInstanceNotFound)
				return
			}
			m, err := d.AI(r.Context(), instanceID)
			if err != nil {
				writeInstanceErr(w, err)
				return
			}
			routes, err := airoutes.BuildFor(m, airoutes.Mount{Caller: accounts.IDFromContext})
			if err != nil {
				writeInstanceErr(w, err)
				return
			}
			if action == aiChatAction {
				if err := stampChatRequest(r, caller); err != nil {
					http.Error(w, "invalid request body", http.StatusBadRequest)
					return
				}
			}
			r.SetPathValue("agencyID", instanceID)
			routes[idx].Handler(w, r)
		}))
	}
}
