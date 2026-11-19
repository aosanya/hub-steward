package http

import (
	"context"
	"strings"

	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
	"github.com/aosanya/mwanachama-backend-shared/answerrules"

	"wakalaserver/internal/agencies"
)

func (d *Deps) checkedPlaceRefs(ctx context.Context, instanceID string, questions []agencymodels.StepQuestion, answers, refs map[string]string) (map[string]string, error) {
	asked := make(map[string]agencymodels.StepQuestion, len(questions))
	for _, q := range questions {
		asked[q.Prompt] = q
	}
	kept := make(map[string]string, len(refs))
	for prompt, ref := range refs {
		q, known := asked[prompt]
		if !known || q.AnswerType != agencymodels.AnswerAddress {
			return nil, badRowError("only an address question takes a place reference: " + prompt)
		}
		if strings.TrimSpace(answers[prompt]) == "" {
			return nil, badRowError("the place reference for " + prompt + " comes with the words of the answer")
		}
		if !answerrules.PlaceRefFits(ref) {
			return nil, badRowError("the place reference for " + prompt + " is a street or an address from the town's list")
		}
		held, err := d.placeIsHeld(ctx, instanceID, ref)
		if err != nil {
			return nil, err
		}
		if !held {
			return nil, badRowError("the answer to " + prompt + " is not a street or address the town holds")
		}
		kept[prompt] = ref
	}
	for _, q := range questions {
		if q.AnswerType != agencymodels.AnswerAddress || q.AllowFreeText || strings.TrimSpace(answers[q.Prompt]) == "" {
			continue
		}
		if _, ok := kept[q.Prompt]; !ok {
			return nil, badRowError("the answer to " + q.Prompt + " is a street or address picked from the town's list")
		}
	}
	if len(kept) == 0 {
		return nil, nil
	}
	return kept, nil
}

func (d *Deps) placeIsHeld(ctx context.Context, instanceID, ref string) (bool, error) {
	twin, err := d.Registry.TwinManager(ctx, instanceID)
	if err != nil {
		return false, err
	}
	return agencies.PlaceIsHeld(ctx, twin, ref)
}
