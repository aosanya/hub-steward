package models

type Workbook struct {
	ID        string `json:"id"`
	Owner     string `json:"owner"`
	Title     string `json:"title"`
	Summary   string `json:"summary,omitempty"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
	Deleted   bool   `json:"deleted"`
}

type Reference struct {
	ID         string `json:"id"`
	WorkbookID string `json:"workbook_id"`
	Module     string `json:"module"`
	Scope      string `json:"scope,omitempty"`
	Item       string `json:"item,omitempty"`
	Label      string `json:"label"`
	FirstSeen  string `json:"first_seen"`
	LastSeen   string `json:"last_seen"`
	Deleted    bool   `json:"deleted"`
}

type Use struct {
	ID          string `json:"id"`
	WorkbookID  string `json:"workbook_id"`
	Action      string `json:"action"`
	ReferenceID string `json:"reference_id,omitempty"`
	Subject     string `json:"subject,omitempty"`
	At          string `json:"at"`
}

type Shortcut struct {
	WorkbookID string `json:"workbook_id"`
	Action     string `json:"action"`
	Label      string `json:"label"`
	Uses       int    `json:"uses"`
	LastUsed   string `json:"last_used"`
}
