package models

type PermissionLayer string

const (
	PermissionLayerDefinition PermissionLayer = "definition"
	PermissionLayerOverride   PermissionLayer = "override"
)

type Permission struct {
	Partition  string          `json:"partition"`
	Permission string          `json:"permission"`
	RoleKind   string          `json:"role_kind"`
	Layer      PermissionLayer `json:"layer"`
	Held       bool            `json:"held"`
	SetBy      string          `json:"set_by,omitempty"`
	SetAt      string          `json:"set_at"`
}
