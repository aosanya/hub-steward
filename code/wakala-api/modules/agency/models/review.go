package models

type ReviewStatus string

const (
	ReviewRunning ReviewStatus = "running"
	ReviewDone    ReviewStatus = "done"
	ReviewFailed  ReviewStatus = "failed"
)

type ReviewAreaName string

const (
	ReviewAreaProfile     ReviewAreaName = "profile"
	ReviewAreaGoals       ReviewAreaName = "goals"
	ReviewAreaObjectives  ReviewAreaName = "objectives"
	ReviewAreaRolesAgents ReviewAreaName = "roles_agents"
	ReviewAreaWorkflows   ReviewAreaName = "workflows"
	ReviewAreaRisks       ReviewAreaName = "risks"
	ReviewAreaTests       ReviewAreaName = "tests"
)

type ReviewAreaStatus string

const (
	ReviewAreaReading ReviewAreaStatus = "reading"
	ReviewAreaDone    ReviewAreaStatus = "done"
	ReviewAreaFailed  ReviewAreaStatus = "failed"
)

type FindingStatus string

const (
	FindingOpen      FindingStatus = "open"
	FindingApplied   FindingStatus = "applied"
	FindingDismissed FindingStatus = "dismissed"
)

type FindingFate string

const (
	FateNew       FindingFate = "new"
	FateFixed     FindingFate = "fixed"
	FateStillOpen FindingFate = "still_open"
	FateWithdrawn FindingFate = "withdrawn"
)

type FindingStep struct {
	Tool      string         `json:"tool"`
	Arguments map[string]any `json:"arguments,omitempty"`
}

type Review struct {
	ID               string       `json:"id"`
	DraftID          string       `json:"draft_id"`
	Status           ReviewStatus `json:"status"`
	PreviousReviewID string       `json:"previous_review_id"`
	StartedBy        string       `json:"started_by"`
	Running          bool         `json:"running"`
	StartedAt        string       `json:"started_at"`
	FinishedAt       string       `json:"finished_at"`
	Tokens           int          `json:"tokens"`
}

type ReviewArea struct {
	ID            string           `json:"id"`
	ReviewID      string           `json:"review_id"`
	Area          ReviewAreaName   `json:"area"`
	Status        ReviewAreaStatus `json:"status"`
	FailureReason string           `json:"failure_reason"`
	Summary       string           `json:"summary"`
	Tokens        int              `json:"tokens"`
}

type ReviewFinding struct {
	ID            string         `json:"id"`
	ReviewID      string         `json:"review_id"`
	AreaID        string         `json:"area_id"`
	Ordinal       int            `json:"ordinal"`
	Title         string         `json:"title"`
	Detail        string         `json:"detail"`
	Tool          string         `json:"tool"`
	Arguments     map[string]any `json:"arguments,omitempty"`
	ThenSteps     []FindingStep  `json:"then,omitempty"`
	Status        FindingStatus  `json:"status"`
	Fate          FindingFate    `json:"fate"`
	FateReason    string         `json:"fate_reason"`
	CarriedFromID string         `json:"carried_from_id"`
}

type ReviewComment struct {
	ID        string `json:"id"`
	FindingID string `json:"finding_id"`
	Author    string `json:"author"`
	Body      string `json:"body"`
	CreatedAt string `json:"created_at"`
}
