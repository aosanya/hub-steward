package agencies

import (
	"context"

	ai "github.com/aosanya/mwanachama-backend-ai"
	mwanachamaagency "wakalaserver/modules/agency"
)

type ScenariosAtOnce func(ctx context.Context, instanceID string) (int, error)

func WithScenariosAtOnce(of ScenariosAtOnce) Option {
	return func(r *registry) { r.scenariosAtOnce = of }
}

type RunnerOf func(instanceID string) mwanachamaagency.ScenarioRunner

func WithScenarioRunner(of RunnerOf) Option {
	return func(r *registry) { r.runnerOf = of }
}

func ScenariosAtOnceFrom(resolve func(ctx context.Context, instanceID string) (ai.Manager, error)) ScenariosAtOnce {
	return func(ctx context.Context, instanceID string) (int, error) {
		if resolve == nil {
			return 0, nil
		}
		manager, err := resolve(ctx, instanceID)
		if err != nil {
			return 0, err
		}
		accounts, err := manager.ListAccounts(ctx, instanceID)
		if err != nil {
			return 0, err
		}
		lowest := 0
		for _, a := range accounts {
			if a.ScenariosAtOnce == nil || *a.ScenariosAtOnce <= 0 {
				continue
			}
			if lowest == 0 || *a.ScenariosAtOnce < lowest {
				lowest = *a.ScenariosAtOnce
			}
		}
		return lowest, nil
	}
}
