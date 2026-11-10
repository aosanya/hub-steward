package agencies

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"time"

	mwanachamataskmanager "wakalaserver/modules/taskmanager"
)

type fakeBoard struct {
	mwanachamataskmanager.TaskManager
	tasks        map[string]mwanachamataskmanager.Task
	nextID       int
	run          mwanachamataskmanager.WorkflowRun
	runErr       error
	begun        []beganStep
	answered     []string
	answerErr    error
	closed       []mwanachamataskmanager.WorkflowRun
	closeErr     error
	closeAsOf    string
	repeating    []mwanachamataskmanager.RepeatingTaskRecord
	repeatingErr error
	madeDue      map[string]bool
	madeDueErr   map[string]error
}

type beganStep struct {
	runID, step string
	minutes     int
	cancelCode  string
}

func newFakeBoard() *fakeBoard {
	return &fakeBoard{tasks: map[string]mwanachamataskmanager.Task{}, madeDue: map[string]bool{}, madeDueErr: map[string]error{}}
}

func (b *fakeBoard) CreateTask(_ context.Context, task mwanachamataskmanager.Task) (mwanachamataskmanager.Task, error) {
	b.nextID++
	task.ID = fmt.Sprintf("t%02d", b.nextID)
	b.tasks[task.ID] = task
	return task, nil
}

func (b *fakeBoard) GetTask(_ context.Context, id string) (mwanachamataskmanager.Task, error) {
	task, ok := b.tasks[id]
	if !ok {
		return mwanachamataskmanager.Task{}, errors.New("task not found")
	}
	return task, nil
}

func (b *fakeBoard) UpdateTask(_ context.Context, task mwanachamataskmanager.Task) (mwanachamataskmanager.Task, error) {
	b.tasks[task.ID] = task
	return task, nil
}

func (b *fakeBoard) MoveTaskToState(_ context.Context, id, state string) (mwanachamataskmanager.Task, error) {
	task, ok := b.tasks[id]
	if !ok {
		return mwanachamataskmanager.Task{}, errors.New("task not found")
	}
	if state == "done" {
		task.Status = mwanachamataskmanager.TaskStatusCompleted
	}
	b.tasks[id] = task
	return task, nil
}

func (b *fakeBoard) ListTasks(context.Context, mwanachamataskmanager.TaskFilter) ([]mwanachamataskmanager.Task, error) {
	out := make([]mwanachamataskmanager.Task, 0, len(b.tasks))
	for _, t := range b.tasks {
		out = append(out, t)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ID > out[j].ID })
	return out, nil
}

func (b *fakeBoard) GetWorkflowRun(context.Context, string) (mwanachamataskmanager.WorkflowRun, error) {
	return b.run, b.runErr
}

func (b *fakeBoard) BeginWorkflowRunStep(_ context.Context, runID, step string, minutes int, cancelCode string) (mwanachamataskmanager.WorkflowRun, error) {
	b.begun = append(b.begun, beganStep{runID, step, minutes, cancelCode})
	return mwanachamataskmanager.WorkflowRun{ID: runID}, nil
}

func (b *fakeBoard) AnswerWorkflowRunStep(_ context.Context, runID string) (mwanachamataskmanager.WorkflowRun, error) {
	b.answered = append(b.answered, runID)
	return mwanachamataskmanager.WorkflowRun{ID: runID}, b.answerErr
}

func (b *fakeBoard) CloseWorkflowRunsPastLimit(_ context.Context, asOf string) ([]mwanachamataskmanager.WorkflowRun, error) {
	b.closeAsOf = asOf
	return b.closed, b.closeErr
}

func (b *fakeBoard) ListRunningRepeatingTasks(context.Context) ([]mwanachamataskmanager.RepeatingTaskRecord, error) {
	return b.repeating, b.repeatingErr
}

func (b *fakeBoard) MakeRepeatingTaskDue(_ context.Context, id string, _ time.Time) (mwanachamataskmanager.RepeatingTaskPeriod, bool, error) {
	return mwanachamataskmanager.RepeatingTaskPeriod{}, b.madeDue[id], b.madeDueErr[id]
}
