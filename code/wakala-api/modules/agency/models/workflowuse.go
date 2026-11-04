package models

type WorkflowRunUse struct {
	WorkflowCode    string `json:"workflow_code"`
	WorkflowVersion int    `json:"workflow_version"`
}

const CancelWorkflowCode = "cancel"
