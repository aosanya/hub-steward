package models

type Role struct {
	Code        string `json:"code"`
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	Seeded      bool   `json:"seeded"`
	CreatedAt   string `json:"created_at"`
	UpdatedAt   string `json:"updated_at"`
	Deleted     bool   `json:"deleted"`
}

type RoleAction struct {
	RoleCode  string `json:"role_code"`
	Action    string `json:"action"`
	CreatedAt string `json:"created_at"`
}
