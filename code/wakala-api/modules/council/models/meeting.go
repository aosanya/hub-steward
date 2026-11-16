package models

type Meeting struct {
	ID         string `json:"id"`
	InstanceID string `json:"instance_id"`
	Name       string `json:"name"`
	Date       string `json:"date"`
	Place      string `json:"place"`
	Committee  string `json:"committee"`
	CreatedAt  string `json:"created_at"`
}
