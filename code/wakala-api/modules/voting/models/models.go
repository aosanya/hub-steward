package models

type Poll struct {
	ID                string   `json:"id"`
	Question          string   `json:"question"`
	Mode              string   `json:"mode"`
	MaxChoices        int      `json:"max_choices,omitempty"`
	Budget            int      `json:"budget,omitempty"`
	ChangeAllowed     bool     `json:"change_allowed"`
	PerGroup          string   `json:"per_group"`
	GroupIDs          []string `json:"group_ids"`
	OpensAt           string   `json:"opens_at"`
	ClosesAt          string   `json:"closes_at"`
	State             string   `json:"state"`
	PublishedAt       string   `json:"published_at,omitempty"`
	PublishedBy       string   `json:"published_by,omitempty"`
	PublishedGroupIDs []string `json:"published_group_ids,omitempty"`
	CreatedBy         string   `json:"created_by,omitempty"`
	CreatedAt         string   `json:"created_at"`
	Choices           []Choice `json:"choices,omitempty" spec:"-"`
}

type Choice struct {
	ID        string `json:"id"`
	PollID    string `json:"poll_id"`
	Label     string `json:"label"`
	Position  int    `json:"position"`
	CreatedAt string `json:"created_at"`
}

type Participation struct {
	ID         string `json:"id"`
	PollID     string `json:"poll_id"`
	AnsweredBy string `json:"answered_by"`
	GroupID    string `json:"group_id,omitempty"`
	AnsweredAt string `json:"answered_at"`
}

type Ballot struct {
	ID         string         `json:"id"`
	PollID     string         `json:"poll_id"`
	ResponseID string         `json:"response_id,omitempty"`
	GroupID    string         `json:"group_id,omitempty"`
	Votes      map[string]int `json:"votes"`
	CastAt     string         `json:"cast_at"`
}
