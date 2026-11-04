package mwanachamaagency

import (
	"context"
	"fmt"

	"wakalaserver/modules/agency/models"
)

func (m *agencyManager) UnguardedPathways(ctx context.Context, draftID string) ([]models.RiskPathway, error) {
	pathways, err := m.ListRiskPathways(ctx, draftID, RiskPathwayFilter{})
	if err != nil {
		return nil, fmt.Errorf("UnguardedPathways: %w", err)
	}
	attachments, err := list[models.ControlAttachment](m,
		scopeQuery(m.q(ctx, roleControlAttachment), draftID).Where("target_type = ?", string(models.TargetTypeRiskPathway)),
		roleControlAttachment)
	if err != nil {
		return nil, fmt.Errorf("UnguardedPathways: %w", err)
	}
	guarded := make(map[string]bool, len(attachments))
	for _, a := range attachments {
		guarded[a.TargetCode] = true
	}
	var out []models.RiskPathway
	for _, p := range pathways {
		if !guarded[p.Code] {
			out = append(out, p)
		}
	}
	return out, nil
}
