package models

type OpensIn string

const (
	OpensInForm OpensIn = "form"
	OpensInChat OpensIn = "chat"
)

func (o OpensIn) Valid() bool { return o == "" || o == OpensInForm || o == OpensInChat }

func (o OpensIn) Normalized() OpensIn {
	if o == OpensInForm {
		return ""
	}
	return o
}

type Workflow struct {
	ID           string  `json:"id"`
	Code         string  `json:"code"`
	DraftID      string  `json:"draft_id,omitempty"`
	Name         string  `json:"name"`
	Description  string  `json:"description"`
	Ordinality   int     `json:"ordinality"`
	EventFlows   string  `json:"event_flows,omitempty"`
	OpensIn      OpensIn `json:"opens_in,omitempty"`
	CancelsOrder bool    `json:"cancels_order"`
	CreatedAt    string  `json:"created_at"`
	LastUpdated  string  `json:"last_updated"`
	Deleted      bool    `json:"deleted"`

	Default        bool  `json:"default,omitempty" spec:"-"`
	InUse          bool  `json:"in_use" spec:"-"`
	Version        int   `json:"version" spec:"-"`
	OrdersUnderWay int   `json:"orders_under_way" spec:"-"`
	OrderVersions  []int `json:"order_versions,omitempty" spec:"-"`
}

func (w Workflow) IsChat() bool { return w.OpensIn == OpensInChat }
