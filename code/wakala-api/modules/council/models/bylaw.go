package models

type Bylaw struct {
	ID         string `json:"id"`
	InstanceID string `json:"instance_id"`
	Title      string `json:"title"`
	Year       int64  `json:"year"`
	Text       string `json:"text"`
	CreatedAt  string `json:"created_at"`
}
