package models

type Entry struct {
	ID         string `json:"id"`
	InstanceID string `json:"instance_id"`
	Actor      string `json:"actor"`
	Action     string `json:"action"`
	Subject    string `json:"subject"`
	At         string `json:"at"`
}
