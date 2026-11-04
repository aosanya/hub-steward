package mwanachamaagency

import (
	"context"
	"fmt"
	"sort"
	"sync"
	"sync/atomic"
	"time"

	"gorm.io/gorm"

	"wakalaserver/modules/agency/models"
)

type liveRun struct {
	stopped atomic.Bool
}

type waitingRun struct {
	id       string
	queuedAt string
}

type runBoard struct {
	mu      sync.Mutex
	running map[string]*liveRun
	waiting []waitingRun
	watch   map[string]chan struct{}
	last    string
}

func newRunBoard() *runBoard {
	return &runBoard{running: map[string]*liveRun{}, watch: map[string]chan struct{}{}}
}

func (b *runBoard) nextQueuedAt() string {
	now := models.NowRFC3339()
	if now <= b.last {
		if t, err := time.Parse(models.TimeLayout, b.last); err == nil {
			now = t.Add(time.Nanosecond).UTC().Format(models.TimeLayout)
		}
	}
	b.last = now
	return now
}

func (b *runBoard) hasRoom(limit int) bool {
	return len(b.waiting) == 0 && (limit <= 0 || len(b.running) < limit)
}

func (b *runBoard) knows(id string) bool {
	_, watched := b.watch[id]
	return watched
}

func (b *runBoard) enqueue(w waitingRun) {
	b.waiting = append(b.waiting, w)
	sort.SliceStable(b.waiting, func(i, j int) bool { return b.waiting[i].queuedAt < b.waiting[j].queuedAt })
}

func (b *runBoard) dequeue(id string) {
	for i, w := range b.waiting {
		if w.id == id {
			b.waiting = append(b.waiting[:i], b.waiting[i+1:]...)
			return
		}
	}
}

func (b *runBoard) release(id string) {
	if ch, ok := b.watch[id]; ok {
		close(ch)
		delete(b.watch, id)
	}
}

func WithScenariosAtOnce(limit func(ctx context.Context) int) Option {
	return func(m *agencyManager) { m.atOnce = limit }
}

func WithTokensPerTest(limit func(ctx context.Context) int) Option {
	return func(m *agencyManager) { m.tokenLimit = limit }
}

func (m *agencyManager) tokensPerTest(ctx context.Context) int {
	if m.tokenLimit == nil {
		return 0
	}
	if n := m.tokenLimit(ctx); n > 0 {
		return n
	}
	return 0
}

func (m *agencyManager) scenariosAtOnce(ctx context.Context) int {
	if m.atOnce == nil {
		return 0
	}
	if n := m.atOnce(ctx); n > 0 {
		return n
	}
	return 0
}

func (m *agencyManager) press(ctx context.Context, scenarioID string) (models.TestRun, error) {
	limit := m.scenariosAtOnce(ctx)
	b := m.board
	b.mu.Lock()
	defer b.mu.Unlock()

	m.promoteLocked(ctx, limit)
	result := models.TestRunWaiting
	if b.hasRoom(limit) {
		result = models.TestRunRunning
	}
	started, err := m.startRun(ctx, scenarioID, newID(), result, b.nextQueuedAt())
	if err != nil {
		return models.TestRun{}, err
	}
	b.watch[started.run.ID] = make(chan struct{})
	if result == models.TestRunRunning {
		m.launch(ctx, started)
	} else {
		b.enqueue(waitingRun{id: started.run.ID, queuedAt: started.run.QueuedAt})
	}
	return started.run, nil
}

func (m *agencyManager) launch(ctx context.Context, started startedRun) {
	live := &liveRun{}
	m.board.running[started.run.ID] = live
	go m.execute(context.WithoutCancel(ctx), started, live)
}

func (m *agencyManager) promoteLocked(ctx context.Context, limit int) {
	b := m.board
	for len(b.waiting) > 0 && (limit <= 0 || len(b.running) < limit) {
		next := b.waiting[0]
		b.waiting = b.waiting[1:]
		started, err := m.begin(ctx, next.id)
		if err != nil {
			m.abandon(ctx, next.id, err)
			continue
		}
		m.launch(ctx, started)
	}
}

func (m *agencyManager) begin(ctx context.Context, runID string) (startedRun, error) {
	var started startedRun
	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var run models.TestRun
		if err := m.find(ctx, tx, roleTestRun, runID, &run, ErrTestRunNotFound); err != nil {
			return err
		}
		if run.Result.Finished() {
			return ErrTestRunFinished
		}
		s, err := m.findScenario(ctx, tx, run.ScenarioID)
		if err != nil {
			return err
		}
		if err := m.requireOpenDraft(ctx, tx, s.DraftID); err != nil {
			return err
		}
		wf, rules, version, err := m.runInputs(ctx, tx, s)
		if err != nil {
			return err
		}
		if run.Result == models.TestRunWaiting {
			run.Result, run.StartedAt, run.DraftVersion, run.TokenBudget = models.TestRunRunning, models.NowRFC3339(), version, m.tokensPerTest(ctx)
			if err := m.writeUpdate(ctx, tx, roleTestRun, run.ID, run, ErrTestRunNotFound); err != nil {
				return err
			}
		}
		if err := m.moveScenario(ctx, tx, run, models.ScenarioRunning); err != nil {
			return err
		}
		if s, err = m.findScenario(ctx, tx, s.ID); err != nil {
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

func (m *agencyManager) moveScenario(ctx context.Context, tx *gorm.DB, run models.TestRun, to models.ScenarioResult) error {
	return tx.WithContext(ctx).Table(m.table(roleScenario)).
		Where("id = ? AND last_run_id = ? AND result IN ?", run.ScenarioID, run.ID, []string{string(models.ScenarioWaiting), string(models.ScenarioRunning)}).
		Updates(map[string]any{"result": string(to), "last_updated": models.NowRFC3339()}).Error
}

func (m *agencyManager) abandon(ctx context.Context, runID string, cause error) {
	var run models.TestRun
	if err := m.find(ctx, m.db, roleTestRun, runID, &run, ErrTestRunNotFound); err == nil && !run.Result.Finished() {
		m.finishRun(ctx, run, RunOutcome{
			Result: models.TestRunStopped, StopReason: fmt.Sprintf("The run could not start: %v", cause),
			Steps: run.Steps, Tokens: run.Tokens, Stored: run.Stored, Trail: run.Trail,
		})
	}
	m.board.release(runID)
}

func (m *agencyManager) AwaitRun(ctx context.Context, runID string) (models.TestRun, error) {
	m.board.mu.Lock()
	ch := m.board.watch[runID]
	m.board.mu.Unlock()
	if ch != nil {
		select {
		case <-ch:
		case <-ctx.Done():
			return models.TestRun{}, ctx.Err()
		}
	}
	return m.GetTestRun(ctx, runID)
}

func (m *agencyManager) ResumeRuns(ctx context.Context) ([]models.TestRun, error) {
	limit := m.scenariosAtOnce(ctx)
	b := m.board
	b.mu.Lock()
	defer b.mu.Unlock()

	q := m.q(ctx, roleTestRun).Where("result IN ?", []string{string(models.TestRunWaiting), string(models.TestRunRunning)}).Order("queued_at, id")
	rows, err := list[models.TestRun](m, q, roleTestRun)
	if err != nil {
		return nil, fmt.Errorf("ResumeRuns: %w", err)
	}
	resumed := make([]models.TestRun, 0, len(rows))
	for _, run := range rows {
		if b.knows(run.ID) {
			continue
		}
		b.watch[run.ID] = make(chan struct{})
		if run.QueuedAt > b.last {
			b.last = run.QueuedAt
		}
		if b.hasRoom(limit) {
			started, err := m.begin(ctx, run.ID)
			if err != nil {
				m.abandon(ctx, run.ID, err)
				continue
			}
			m.launch(ctx, started)
			resumed = append(resumed, started.run)
			continue
		}
		parked, err := m.park(ctx, run)
		if err != nil {
			m.abandon(ctx, run.ID, err)
			continue
		}
		b.enqueue(waitingRun{id: run.ID, queuedAt: run.QueuedAt})
		resumed = append(resumed, parked)
	}
	return resumed, nil
}

func (m *agencyManager) park(ctx context.Context, run models.TestRun) (models.TestRun, error) {
	if run.Result == models.TestRunWaiting {
		return run, nil
	}
	run.Result, run.StartedAt = models.TestRunWaiting, ""
	err := m.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := m.writeUpdate(ctx, tx, roleTestRun, run.ID, run, ErrTestRunNotFound); err != nil {
			return err
		}
		return m.moveScenario(ctx, tx, run, models.ScenarioWaiting)
	})
	return run, err
}
