package models

type RiskSide string

const (
	RiskSideThreat      RiskSide = "threat"
	RiskSideConsequence RiskSide = "consequence"
)

func (s RiskSide) Valid() bool {
	return s == RiskSideThreat || s == RiskSideConsequence
}

type Risk struct {
	ID          string `json:"id"`
	Code        string `json:"code"`
	DraftID     string `json:"draft_id,omitempty"`
	Title       string `json:"title"`
	TopEvent    string `json:"top_event"`
	Hazard      string `json:"hazard"`
	HazardCode  string `json:"hazard_code"`
	Owner       string `json:"owner"`
	CreatedAt   string `json:"created_at"`
	LastUpdated string `json:"last_updated"`
	Deleted     bool   `json:"deleted"`
}

type RiskPathway struct {
	ID          string   `json:"id"`
	Code        string   `json:"code"`
	DraftID     string   `json:"draft_id,omitempty"`
	RiskID      string   `json:"risk_id"`
	Side        RiskSide `json:"side"`
	Title       string   `json:"title"`
	Scenario    string   `json:"scenario"`
	CreatedAt   string   `json:"created_at"`
	LastUpdated string   `json:"last_updated"`
	Deleted     bool     `json:"deleted"`
}

type DocumentRisk struct {
	ID         string `json:"id"`
	Code       string `json:"code"`
	Title      string `json:"title"`
	TopEvent   string `json:"top_event"`
	Hazard     string `json:"hazard,omitempty"`
	HazardCode string `json:"hazard_code,omitempty"`
	Owner      string `json:"owner,omitempty"`
}

type DocumentRiskPathway struct {
	ID       string   `json:"id"`
	Code     string   `json:"code"`
	RiskID   string   `json:"risk_id"`
	Side     RiskSide `json:"side"`
	Title    string   `json:"title"`
	Scenario string   `json:"scenario,omitempty"`
}
