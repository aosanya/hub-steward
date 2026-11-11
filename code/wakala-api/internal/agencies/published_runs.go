package agencies

import (
	"context"
	"fmt"
	"slices"
	"sort"

	agencymodels "wakalaserver/modules/agency/models"
	mwanachamataskmanager "wakalaserver/modules/taskmanager"
)

type trustedStepKey struct{}

func withTrustedStep(ctx context.Context) context.Context {
	return context.WithValue(ctx, trustedStepKey{}, true)
}

func isTrustedStep(ctx context.Context) bool {
	trusted, _ := ctx.Value(trustedStepKey{}).(bool)
	return trusted
}

func (b limitedBoard) StartWorkflowRun(ctx context.Context, name, workflowCode string, workflowVersion int, triggerEvent, initiator string) (mwanachamataskmanager.WorkflowRun, error) {
	if workflowCode != "" && workflowVersion >= 1 {
		doc, err := b.publishedDocument(ctx, workflowVersion)
		if err != nil {
			return mwanachamataskmanager.WorkflowRun{}, err
		}
		if _, found := workflowOfCode(doc, workflowCode); !found {
			return mwanachamataskmanager.WorkflowRun{}, fmt.Errorf("%w: version %d has no workflow %s", mwanachamataskmanager.ErrWorkflowNotPublished, workflowVersion, workflowCode)
		}
	}
	return b.TaskManager.StartWorkflowRun(ctx, name, workflowCode, workflowVersion, triggerEvent, initiator)
}

func (b limitedBoard) publishedDocument(ctx context.Context, version int) (agencymodels.AgencyDocument, error) {
	reader, err := b.publications(ctx)
	if err != nil {
		return agencymodels.AgencyDocument{}, err
	}
	publication, err := reader.GetPublication(ctx, version)
	if err != nil {
		return agencymodels.AgencyDocument{}, fmt.Errorf("%w: version %d: %v", mwanachamataskmanager.ErrWorkflowNotPublished, version, err)
	}
	return publication.Document, nil
}

func (b limitedBoard) checkedStep(ctx context.Context, run mwanachamataskmanager.WorkflowRun, stepCode, cancelWorkflowCode string) error {
	if run.WorkflowCode == "" || run.WorkflowVersion < 1 {
		return fmt.Errorf("%w: run %s carries no published workflow", mwanachamataskmanager.ErrStepNotInWorkflow, run.ID)
	}
	doc, err := b.publishedDocument(ctx, run.WorkflowVersion)
	if err != nil {
		return err
	}
	workflow, found := workflowOfCode(doc, run.WorkflowCode)
	if !found {
		return fmt.Errorf("%w: version %d has no workflow %s", mwanachamataskmanager.ErrWorkflowNotPublished, run.WorkflowVersion, run.WorkflowCode)
	}
	steps := stepsOfWorkflow(doc, workflow.ID)
	at := slices.IndexFunc(steps, func(s agencymodels.DocumentWorkItem) bool { return s.Code == stepCode })
	if at < 0 {
		return fmt.Errorf("%w: %s is not a step of %s", mwanachamataskmanager.ErrStepNotInWorkflow, stepCode, run.WorkflowCode)
	}
	if cancelWorkflowCode != "" {
		if _, published := workflowOfCode(doc, cancelWorkflowCode); !published {
			return fmt.Errorf("%w: no workflow %s to cancel into", mwanachamataskmanager.ErrWorkflowNotPublished, cancelWorkflowCode)
		}
	}
	if isTrustedStep(ctx) {
		return nil
	}
	current := slices.IndexFunc(steps, func(s agencymodels.DocumentWorkItem) bool { return s.Code == run.CurrentStepID })
	if !followsInOrder(steps, current, at) {
		return fmt.Errorf("%w: %s after %q", mwanachamataskmanager.ErrStepOutOfOrder, stepCode, run.CurrentStepID)
	}
	return nil
}

func workflowOfCode(doc agencymodels.AgencyDocument, code string) (agencymodels.DocumentWorkflow, bool) {
	at := slices.IndexFunc(doc.Workflows, func(w agencymodels.DocumentWorkflow) bool { return w.Code == code })
	if at < 0 {
		return agencymodels.DocumentWorkflow{}, false
	}
	return doc.Workflows[at], true
}

func stepsOfWorkflow(doc agencymodels.AgencyDocument, workflowID string) []agencymodels.DocumentWorkItem {
	var steps []agencymodels.DocumentWorkItem
	for _, s := range doc.WorkItems {
		if s.WorkflowID == workflowID {
			steps = append(steps, s)
		}
	}
	sort.SliceStable(steps, func(i, j int) bool { return steps[i].Ordinality < steps[j].Ordinality })
	return steps
}
