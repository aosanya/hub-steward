package reviewruns

const (
	ReviewRunning = "running"
	ReviewDone    = "done"
	ReviewFailed  = "failed"

	AreaReading = "reading"
	AreaDone    = "done"
	AreaFailed  = "failed"
)

type Review struct {
	ID               string `json:"id"`
	DraftID          string `json:"draft_id"`
	Status           string `json:"status"`
	PreviousReviewID string `json:"previous_review_id"`
	StartedBy        string `json:"started_by"`
	StartedAt        string `json:"started_at"`
	FinishedAt       string `json:"finished_at"`
	Tokens           int    `json:"tokens"`
}

type Area struct {
	ID            string `json:"id"`
	ReviewID      string `json:"review_id"`
	Area          string `json:"area"`
	Status        string `json:"status"`
	FailureReason string `json:"failure_reason"`
	Summary       string `json:"summary"`
	Tokens        int    `json:"tokens"`
}

type Page struct {
	Review *Review `json:"review"`
	Areas  []Area  `json:"areas,omitempty"`
}

type Running struct {
	InstanceID string
	Page       Page
}

func (p Page) Reading() []string {
	var names []string
	for _, a := range p.Areas {
		if a.Status == AreaReading {
			names = append(names, a.Area)
		}
	}
	return names
}
