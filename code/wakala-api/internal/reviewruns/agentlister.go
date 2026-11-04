package reviewruns

import (
	"context"

	mwanachamaagency "wakalaserver/modules/agency"
	agencymodels "wakalaserver/modules/agency/models"
	aimodels "wakalaserver/modules/ai/models"
)

type AIRoleLister interface {
	ListAIRoles(ctx context.Context, agencyID string) ([]aimodels.AIRole, error)
}

type AgencyRoleLister interface {
	ListRoles(ctx context.Context, draftID string, filter mwanachamaagency.RoleFilter) ([]agencymodels.Role, error)
}

func NewAIRoleAgentLister(roles AIRoleLister, agency AgencyRoleLister, agencyID string) RolesAgentsAgentLister {
	return func(ctx context.Context, draftID string) ([]RolesAgentsAgent, error) {
		held, err := roles.ListAIRoles(ctx, agencyID)
		if err != nil {
			return nil, err
		}
		if len(held) == 0 {
			return nil, nil
		}
		seats, err := agency.ListRoles(ctx, draftID, mwanachamaagency.RoleFilter{})
		if err != nil {
			return nil, err
		}
		codes := make(map[string]string, len(seats))
		for _, s := range seats {
			codes[s.ID] = s.Code
		}
		agents := make([]RolesAgentsAgent, 0, len(held))
		for _, r := range held {
			agents = append(agents, RolesAgentsAgent{Name: r.Name, Description: r.Description, RoleCode: codes[r.AgencyRoleID]})
		}
		return agents, nil
	}
}
