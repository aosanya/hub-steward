package http

import (
	"context"
	"net/http"
	"slices"

	ai "wakalaserver/modules/ai"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

const aiUsePermission = "ai.use"

type seatBriefSource struct {
	reg agencies.Registry
	ai  ai.Manager
}

func (s seatBriefSource) AgencyInstructions(ctx context.Context, agencyID, roleID string) (string, error) {
	role, err := s.ai.GetAIRole(ctx, agencyID, roleID)
	if err != nil {
		return "", err
	}
	if role.AgencyRoleID == "" {
		return "", nil
	}
	m, err := s.reg.AgencyManager(ctx, agencyID)
	if err != nil {
		return "", err
	}
	b, err := m.GetRoleBrief(ctx, role.AgencyRoleID)
	if err != nil {
		return "", nil
	}
	return b.Text, nil
}

func (d *Deps) aiGatewayCaller(reg agencies.Registry) ai.GatewayCaller {
	return func(r *http.Request) (string, string, bool) {
		instanceID := r.PathValue("instanceID")
		caller := accounts.IDFromContext(r.Context())
		role, err := reg.RoleOf(r.Context(), instanceID, caller)
		if err != nil || role != agencies.RoleAgent {
			return "", "", false
		}
		links, ok := reg.(agencies.AgencyRoleLinks)
		if !ok {
			return "", "", false
		}
		ctx := context.WithValue(r.Context(), partitionKey{}, instanceID)
		roleID, err := links.AgencyRoleOf(ctx, instanceID, caller)
		if err != nil || roleID == "" {
			return "", "", false
		}
		codes, err := d.agencyRolePermissions(ctx, roleID)
		if err != nil || !slices.Contains(codes, aiUsePermission) {
			return "", "", false
		}
		return instanceID, roleID, true
	}
}

func (d *Deps) registerAIGateway(mux *http.ServeMux, reg agencies.Registry, auth callers) {
	if d.AI == nil {
		return
	}
	mux.HandleFunc("POST "+aiInstancePrefix+"/v1/chat/completions", auth.require(func(w http.ResponseWriter, r *http.Request) {
		m, err := d.AI(r.Context(), r.PathValue("instanceID"))
		if err != nil {
			writeInstanceErr(w, err)
			return
		}
		ai.NewGateway(m, d.aiGatewayCaller(reg), aiGuardedGatewayClient).ServeHTTP(w, r)
	}))
}

var aiGuardedGatewayClient = newGuardedAIClient(aiChatTimeout)
