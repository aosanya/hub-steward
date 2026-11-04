package reviewruns

import (
	"context"
	"fmt"
	"strings"

	mwanachamaagency "wakalaserver/modules/agency"
)

const goalsNoneSentence = "This draft has no goals yet."

type GoalsRow struct {
	ID          string
	Code        string
	Title       string
	Description string
	Position    int
}

type GoalsSource interface {
	ListGoals(ctx context.Context, draftID string) ([]GoalsRow, error)
}

type goalsManagerSource struct {
	manager mwanachamaagency.AgencyManager
}

func NewGoalsManagerSource(manager mwanachamaagency.AgencyManager) GoalsSource {
	return goalsManagerSource{manager: manager}
}

func (s goalsManagerSource) ListGoals(ctx context.Context, draftID string) ([]GoalsRow, error) {
	goals, err := s.manager.ListGoals(ctx, draftID, mwanachamaagency.GoalFilter{})
	if err != nil {
		return nil, err
	}
	rows := make([]GoalsRow, 0, len(goals))
	for _, g := range goals {
		rows = append(rows, GoalsRow{ID: g.ID, Code: g.Code, Title: g.Title, Description: g.Description, Position: g.Ordinality})
	}
	return rows, nil
}

func NewGoalsReader(src GoalsSource) DraftReader {
	return DraftReaderFunc(func(ctx context.Context, draftID string) (string, error) {
		rows, err := src.ListGoals(ctx, draftID)
		if err != nil {
			return "", fmt.Errorf("The goals of this draft could not be read: %w", err)
		}
		return goalsText(rows), nil
	})
}

func goalsText(rows []GoalsRow) string {
	if len(rows) == 0 {
		return goalsNoneSentence
	}
	var b strings.Builder
	for i, g := range rows {
		if i > 0 {
			b.WriteString("\n")
		}
		fmt.Fprintf(&b, "Goal %s (goal_id: %s, ordinality: %d)\nTitle: %s\nDescription: %s\n", g.Code, g.ID, g.Position, g.Title, goalsOrNone(g.Description))
	}
	return b.String()
}

func goalsOrNone(text string) string {
	if strings.TrimSpace(text) == "" {
		return "(none)"
	}
	return text
}
