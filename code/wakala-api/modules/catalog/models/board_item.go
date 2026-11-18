package models

type BoardItem struct {
	ID           string `json:"id"`
	Title        string `json:"title"`
	Kind         string `json:"kind"`
	Outcome      string `json:"outcome"`
	Hidden       bool   `json:"hidden"`
	AssigneeKind string `json:"assignee_kind"`
	AssigneeID   string `json:"assignee_id"`
	ClosedAt     string `json:"closed_at"`
	ClosedBy     string `json:"closed_by"`
	CreatedAt    string `json:"created_at"`
}

const (
	AssigneeActor = "actor"
	AssigneeRole  = "role"
)

const (
	KindComplaint = "complaint"
	KindIdea      = "idea"
)

func IsBoardItemKind(kind string) bool {
	return kind == "" || kind == KindComplaint || kind == KindIdea
}

func IsAssigneeKind(kind string) bool {
	return kind == AssigneeActor || kind == AssigneeRole
}

type BoardItemTally struct {
	BoardItem
	RaisedBy int `json:"raised_by"`
	MeToo    int `json:"me_too"`
}

type SharedBoardItem struct {
	Title  string   `json:"title"`
	Theme  string   `json:"theme"`
	Area   string   `json:"area"`
	MeToo  int      `json:"me_too"`
	Status string   `json:"status"`
	Files  []string `json:"files"`
}

type AreaTally struct {
	Area       string `json:"area"`
	RaisedBy   int    `json:"raised_by"`
	MeToo      int    `json:"me_too"`
	Population *int   `json:"population"`
}

type BoardItemAreaTally struct {
	ID    string      `json:"id"`
	Title string      `json:"title"`
	Areas []AreaTally `json:"areas"`
}

type AreaPopulation struct {
	Area       string
	Population int
}
