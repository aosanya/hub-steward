package models

type WorkflowObjective struct {
	ID          string `json:"id"`
	DraftID     string `json:"draft_id,omitempty"`
	WorkflowID  string `json:"workflow_id"`
	ObjectiveID string `json:"objective_id"`
	CreatedAt   string `json:"created_at"`
	LastUpdated string `json:"last_updated"`
	Deleted     bool   `json:"deleted"`
}
