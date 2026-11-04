package models

type Record struct {
	ID           string         `json:"id"`
	Code         string         `json:"code"`
	DraftID      string         `json:"draft_id,omitempty"`
	WorkflowID   string         `json:"workflow_id"`
	Name         string         `json:"name"`
	RoleID       string         `json:"role_id"`
	ViewerRoleID string         `json:"viewer_role_id"`
	FormName     string         `json:"form_name"`
	Questions    []StepQuestion `json:"questions,omitempty"`
	CreatedAt    string         `json:"created_at"`
	LastUpdated  string         `json:"last_updated"`
	Deleted      bool           `json:"deleted"`
}

type RecordRow struct {
	ID          string            `json:"id"`
	DraftID     string            `json:"draft_id,omitempty"`
	RecordID    string            `json:"record_id"`
	RecordCode  string            `json:"record_code"`
	RoleID      string            `json:"role_id"`
	AddedBy     string            `json:"added_by"`
	Answers     map[string]string `json:"answers,omitempty"`
	OrderID     string            `json:"order_id,omitempty"`
	Replaces    string            `json:"replaces,omitempty"`
	CorrectedOn string            `json:"corrected_on,omitempty"`
	CreatedAt   string            `json:"created_at"`
	LastUpdated string            `json:"last_updated"`
	Deleted     bool              `json:"deleted"`
}

type DocumentRecord struct {
	ID           string         `json:"id"`
	Code         string         `json:"code"`
	WorkflowID   string         `json:"workflow_id"`
	Name         string         `json:"name"`
	RoleID       string         `json:"role_id"`
	ViewerRoleID string         `json:"viewer_role_id,omitempty"`
	FormName     string         `json:"form_name"`
	Questions    []StepQuestion `json:"questions,omitempty"`
}
