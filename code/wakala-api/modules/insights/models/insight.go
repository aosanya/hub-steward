package models

const (
	SourceAuto = "auto"
	SourceUser = "user"
)

type Insight struct {
	ID          string `json:"id"`
	Repo        string `json:"repo,omitempty"`
	SubjectID   string `json:"subject_id,omitempty"`
	ContextID   string `json:"context_id,omitempty"`
	Source      string `json:"source,omitempty"`
	Summary     string `json:"summary"`
	Tags        string `json:"tags,omitempty"`
	Challenges  string `json:"challenges,omitempty"`
	Suggestions string `json:"suggestions,omitempty"`
	CreatedAt   string `json:"created_at"`
}
