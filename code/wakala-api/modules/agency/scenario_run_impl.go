package mwanachamaagency

import (
	"context"
	"fmt"

	"gorm.io/gorm"

	"wakalaserver/modules/agency/models"
)

const noExecutorReason = "No test executor is installed"

type RunRequest struct {
	RunID        string
	Scenario     models.Scenario
	Workflow     models.Workflow
	Rules        []models.Rule
	DraftVersion string
	Done         []models.RunStep
	TokenBudget  int
	Starting     func(stepID string)
}

type RunOutcome struct {
	Result     models.TestRunResult
	StopReason string
	Steps      []models.RunStep
	Tokens     int
	Stored     []models.StoredRecord
	Trail      []models.TrailLine
}

type ScenarioRunner interface {
	Run(ctx context.Context, req RunRequest) (RunOutcome, error)
}

type StepReporter interface {
	ScenarioRunner
	RunReporting(ctx context.Context, req RunRequest, finished func(models.RunStep) (carryOn bool)) (RunOutcome, error)
}

type stoppedRunner struct{}

func (stoppedRunner) Run(context.Context, RunRequest) (RunOutcome, error) {
	return RunOutcome{Result: models.TestRunStopped, StopReason: noExecutorReason}, nil
}

func WithScenarioRunner(r ScenarioRunner) Option {
	return func(m *agencyManager) { m.runner = r }
}

func (m *agencyManager) scenarioRunner() ScenarioRunner {
	if m.runner == nil {
		return stoppedRunner{}
	}
	return m.runner
}

func settled(o RunOutcome, err error) RunOutcome {
	switch {
	case err != nil:
		return RunOutcome{Result: models.TestRunStopped, StopReason: fmt.Sprintf("The executor failed: %v", err), Steps: o.Steps, Tokens: o.Tokens, Stored: o.Stored, Trail: o.Trail}
	case !o.Result.Finished():
		o.Result, o.StopReason = models.TestRunStopped, "The executor ended without a result"
	}
	return o
}

type startedRun struct {
	run      models.TestRun
	scenario models.Scenario
	workflow models.Workflow
	rules    []models.Rule
}

func (m *agencyManager) startRun(ctx context.Context, scenarioID, runID string, result models.TestRunResult, queuedAt string) (startedRun, error) {
	var started startedRun
	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		s, err := m.findScenario(ctx, tx, scenarioID)
		if err != nil {
			return err
		}
		if err := m.requireOpenDraft(ctx, tx, s.DraftID); err != nil {
			return err
		}
		if s.Result == models.ScenarioRunning || s.Result == models.ScenarioWaiting {
			return ErrScenarioRunning
		}
		wf, rules, version, err := m.runInputs(ctx, tx, s)
		if err != nil {
			return err
		}
		now := models.NowRFC3339()
		run := models.TestRun{
			ID: runID, ScenarioID: s.ID, DraftID: s.DraftID, DraftVersion: version,
			Result: result, QueuedAt: queuedAt, TokenBudget: m.tokensPerTest(ctx),
		}
		if result == models.TestRunRunning {
			run.StartedAt = now
		}
		if err := m.insertRow(ctx, tx, roleTestRun, run); err != nil {
			return err
		}
		s.Result, s.LastRunID, s.LastUpdated = result.ScenarioResult(), run.ID, now
		if err := m.writeUpdate(ctx, tx, roleScenario, s.ID, s, ErrScenarioNotFound); err != nil {
			return err
		}
		view, err := m.scenarioView(ctx, tx, s)
		if err != nil {
			return err
		}
		started = startedRun{run: run, scenario: view, workflow: wf, rules: rules}
		return nil
	})
	return started, err
}

func (m *agencyManager) runInputs(ctx context.Context, tx *gorm.DB, s models.Scenario) (models.Workflow, []models.Rule, string, error) {
	var wf models.Workflow
	wq := scopeQuery(tx.WithContext(ctx).Table(m.table(roleWorkflow)), s.DraftID).Where("id = ?", s.WorkflowID)
	if err := m.take(wq, roleWorkflow, &wf, ErrWorkflowNotFound); err != nil {
		return wf, nil, "", err
	}
	rules, err := m.workflowRules(ctx, tx, s.DraftID, wf)
	if err != nil {
		return wf, nil, "", err
	}
	version, err := m.contentHashFor(ctx, tx, s.DraftID)
	return wf, rules, version, err
}

func (m *agencyManager) RunScenario(ctx context.Context, id string) (models.TestRun, error) {
	run, err := m.press(ctx, id)
	if err != nil {
		return models.TestRun{}, fmt.Errorf("RunScenario: %w", err)
	}
	return m.present(ctx, run), nil
}

func (m *agencyManager) RunScenarios(ctx context.Context, draftID string, scenarioIDs []string) ([]models.TestRun, error) {
	ids := scenarioIDs
	inDraft, err := list[models.Scenario](m, scopeQuery(m.q(ctx, roleScenario).Order("created_at"), draftID), roleScenario)
	if err != nil {
		return nil, fmt.Errorf("RunScenarios: %w", err)
	}
	known := make(map[string]bool, len(inDraft))
	for _, s := range inDraft {
		known[s.ID] = true
		if len(scenarioIDs) == 0 {
			ids = append(ids, s.ID)
		}
	}
	for _, id := range ids {
		if !known[id] {
			return nil, fmt.Errorf("RunScenarios: %w: %s is not a scenario of this draft", ErrScenarioNotFound, id)
		}
	}
	runs := make([]models.TestRun, 0, len(ids))
	for _, id := range ids {
		run, err := m.RunScenario(ctx, id)
		if err != nil {
			return runs, err
		}
		runs = append(runs, run)
	}
	return runs, nil
}

func (m *agencyManager) GetTestRun(ctx context.Context, id string) (models.TestRun, error) {
	var run models.TestRun
	if err := m.find(ctx, m.db, roleTestRun, id, &run, ErrTestRunNotFound); err != nil {
		return models.TestRun{}, err
	}
	return m.present(ctx, run), nil
}

func (m *agencyManager) ListTestRuns(ctx context.Context, scenarioID string) ([]models.TestRun, error) {
	if _, err := m.findScenario(ctx, m.db, scenarioID); err != nil {
		return nil, err
	}
	q := m.q(ctx, roleTestRun).Where("scenario_id = ?", scenarioID).Order("queued_at DESC")
	out, err := list[models.TestRun](m, q, roleTestRun)
	if err != nil {
		return nil, fmt.Errorf("ListTestRuns: %w", err)
	}
	for i := range out {
		out[i] = m.present(ctx, out[i])
	}
	return out, nil
}

const latestEditLabel = "Latest edit"

func (m *agencyManager) present(ctx context.Context, run models.TestRun) models.TestRun {
	if run.Stored == nil {
		run.Stored = []models.StoredRecord{}
	}
	run.DraftLabel = m.draftLabel(ctx, run)
	return run
}

func (m *agencyManager) draftLabel(ctx context.Context, run models.TestRun) string {
	var draft models.Draft
	if err := m.find(ctx, m.db, roleDraft, run.DraftID, &draft, ErrDraftNotFound); err == nil && draft.Status == models.DraftStatusOpen {
		return latestEditLabel
	}
	if p, err := m.findPublicationBy(ctx, m.db, "content_hash = ?", run.DraftVersion); err == nil && p.Tag != "" {
		return p.Tag
	}
	return run.DraftVersion
}
