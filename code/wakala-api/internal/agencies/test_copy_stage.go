package agencies

import (
	"context"

	"wakalaserver/internal/testruns"
)

type stageCopy struct {
	TestCopy
	modules []TouchedModule
}

func (c stageCopy) Stored(ctx context.Context, runID string) ([]testruns.Stored, error) {
	rows, err := c.TestCopy.Stored(ctx, runID, c.modules)
	if err != nil {
		return nil, err
	}
	out := make([]testruns.Stored, len(rows))
	for i, r := range rows {
		out[i] = testruns.Stored{Record: r.Object, Holds: r.Table, Rows: int(r.Rows)}
	}
	return out, nil
}

func (c TestCopy) Stage(modules []TouchedModule, actors []testruns.Actor) *testruns.RunStage {
	codes := make([]string, len(modules))
	for i, m := range modules {
		codes[i] = m.Code
	}
	return testruns.NewStage(stageCopy{TestCopy: c, modules: modules}, codes, actors)
}
