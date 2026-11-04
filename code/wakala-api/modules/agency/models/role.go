package models

type Role struct {
	ID          string   `json:"id"`
	Code        string   `json:"code"`
	DraftID     string   `json:"draft_id,omitempty"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Permissions []string `json:"permissions,omitempty"`
	Staff       bool     `json:"staff"`
	CreatedAt   string   `json:"created_at"`
	LastUpdated string   `json:"last_updated"`
	Deleted     bool     `json:"deleted"`
}
