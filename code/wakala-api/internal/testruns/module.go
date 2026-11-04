package testruns

import (
	"context"
	"strings"
	"time"
)

type Module interface {
	Name() string
	Play(ctx context.Context, call Call) (Outcome, error)
}

type Call struct {
	StepID   string
	StepName string
	Kind     string
	Role     string
	Endpoint string
	Args     map[string]any
}

type Outcome struct {
	Answer map[string]any
	Trail  []TrailLine
}

type TrailLine struct {
	StepID   string
	Module   string
	Endpoint string
	Text     string
	At       time.Time
}

type runKey struct{}

func WithRun(ctx context.Context, runID string) context.Context {
	return context.WithValue(ctx, runKey{}, runID)
}

func RunOf(ctx context.Context) string {
	id, _ := ctx.Value(runKey{}).(string)
	return id
}

func moduleOf(endpoint string) string {
	module, _, _ := strings.Cut(endpoint, "_")
	return module
}

type Modules interface {
	Module(name string) (Module, bool)
}
