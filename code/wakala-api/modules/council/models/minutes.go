package models

type Minutes struct {
	ID         string `json:"id"`
	InstanceID string `json:"instance_id"`
	MeetingID  string `json:"meeting_id"`
	Text       string `json:"text"`
	CreatedAt  string `json:"created_at"`
	UpdatedAt  string `json:"updated_at"`
}
