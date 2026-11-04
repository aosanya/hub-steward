package models

import "time"

type Entry struct {
	ID          string     `json:"id"`
	Slug        string     `json:"slug"`
	Name        string     `json:"name"`
	Summary     string     `json:"summary,omitempty"`
	Doc         string     `json:"doc"`
	Visibility  Visibility `json:"visibility"`
	SubmittedBy string     `json:"submitted_by,omitempty"`
	ApprovedAt  string     `json:"approved_at,omitempty"`
	PublishAt   string     `json:"publish_at,omitempty"`
	DisposeAt   string     `json:"dispose_at,omitempty"`
	CreatedAt   string     `json:"created_at"`
	UpdatedAt   string     `json:"updated_at"`
	Deleted     bool       `json:"deleted"`
}

const (
	MaxPublicEntryLimit = 100
	DefaultEntryLimit   = 100
	MaxDocFilters       = 10
)

func NormalizePublishAt(at string) (string, bool) {
	if at == "" {
		return "", true
	}
	t, err := time.Parse(time.RFC3339, at)
	if err != nil {
		return "", false
	}
	return t.UTC().Format(time.RFC3339), true
}

func (e Entry) PublishedBy(now string) bool {
	return e.PublishAt == "" || e.PublishAt <= now
}

func (e Entry) RetainedAt(now string) bool {
	return e.DisposeAt == "" || e.DisposeAt > now
}
