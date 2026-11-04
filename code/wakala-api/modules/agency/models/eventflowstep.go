package models

// EventFlowStep is the queryable, structured projection of one step of a
// Workflow's EventFlows JSON blob: which topic/consumer triggers it, which
// handler runs it, and what it emits on success or error.
type EventFlowStep struct {
	ID string `json:"id"`
	// DraftID is "" for a live EventFlowStep, or the owning Draft's ID for
	// a draft-scoped copy.
	DraftID string `json:"draft_id,omitempty"`
	// Code is "<workflow_code>:<step>", e.g. "planning:1.1.1.2.1".
	Code string `json:"code"`
	// WorkflowCode is the denormalized parent workflow's code, joined by
	// business key rather than a row ID.
	WorkflowCode string `json:"workflow_code"`
	// Step is the dotted step number from the source flow file, e.g.
	// "1.1.1.2.1".
	Step        string `json:"step"`
	Name        string `json:"name"`
	Description string `json:"description"`
	// StepType is "start", "function-call", or "handler".
	StepType string `json:"step_type"`
	// TriggerTopic is the topic that fires this step; "" for a "start" step.
	TriggerTopic     string `json:"trigger_topic,omitempty"`
	TriggerPublisher string `json:"trigger_publisher,omitempty"`
	// Consumer is the service that runs this step's handler.
	Consumer string `json:"consumer"`
	// HandlerCode is the code of the handler that executes this step.
	HandlerCode string `json:"handler_code"`
	// EmitsTopics and OnErrorEmitsTopics are comma-joined topic lists.
	EmitsTopics        string `json:"emits_topics,omitempty"`
	OnErrorEmitsTopics string `json:"on_error_emits_topics,omitempty"`
	Ordinality         int    `json:"ordinality"`
	CreatedAt          string `json:"created_at"`
	LastUpdated        string `json:"last_updated"`
	Deleted            bool   `json:"deleted"`
}

// EventFlowStepLookup selects one EventFlowStep by whichever key is set,
// in precedence order: HandlerCode, then (TriggerTopic, Consumer)
// together, then Code.
type EventFlowStepLookup struct {
	HandlerCode  string `query:"handler_code"`
	TriggerTopic string `query:"trigger_topic"`
	Consumer     string `query:"consumer"`
	Code         string `query:"code"`
}
