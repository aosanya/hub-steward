package mwanachamaagency

const (
	ApprovedByPrompt = "Approved by"
	ApprovedAtPrompt = "Approved at"

	ApprovedOverLimitPrompt = "Approved over the limit"
	LimitInForcePrompt      = "Limit that applied"
)

func isApprovalStampPrompt(prompt string) bool {
	return prompt == ApprovedByPrompt || prompt == ApprovedAtPrompt ||
		prompt == ApprovedOverLimitPrompt || prompt == LimitInForcePrompt
}
