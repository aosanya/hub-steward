package agencies

import (
	"context"
	"errors"
	"log/slog"
	"time"

	agencymodels "wakalaserver/modules/agency/models"
	mwanachamataskmanager "wakalaserver/modules/taskmanager"
)

const StepLimitSweepEvery = time.Minute

type publicationReader interface {
	GetPublication(ctx context.Context, version int) (agencymodels.AgencyPublication, error)
}

type limitedBoard struct {
	mwanachamataskmanager.TaskManager
	publications func(ctx context.Context) (publicationReader, error)
	outcomes     *promiseOutcomes
}

type publishedLimit struct {
	minutes    int
	cancelCode string
}

func (b limitedBoard) BeginWorkflowRunStep(ctx context.Context, runID, stepCode string, limitMinutes int, cancelWorkflowCode string) (mwanachamataskmanager.WorkflowRun, error) {
	run, err := b.TaskManager.GetWorkflowRun(ctx, runID)
	if err != nil {
		return mwanachamataskmanager.WorkflowRun{}, err
	}
	if err := b.checkedStep(ctx, run, stepCode, cancelWorkflowCode); err != nil {
		return mwanachamataskmanager.WorkflowRun{}, err
	}
	if limit, found := b.publishedLimit(ctx, runID, stepCode); found {
		limitMinutes, cancelWorkflowCode = limit.minutes, limit.cancelCode
	}
	return b.TaskManager.BeginWorkflowRunStep(ctx, runID, stepCode, limitMinutes, cancelWorkflowCode)
}

func (b limitedBoard) UpdateTask(ctx context.Context, task mwanachamataskmanager.Task) (mwanachamataskmanager.Task, error) {
	updated, err := b.TaskManager.UpdateTask(ctx, task)
	if err == nil {
		b.answerWhenCompleted(ctx, updated)
	}
	return updated, err
}

func (b limitedBoard) MoveTaskToState(ctx context.Context, taskID, state string) (mwanachamataskmanager.Task, error) {
	moved, err := b.TaskManager.MoveTaskToState(ctx, taskID, state)
	if err == nil {
		b.answerWhenCompleted(ctx, moved)
	}
	return moved, err
}

func (b limitedBoard) answerWhenCompleted(ctx context.Context, task mwanachamataskmanager.Task) {
	if task.Status != mwanachamataskmanager.TaskStatusCompleted || task.WorkflowRunID == "" {
		return
	}
	if _, err := b.TaskManager.AnswerWorkflowRunStep(ctx, task.WorkflowRunID); err != nil {
		slog.Error("answering a run's waiting step failed", "run", task.WorkflowRunID, "error", err.Error())
	}
}

func (b limitedBoard) publishedLimit(ctx context.Context, runID, stepCode string) (publishedLimit, bool) {
	run, err := b.TaskManager.GetWorkflowRun(ctx, runID)
	if err != nil || run.WorkflowVersion < 1 {
		return publishedLimit{}, false
	}
	reader, err := b.publications(ctx)
	if err != nil {
		return publishedLimit{}, false
	}
	publication, err := reader.GetPublication(ctx, run.WorkflowVersion)
	if err != nil {
		return publishedLimit{}, false
	}
	return limitOfStep(publication.Document, run.WorkflowCode, stepCode)
}

func limitOfStep(doc agencymodels.AgencyDocument, workflowCode, stepCode string) (publishedLimit, bool) {
	workflows := map[string]agencymodels.DocumentWorkflow{}
	for _, w := range doc.Workflows {
		workflows[w.ID] = w
	}
	for _, step := range doc.WorkItems {
		if step.Code != stepCode || workflows[step.WorkflowID].Code != workflowCode {
			continue
		}
		if step.TimeLimitMinutes <= 0 {
			return publishedLimit{}, true
		}
		return publishedLimit{minutes: step.TimeLimitMinutes, cancelCode: workflows[step.CancelWorkflowID].Code}, true
	}
	return publishedLimit{}, false
}

type StepLimitReport struct {
	Agencies       int
	RunsClosed     int
	FailedAgencies []string
}

type sweepOptions struct {
	told RuleOf
}

type SweepOption func(*sweepOptions)

func WithTold(rules RuleOf) SweepOption {
	return func(o *sweepOptions) { o.told = rules }
}

func SweepStepLimits(ctx context.Context, reg Registry, now time.Time, logger *slog.Logger, opts ...SweepOption) (StepLimitReport, error) {
	var options sweepOptions
	for _, opt := range opts {
		opt(&options)
	}
	var report StepLimitReport
	instances, err := reg.ListInstances(ctx)
	if err != nil {
		return report, err
	}
	for _, inst := range instances {
		if ctx.Err() != nil {
			return report, ctx.Err()
		}
		if !inst.Approved() {
			continue
		}
		report.Agencies++
		closed, err := closeRunsPastLimit(ctx, reg, inst.ID, now, options, logger)
		report.RunsClosed += closed
		if err != nil {
			report.FailedAgencies = append(report.FailedAgencies, inst.ID)
			logSweepFailure(logger, inst.ID, "step time limits", err)
		}
	}
	return report, nil
}

func closeRunsPastLimit(ctx context.Context, reg Registry, instanceID string, now time.Time, options sweepOptions, logger *slog.Logger) (int, error) {
	board, err := reg.TaskManager(ctx, instanceID)
	if err != nil {
		return 0, err
	}
	closed, err := board.CloseWorkflowRunsPastLimit(ctx, now.UTC().Format(time.RFC3339))
	tellClosedAsks(ctx, reg, instanceID, closed, options.told, logger)
	return len(closed), err
}

func RunStepLimitSweep(ctx context.Context, reg Registry, ticks <-chan time.Time, clock func() time.Time, logger *slog.Logger, opts ...SweepOption) {
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticks:
		}
		report, err := SweepStepLimits(ctx, reg, clock(), logger, opts...)
		if err != nil && !errors.Is(err, context.Canceled) && logger != nil {
			logger.Error("step limit sweep failed", "error", err.Error())
		}
		if err == nil && logger != nil && (report.RunsClosed > 0 || len(report.FailedAgencies) > 0) {
			logger.Info("step limit sweep", "agencies", report.Agencies, "runs_closed", report.RunsClosed, "failed_agencies", len(report.FailedAgencies))
		}
	}
}
