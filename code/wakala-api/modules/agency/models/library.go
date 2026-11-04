package models

type Hazard struct {
	ID          string `json:"id"`
	Code        string `json:"code"`
	DraftID     string `json:"draft_id"`
	Title       string `json:"title"`
	Description string `json:"description,omitempty"`
	CreatedAt   string `json:"created_at"`
	LastUpdated string `json:"last_updated"`
	Deleted     bool   `json:"deleted"`
}

type Threat struct {
	ID          string `json:"id"`
	Code        string `json:"code"`
	DraftID     string `json:"draft_id"`
	Title       string `json:"title"`
	Description string `json:"description,omitempty"`
	CreatedAt   string `json:"created_at"`
	LastUpdated string `json:"last_updated"`
	Deleted     bool   `json:"deleted"`
}

type Consequence struct {
	ID          string `json:"id"`
	Code        string `json:"code"`
	DraftID     string `json:"draft_id"`
	HazardCode  string `json:"hazard_code"`
	Title       string `json:"title"`
	Description string `json:"description,omitempty"`
	CreatedAt   string `json:"created_at"`
	LastUpdated string `json:"last_updated"`
	Deleted     bool   `json:"deleted"`
}

type RiskThreat struct {
	ID         string `json:"id"`
	DraftID    string `json:"draft_id"`
	RiskCode   string `json:"risk_code"`
	ThreatCode string `json:"threat_code"`
	CreatedAt  string `json:"created_at"`
}

type RiskConsequence struct {
	ID              string `json:"id"`
	DraftID         string `json:"draft_id"`
	RiskCode        string `json:"risk_code"`
	ConsequenceCode string `json:"consequence_code"`
	CreatedAt       string `json:"created_at"`
}
