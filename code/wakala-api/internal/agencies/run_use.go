package agencies

import (
	"context"
	"fmt"

	mwanachamaagency "wakalaserver/modules/agency"
	agencymodels "wakalaserver/modules/agency/models"
)

func (r *registry) runsUnderWay(instanceID string) mwanachamaagency.RunLister {
	return func(ctx context.Context) ([]agencymodels.WorkflowRunUse, error) {
		board, err := r.TaskManager(ctx, instanceID)
		if err != nil {
			return nil, fmt.Errorf("the orders of instance %s: %w", instanceID, err)
		}
		runs, err := board.ListWorkflowRunsUnderWay(ctx, "")
		if err != nil {
			return nil, fmt.Errorf("the orders of instance %s: %w", instanceID, err)
		}
		out := make([]agencymodels.WorkflowRunUse, 0, len(runs))
		for _, run := range runs {
			out = append(out, agencymodels.WorkflowRunUse{WorkflowCode: run.WorkflowCode, WorkflowVersion: run.WorkflowVersion})
		}
		return out, nil
	}
}
