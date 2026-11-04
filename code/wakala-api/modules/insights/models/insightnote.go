package models

type InsightNote struct {
	ID        string `json:"id"`
	InsightID string `json:"insight_id"`
	Source    string `json:"source,omitempty"`
	Text      string `json:"text"`
	CreatedAt string `json:"created_at"`
}
