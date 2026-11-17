package models

type PaymentKind string

const (
	PaymentOfBill        PaymentKind = "bill"
	PaymentOfCertificate PaymentKind = "certificate"
)

func IsPaymentKind(k PaymentKind) bool {
	return k == PaymentOfBill || k == PaymentOfCertificate
}

type MarkPaidInput struct {
	BillID        string `json:"billID"`
	CashAccountID string `json:"cash_account_id"`
	Amount        int64  `json:"amount,omitempty"`
	PaidOn        string `json:"paid_on,omitempty"`
	Narration     string `json:"narration,omitempty"`
	PaidBy        string `json:"paid_by"`
}

type Payment struct {
	ID              string      `json:"id"`
	Kind            PaymentKind `json:"kind"`
	DebitAccountID  string      `json:"debit_account_id"`
	CreditAccountID string      `json:"credit_account_id"`
	Amount          int64       `json:"amount"`
	PaidAt          string      `json:"paid_at"`
	PaidBy          string      `json:"paid_by"`
	Narration       string      `json:"narration,omitempty"`
	BillID          string      `json:"bill_id,omitempty"`
	Payer           string      `json:"payer,omitempty"`
	PayerActorID    string      `json:"payer_actor_id,omitempty"`
	CertificateID   string      `json:"certificate_id,omitempty"`
	MilestoneID     string      `json:"milestone_id,omitempty"`
	ContractID      string      `json:"contract_id,omitempty"`
}
