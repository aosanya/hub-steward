package models

type BoardItem struct {
	ID           string `json:"id"`
	Title        string `json:"title"`
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
