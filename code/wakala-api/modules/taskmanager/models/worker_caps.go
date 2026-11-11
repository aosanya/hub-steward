package models

type WorkerCaps struct {
	InputTokens    int64 `json:"input_tokens"`
	OutputTokens   int64 `json:"output_tokens"`
	RuntimeSeconds int64 `json:"runtime_seconds"`
}

type TaskCapsChange struct {
	InputTokens    *int64 `json:"input_tokens,omitempty"`
	OutputTokens   *int64 `json:"output_tokens,omitempty"`
	RuntimeSeconds *int64 `json:"runtime_seconds,omitempty"`
}

type TaskCapsOverride struct {
	ID             string `json:"id"`
	TaskID         string `json:"task_id"`
	InputTokens    int64  `json:"input_tokens"`
	OutputTokens   int64  `json:"output_tokens"`
	RuntimeSeconds int64  `json:"runtime_seconds"`
}

type TaskUsageWrite struct {
	InputTokens  int64 `json:"input_tokens"`
	OutputTokens int64 `json:"output_tokens"`
	SecondsUsed  int64 `json:"seconds_used"`
	ClockStopped bool  `json:"clock_stopped"`
}

type TaskUsage struct {
	ID           string `json:"id,omitempty"`
	TaskID       string `json:"task_id,omitempty"`
	InputTokens  int64  `json:"input_tokens"`
	OutputTokens int64  `json:"output_tokens"`
	SecondsUsed  int64  `json:"seconds_used"`
	ClockStopped bool   `json:"clock_stopped"`
	UpdatedAt    string `json:"updated_at"`
}

type TaskCaps struct {
	TaskID  string      `json:"task_id"`
	Default WorkerCaps  `json:"default"`
	Own     *WorkerCaps `json:"own,omitempty"`
	InForce WorkerCaps  `json:"in_force"`
	Used    *TaskUsage  `json:"used,omitempty"`
}
