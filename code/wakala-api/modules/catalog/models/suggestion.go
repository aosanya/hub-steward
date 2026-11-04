package models

const MaxSuggestionAttempts = 10

const DefaultSuggestionPriority = 100

type Suggestion struct {
	ID        string           `json:"id"`
	Slug      string           `json:"slug"`
	Title     string           `json:"title"`
	Why       string           `json:"why,omitempty"`
	Source    SuggestionSource `json:"source"`
	Status    SuggestionStatus `json:"status"`
	Priority  int              `json:"priority"`
	Attempts  int              `json:"attempts"`
	Proposal  string           `json:"proposal,omitempty"`
	RunRef    string           `json:"run_ref,omitempty"`
	CreatedAt string           `json:"created_at"`
	DecidedAt string           `json:"decided_at,omitempty"`
}

type SuggestionComment struct {
	ID           string        `json:"id"`
	SuggestionID string        `json:"suggestion_id"`
	Author       CommentAuthor `json:"author"`
	RunRef       string        `json:"run_ref,omitempty"`
	Attempt      int           `json:"attempt,omitempty"`
	Body         string        `json:"body"`
	CreatedAt    string        `json:"created_at"`
}

type SuggestionMatch struct {
	SuggestionID string `json:"suggestion_id"`
	Slug         string `json:"slug"`
	RunRef       string `json:"run_ref,omitempty"`
	Note         string `json:"note,omitempty"`
	MetAt        string `json:"met_at"`
}
