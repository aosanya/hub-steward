package testruns

import (
	"context"
	"errors"

	agencymodels "wakalaserver/modules/agency/models"
	mwanachamaai "wakalaserver/modules/ai"
)

const BudgetReached = "Budget reached"

type Caller interface {
	Call(ctx context.Context, tool string, args map[string]any) (string, error)
}

type Model interface {
	Chat(ctx context.Context, in mwanachamaai.ChatInput) (mwanachamaai.ChatReply, error)
}

type Stored struct {
	Record string `json:"record"`
	Holds  string `json:"holds"`
	Rows   int    `json:"rows"`
}

type Stage interface {
	Tools(actor string) []mwanachamaai.ChatTool
	Caller(runID, actor string) Caller
	Respond(ctx context.Context, runID string, block agencymodels.ScenarioBlock) ([]agencymodels.RunStep, error)
	Stored(ctx context.Context, runID string) ([]Stored, error)
}

type Decision struct {
	Allowed       bool
	Reason        string
	BudgetReached bool
}

type Meter interface {
	Check(ctx context.Context, runID, step string) (Decision, error)
	Record(ctx context.Context, runID, step string, tokensIn, tokensOut int) error
}

type StopError struct {
	Reason string
}

func (e *StopError) Error() string { return "testruns: stopped: " + e.Reason }

var ErrBudgetReached = &StopError{Reason: BudgetReached}

func stopReason(err error) (string, bool) {
	var stop *StopError
	if errors.As(err, &stop) {
		return stop.Reason, true
	}
	return "", false
}
