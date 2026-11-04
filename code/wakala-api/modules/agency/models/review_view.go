package models

type FindingView struct {
	ReviewFinding
	Comments []ReviewComment `json:"comments"`
}

type ReviewAreaView struct {
	ReviewArea
	Findings []FindingView `json:"findings"`
}

type ReviewView struct {
	Review *Review          `json:"review"`
	Areas  []ReviewAreaView `json:"areas,omitempty"`
}

type ReviewInput struct {
	Previous []FindingView `json:"previous"`
}

type ReviewFindingInput struct {
	Title         string         `json:"title"`
	Detail        string         `json:"detail"`
	Tool          string         `json:"tool"`
	Arguments     map[string]any `json:"arguments"`
	ThenSteps     []FindingStep  `json:"then"`
	Fate          FindingFate    `json:"fate"`
	FateReason    string         `json:"fate_reason"`
	CarriedFromID string         `json:"carried_from_id"`
	Reopen        bool           `json:"reopen"`
}

var ReviewAreaOrder = []ReviewAreaName{
	ReviewAreaProfile, ReviewAreaGoals, ReviewAreaObjectives, ReviewAreaRolesAgents,
	ReviewAreaWorkflows, ReviewAreaRisks, ReviewAreaTests,
}

func (a ReviewAreaName) Valid() bool {
	for _, known := range ReviewAreaOrder {
		if a == known {
			return true
		}
	}
	return false
}

func (s FindingStatus) Valid() bool {
	return s == FindingOpen || s == FindingApplied || s == FindingDismissed
}

func (f FindingFate) Valid() bool {
	return f == FateNew || f == FateFixed || f == FateStillOpen || f == FateWithdrawn
}
