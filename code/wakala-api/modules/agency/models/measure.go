package models

type Measure struct {
	ID          string `json:"id"`
	DraftID     string `json:"draft_id,omitempty"`
	ObjectiveID string `json:"objective_id"`
	Name        string `json:"name"`
	Current     string `json:"current"`
	Target      string `json:"target"`
	Unit        string `json:"unit"`
	Status      string `json:"status"`
	CreatedAt   string `json:"created_at"`
	LastUpdated string `json:"last_updated"`
	Deleted     bool   `json:"deleted"`
}

type DocumentMeasure struct {
	ObjectiveID string `json:"objective_id"`
	Name        string `json:"name"`
	Current     string `json:"current,omitempty"`
	Target      string `json:"target"`
	Unit        string `json:"unit,omitempty"`
	Status      string `json:"status,omitempty"`
}
