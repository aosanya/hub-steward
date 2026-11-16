package models

type Agenda struct {
	ID         string   `json:"id"`
	InstanceID string   `json:"instance_id"`
	MeetingID  string   `json:"meeting_id"`
	Items      []string `json:"items"`
	CreatedAt  string   `json:"created_at"`
	UpdatedAt  string   `json:"updated_at"`
}
