package models

type ScopeFigure struct {
	ID         string `json:"id"`
	ScopeID    string `json:"scope_id"`
	Value      int    `json:"value"`
	AsOf       string `json:"as_of"`
	Source     string `json:"source"`
	RecordedBy string `json:"recorded_by"`
	CreatedAt  string `json:"created_at"`
}
