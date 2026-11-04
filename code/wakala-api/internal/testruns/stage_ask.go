package testruns

import (
	"context"
	"fmt"
	"strings"

	agencymodels "wakalaserver/modules/agency/models"
	mwanachamamarket "wakalaserver/modules/market"
	marketmodels "wakalaserver/modules/market/models"
)

func asksTheBuyer(block agencymodels.ScenarioBlock) bool {
	for _, word := range strings.Fields(strings.ToLower(block.Action)) {
		if word == "ask" || word == "asks" {
			return true
		}
	}
	return false
}

func (s *RunStage) waitingAsks(ctx context.Context, mm mwanachamamarket.MarketManager) ([]mwanachamamarket.Ask, error) {
	var out []mwanachamamarket.Ask
	for _, actor := range s.actors {
		if actor.Kind != agencymodels.ActorKindRole {
			continue
		}
		asks, err := mm.ListAsksBy(ctx, actor.Name, "", marketmodels.AnswerWaiting)
		if err != nil {
			return nil, err
		}
		for _, a := range asks {
			if a.Picker == actor.Name {
				out = append(out, a)
			}
		}
	}
	return out, nil
}

func (s *RunStage) askedTheBuyer(ctx context.Context, mm mwanachamamarket.MarketManager, step agencymodels.RunStep, block agencymodels.ScenarioBlock) (agencymodels.RunStep, error) {
	asks, err := s.waitingAsks(ctx, mm)
	if err != nil {
		return step, err
	}
	if len(asks) != 1 {
		return failed(step, block.Action, fmt.Sprintf("There are %d waiting asks to a buyer, not one", len(asks))), nil
	}
	step.Did = asks[0].Picker + " asked the buyer once"
	step.Recorded = "Ask " + asks[0].ID + " is " + asks[0].Answer
	return step, nil
}
