package http

import (
	"context"
	"fmt"
	"strings"

	ai "wakalaserver/modules/ai"
)

func (s seatBriefSource) AgencyInstructionParts(ctx context.Context, agencyID, roleID string) ([]ai.InstructionPart, error) {
	role, err := s.ai.GetAIRole(ctx, agencyID, roleID)
	if err != nil {
		return nil, err
	}
	if role.AgencyRoleID == "" {
		return nil, nil
	}
	m, err := s.reg.AgencyManager(ctx, agencyID)
	if err != nil {
		return nil, err
	}
	b, err := m.GetRoleBrief(ctx, role.AgencyRoleID)
	if err != nil {
		return nil, nil
	}
	var objectives, statements, items []string
	for _, o := range b.Objectives {
		objectives = append(objectives, fmt.Sprintf("%s %s: %s", o.Code, o.Title, o.Description))
	}
	for _, c := range b.Controls {
		statements = append(statements, "Control "+c.Code+": "+c.Text)
	}
	for _, w := range b.WorkItems {
		if w.Prompt != "" {
			items = append(items, w.Code+" "+w.Title+": "+w.Prompt)
		}
	}
	return []ai.InstructionPart{
		{Source: "seat_description", Text: strings.TrimSpace(b.Name + "\n" + b.Description)},
		{Source: "objectives", Text: strings.Join(objectives, "\n")},
		{Source: "values_rules", Text: strings.Join(statements, "\n")},
		{Source: "work_item_instructions", Text: strings.Join(items, "\n")},
	}, nil
}
