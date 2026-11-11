package agencies

import (
	"context"
	"errors"
	"sort"

	mwanachamaagency "wakalaserver/modules/agency"
	agencymodels "wakalaserver/modules/agency/models"
	mwanachamamarket "wakalaserver/modules/market"
	mwanachamataskmanager "wakalaserver/modules/taskmanager"
)

const askRunNamePrefix = "ask-"

func askRunName(askID string) string { return askRunNamePrefix + askID }

type waitingStep struct {
	workflowCode string
	stepCode     string
}

func StartAskRun(ctx context.Context, reg Registry, instanceID string, ask mwanachamamarket.Ask) error {
	mgr, err := reg.AgencyManager(ctx, instanceID)
	if err != nil {
		return err
	}
	publication, err := mgr.GetPublicationForChannel(ctx, "")
	if errors.Is(err, mwanachamaagency.ErrPublicationNotFound) {
		return nil
	}
	if err != nil {
		return err
	}
	step, found := firstTimedYesNoStep(publication.Document)
	if !found {
		return nil
	}
	board, err := reg.TaskManager(ctx, instanceID)
	if err != nil {
		return err
	}
	run, err := board.StartWorkflowRun(ctx, askRunName(ask.ID), step.workflowCode, publication.Version, AskRunTrigger(ask.ID), ask.Picker)
	if err != nil {
		return err
	}
	_, err = board.BeginWorkflowRunStep(withTrustedStep(ctx), run.ID, step.stepCode, 0, "")
	return err
}

func ClearAskRun(ctx context.Context, reg Registry, instanceID, askID string) error {
	board, err := reg.TaskManager(ctx, instanceID)
	if err != nil {
		return err
	}
	run, err := board.GetWorkflowRunByName(ctx, askRunName(askID))
	if errors.Is(err, mwanachamataskmanager.ErrWorkflowRunNotFound) {
		return nil
	}
	if err != nil {
		return err
	}
	_, err = board.AnswerWorkflowRunStep(ctx, run.ID)
	return err
}

func firstTimedYesNoStep(doc agencymodels.AgencyDocument) (waitingStep, bool) {
	workflows := append([]agencymodels.DocumentWorkflow(nil), doc.Workflows...)
	sort.SliceStable(workflows, func(i, j int) bool { return workflows[i].Ordinality < workflows[j].Ordinality })
	steps := append([]agencymodels.DocumentWorkItem(nil), doc.WorkItems...)
	sort.SliceStable(steps, func(i, j int) bool { return steps[i].Ordinality < steps[j].Ordinality })
	for _, w := range workflows {
		for _, s := range steps {
			if s.WorkflowID == w.ID && s.Kind == agencymodels.StepKindYesNo && s.TimeLimitMinutes > 0 && s.CancelWorkflowID != "" {
				return waitingStep{workflowCode: w.Code, stepCode: s.Code}, true
			}
		}
	}
	return waitingStep{}, false
}
