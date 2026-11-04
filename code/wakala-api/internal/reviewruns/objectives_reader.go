package reviewruns

import (
	"context"
	"fmt"
	"strings"

	mwanachamaagency "wakalaserver/modules/agency"
	"wakalaserver/modules/agency/models"
)

type ObjectivesAgency interface {
	ListGoals(ctx context.Context, draftID string, filter mwanachamaagency.GoalFilter) ([]models.Goal, error)
	ListObjectives(ctx context.Context, draftID string, filter mwanachamaagency.ObjectiveFilter) ([]models.Objective, error)
}

func NewObjectivesReader(agency ObjectivesAgency) DraftReader {
	return DraftReaderFunc(func(ctx context.Context, draftID string) (string, error) {
		goals, err := agency.ListGoals(ctx, draftID, mwanachamaagency.GoalFilter{})
		if err != nil {
			return "", err
		}
		objectives, err := agency.ListObjectives(ctx, draftID, mwanachamaagency.ObjectiveFilter{})
		if err != nil {
			return "", err
		}
		return objectivesText(draftID, goals, objectives), nil
	})
}

func objectivesText(draftID string, goals []models.Goal, objectives []models.Objective) string {
	var b strings.Builder
	fmt.Fprintf(&b, "Draft id: %s\n", draftID)
	if len(goals) == 0 {
		b.WriteString("This draft has no goals yet.\n")
	}
	placed := map[string]bool{}
	for _, g := range goals {
		fmt.Fprintf(&b, "\nGoal %s (id %s, position %d): %s\n", g.Code, g.ID, g.Ordinality, g.Title)
		if g.Description != "" {
			fmt.Fprintf(&b, "  description: %s\n", g.Description)
		}
		under := objectivesUnder(objectives, g.ID)
		if len(under) == 0 {
			b.WriteString("  Objectives: none\n")
			continue
		}
		b.WriteString("  Objectives:\n")
		for _, o := range under {
			placed[o.ID] = true
			writeObjective(&b, o)
		}
	}
	var loose []models.Objective
	for _, o := range objectives {
		if !placed[o.ID] {
			loose = append(loose, o)
		}
	}
	if len(loose) > 0 {
		b.WriteString("\nObjectives under no goal of this draft:\n")
		for _, o := range loose {
			writeObjective(&b, o)
		}
	}
	return b.String()
}

func objectivesUnder(objectives []models.Objective, goalID string) []models.Objective {
	var out []models.Objective
	for _, o := range objectives {
		if o.GoalID == goalID {
			out = append(out, o)
		}
	}
	return out
}

func writeObjective(b *strings.Builder, o models.Objective) {
	fmt.Fprintf(b, "  - Objective %s (id %s, goal_id %s, position %d): %s\n", o.Code, o.ID, o.GoalID, o.Ordinality, o.Title)
	if o.Description != "" {
		fmt.Fprintf(b, "    description: %s\n", o.Description)
	}
}
