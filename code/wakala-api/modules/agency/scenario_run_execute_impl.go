package mwanachamaagency

import (
	"context"
	"fmt"
	"sync"

	"gorm.io/gorm"

	"wakalaserver/modules/agency/models"
)

func tokensOf(steps []models.RunStep) int {
	total := 0
	for _, s := range steps {
		total += s.Tokens
	}
	return total
}

func stripDone(done, steps []models.RunStep) []models.RunStep {
	if len(steps) < len(done) {
		return steps
	}
	for i, d := range done {
		if steps[i].StepID != d.StepID {
			return steps
		}
	}
	return steps[len(done):]
}

func (m *agencyManager) execute(ctx context.Context, started startedRun, live *liveRun) {
	outcome, err := m.runSteps(ctx, started, live)
	m.endRun(ctx, started, live, settled(outcome, err))
}

func (m *agencyManager) runSteps(ctx context.Context, started startedRun, live *liveRun) (RunOutcome, error) {
	done := append([]models.RunStep(nil), started.run.Steps...)
	req := RunRequest{
		RunID: started.run.ID, Scenario: started.scenario, Workflow: started.workflow,
		Rules: started.rules, DraftVersion: started.run.DraftVersion, Done: append([]models.RunStep(nil), done...),
		TokenBudget: started.run.TokenBudget,
	}

	var mu sync.Mutex
	var reported []models.RunStep
	runningStep := ""
	save := func() {
		partial := append(append([]models.RunStep(nil), done...), reported...)
		current := started.run
		current.Steps, current.Tokens, current.RunningStep = partial, tokensOf(partial), runningStep
		m.writeUpdate(ctx, m.db, roleTestRun, current.ID, current, ErrTestRunNotFound)
	}
	report := func(step models.RunStep) bool {
		mu.Lock()
		defer mu.Unlock()
		reported = append(reported, step)
		runningStep = ""
		save()
		return !live.stopped.Load()
	}
	req.Starting = func(stepID string) {
		mu.Lock()
		defer mu.Unlock()
		runningStep = stepID
		save()
	}

	var outcome RunOutcome
	var err error
	if r, ok := m.scenarioRunner().(StepReporter); ok {
		outcome, err = r.RunReporting(ctx, req, report)
	} else {
		outcome, err = m.scenarioRunner().Run(ctx, req)
	}

	mu.Lock()
	defer mu.Unlock()
	fresh := stripDone(done, outcome.Steps)
	if len(fresh) < len(reported) {
		fresh = reported
	}
	outcome.Steps = append(done, fresh...)
	outcome.Tokens += tokensOf(done)
	return outcome, err
}

func (m *agencyManager) endRun(ctx context.Context, started startedRun, live *liveRun, outcome RunOutcome) {
	b := m.board
	b.mu.Lock()
	defer b.mu.Unlock()
	if live.stopped.Load() {
		outcome.Result, outcome.StopReason = models.TestRunStopped, models.StoppedByDesigner
	}
	m.finishRun(ctx, started.run, outcome)
	delete(b.running, started.run.ID)
	m.promoteLocked(ctx, m.scenariosAtOnce(ctx))
	b.release(started.run.ID)
}

func (m *agencyManager) finishRun(ctx context.Context, run models.TestRun, outcome RunOutcome) (models.TestRun, error) {
	run.Result, run.StopReason, run.Steps, run.Tokens = outcome.Result, outcome.StopReason, outcome.Steps, outcome.Tokens
	run.Stored, run.Trail, run.RunningStep = outcome.Stored, outcome.Trail, ""
	run.FinishedAt = models.NowRFC3339()
	scenarioResult := run.Result.ScenarioResult()
	if run.Result == models.TestRunStopped && run.StopReason == models.StoppedByDesigner {
		scenarioResult = models.ScenarioNotRun
	}
	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := m.writeUpdate(ctx, tx, roleTestRun, run.ID, run, ErrTestRunNotFound); err != nil {
			return err
		}
		return m.moveScenario(ctx, tx, run, scenarioResult)
	})
	return run, err
}

func (m *agencyManager) StopRun(ctx context.Context, runID string) (models.TestRun, error) {
	b := m.board
	b.mu.Lock()
	defer b.mu.Unlock()
	run, err := m.GetTestRun(ctx, runID)
	if err != nil {
		return models.TestRun{}, fmt.Errorf("StopRun: %w", err)
	}
	if run.Result.Finished() {
		return models.TestRun{}, fmt.Errorf("StopRun: %w", ErrTestRunFinished)
	}
	if live, running := b.running[runID]; running {
		live.stopped.Store(true)
		return run, nil
	}
	b.dequeue(runID)
	run, err = m.finishRun(ctx, run, RunOutcome{
		Result: models.TestRunStopped, StopReason: models.StoppedByDesigner, Steps: run.Steps, Tokens: run.Tokens, Stored: run.Stored,
	})
	b.release(runID)
	if err != nil {
		return models.TestRun{}, fmt.Errorf("StopRun: %w", err)
	}
	return m.present(ctx, run), nil
}
