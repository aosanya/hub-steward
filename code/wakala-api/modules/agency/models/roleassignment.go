package models

type RACILabel string

const (
	RACILabelResponsible RACILabel = "responsible"
	RACILabelAccountable RACILabel = "accountable"
	RACILabelConsulted   RACILabel = "consulted"
	RACILabelInformed    RACILabel = "informed"
)

func (l RACILabel) Valid() bool {
	switch l {
	case RACILabelResponsible, RACILabelAccountable, RACILabelConsulted, RACILabelInformed:
		return true
	default:
		return false
	}
}

type RoleAssignment struct {
	ID          string    `json:"id"`
	DraftID     string    `json:"draft_id,omitempty"`
	WorkItemID  string    `json:"work_item_id"`
	RoleID      string    `json:"role_id"`
	Label       RACILabel `json:"label"`
	CreatedAt   string    `json:"created_at"`
	LastUpdated string    `json:"last_updated"`
	Deleted     bool      `json:"deleted"`
}
