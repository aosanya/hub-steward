package models

type Account struct {
	ID       string          `json:"id"`
	Code     string          `json:"code,omitempty"`
	Name     string          `json:"name,omitempty"`
	Category AccountCategory `json:"category"`
	Type     AccountType     `json:"type"`
	HolderID string          `json:"holder_id"`
	OpenedAt string          `json:"opened_at"`
	ClosedAt string          `json:"closed_at,omitempty"`
}

type Entry struct {
	ID              string            `json:"id"`
	PostedAt        string            `json:"posted_at"`
	OccurredAt      string            `json:"occurred_at,omitempty"`
	DueAt           string            `json:"due_at,omitempty"`
	DebitAccountID  string            `json:"debit_account_id"`
	CreditAccountID string            `json:"credit_account_id"`
	Amount          int64             `json:"amount"`
	DocumentKind    DocumentKind      `json:"document_kind"`
	DocumentID      string            `json:"document_id"`
	ActorID         string            `json:"actor_id"`
	Narration       string            `json:"narration,omitempty"`
	Dimensions      map[string]string `json:"dimensions,omitempty"`
	ReversesEntryID string            `json:"reverses_entry_id,omitempty"`
	SettlesEntryID  string            `json:"settles_entry_id,omitempty"`
}

type Budget struct {
	ID          string `json:"id"`
	AccountID   string `json:"account_id"`
	PeriodStart string `json:"period_start"`
	PeriodEnd   string `json:"period_end"`
	Name        string `json:"name,omitempty"`
	Department  string `json:"department,omitempty"`
	Amount      int64  `json:"amount"`
	SetAt       string `json:"set_at"`
	Version     string `json:"version,omitempty" spec:"-"`
}

type BudgetLine struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Department  string `json:"department"`
	AccountID   string `json:"account_id"`
	PeriodStart string `json:"period_start"`
	PeriodEnd   string `json:"period_end"`
	Planned     int64  `json:"planned"`
	Spent       int64  `json:"spent"`
	SetAt       string `json:"set_at"`
}

type Variance struct {
	AccountID   string `json:"account_id"`
	PeriodStart string `json:"period_start"`
	PeriodEnd   string `json:"period_end"`
	Budgeted    int64  `json:"budgeted"`
	Actual      int64  `json:"actual"`
	Difference  int64  `json:"difference"`
}

type AgeBasis string

const (
	AgeFromDue    AgeBasis = "due"
	AgeFromRaised AgeBasis = "raised"
)

type OverdueEntry struct {
	Entry
	Outstanding int64 `json:"outstanding"`
	DaysOverdue int64 `json:"days_overdue"`
	AgeDays     int64 `json:"age_days"`
}

type Overdue struct {
	AccountID string         `json:"account_id"`
	AsOf      string         `json:"as_of"`
	AgeFrom   AgeBasis       `json:"age_from"`
	Items     []OverdueEntry `json:"items"`
}
