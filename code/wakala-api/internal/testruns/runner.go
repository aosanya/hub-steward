package testruns

import (
	"context"
	"errors"

	mwanachamaagency "wakalaserver/modules/agency"
	agencymodels "wakalaserver/modules/agency/models"
)

var ErrNoFactory = errors.New("testruns: no factory builds the Test agent")

type Factory func(ctx context.Context, instanceID string, req mwanachamaagency.RunRequest) (Agent, error)

type runner struct {
	instanceID string
	factory    Factory
}

func NewRunner(instanceID string, factory Factory) mwanachamaagency.StepReporter {
	return runner{instanceID: instanceID, factory: factory}
}

func (r runner) Run(ctx context.Context, req mwanachamaagency.RunRequest) (mwanachamaagency.RunOutcome, error) {
	return r.RunReporting(ctx, req, func(agencymodels.RunStep) bool { return true })
}

func (r runner) RunReporting(ctx context.Context, req mwanachamaagency.RunRequest, finished func(agencymodels.RunStep) bool) (mwanachamaagency.RunOutcome, error) {
	if r.factory == nil {
		return mwanachamaagency.RunOutcome{}, ErrNoFactory
	}
	agent, err := r.factory(ctx, r.instanceID, req)
	if err != nil {
		return mwanachamaagency.RunOutcome{}, err
	}
	return agent.RunReporting(ctx, req, finished)
}
