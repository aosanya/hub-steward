package mwanachamaagency

const (
	ApprovedByPrompt = "Approved by"
	ApprovedAtPrompt = "Approved at"
)

func isApprovalStampPrompt(prompt string) bool {
	return prompt == ApprovedByPrompt || prompt == ApprovedAtPrompt
}
