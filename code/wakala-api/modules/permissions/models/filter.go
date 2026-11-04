package models

type RoleFilter struct {
	Code   string `json:"code,omitempty"`
	Name   string `json:"name,omitempty"`
	Seeded *bool  `json:"seeded,omitempty"`
}

type GrantFilter struct {
	Subject   string `json:"subject,omitempty"`
	Scope     string `json:"scope,omitempty"`
	Partition string `json:"partition,omitempty"`
	RoleCode  string `json:"role_code,omitempty"`
}
