package reviewruns

import "context"

const (
	AreaProfile     = "profile"
	AreaGoals       = "goals"
	AreaObjectives  = "objectives"
	AreaRolesAgents = "roles_agents"
	AreaWorkflows   = "workflows"
	AreaRisks       = "risks"
	AreaTests       = "tests"
)

const (
	FateNew       = "new"
	FateFixed     = "fixed"
	FateStillOpen = "still_open"
	FateWithdrawn = "withdrawn"
)

func Areas() []string {
	return []string{AreaProfile, AreaGoals, AreaObjectives, AreaRolesAgents, AreaWorkflows, AreaRisks, AreaTests}
}

func Fates() []string {
	return []string{FateNew, FateFixed, FateStillOpen, FateWithdrawn}
}

type Finding struct {
	Title         string         `json:"title"`
	Detail        string         `json:"detail"`
	Tool          string         `json:"tool,omitempty"`
	Arguments     map[string]any `json:"arguments,omitempty"`
	Then          string         `json:"then,omitempty"`
	Fate          string         `json:"fate"`
	FateReason    string         `json:"fate_reason,omitempty"`
	CarriedFromID string         `json:"carried_from_id,omitempty"`
	Reopen        bool           `json:"reopen,omitempty"`
}

type Comment struct {
	Author string `json:"author"`
	Body   string `json:"body"`
}

type PreviousFinding struct {
	ID         string         `json:"id"`
	Title      string         `json:"title"`
	Detail     string         `json:"detail"`
	Tool       string         `json:"tool,omitempty"`
	Arguments  map[string]any `json:"arguments,omitempty"`
	Status     string         `json:"status"`
	Fate       string         `json:"fate,omitempty"`
	FateReason string         `json:"fate_reason,omitempty"`
	Comments   []Comment      `json:"comments,omitempty"`
}

type AreaInput struct {
	ReviewID string            `json:"review_id"`
	Area     string            `json:"area"`
	DraftID  string            `json:"draft_id"`
	Previous []PreviousFinding `json:"previous,omitempty"`
}

type AreaResult struct {
	Summary  string    `json:"summary"`
	Findings []Finding `json:"findings"`
	Tokens   int       `json:"tokens"`
}

type Reviewer interface {
	Area() string
	Review(ctx context.Context, in AreaInput) (AreaResult, error)
}
