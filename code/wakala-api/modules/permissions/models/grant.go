package models

type Grant struct {
	Subject   string `json:"subject"`
	Scope     string `json:"scope"`
	Partition string `json:"partition,omitempty"`
	RoleCode  string `json:"role_code"`
	GrantedBy string `json:"granted_by,omitempty"`
	GrantedAt string `json:"granted_at"`
	EndsAt    string `json:"ends_at,omitempty"`
	Deleted   bool   `json:"deleted"`
}

const ScopeEverywhere = "*"

const ScopeRecordPrefix = "record:"
