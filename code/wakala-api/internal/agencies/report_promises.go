package agencies

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"sort"
	"strings"
	"time"

	mwanachamataskmanager "wakalaserver/modules/taskmanager"
)

type PromiseOutcome string

const (
	PromiseKept       PromiseOutcome = "kept"
	PromisePartlyKept PromiseOutcome = "partly_kept"
	PromiseNotKept    PromiseOutcome = "not_kept"
)

var (
	ErrInvalidPromise         = errors.New("invalid promise")
	ErrPromiseNotDue          = errors.New("promise not yet due")
	ErrPromiseOutcomeRecorded = errors.New("promise outcome already recorded")
)

type ReportPromise struct {
	Text       string `json:"text"`
	DueAt      string `json:"due_at"`
	AnswersFor string `json:"answers_for"`
}

type PromiseLink struct {
	FormID        string         `json:"form_id"`
	ReportVersion int            `json:"report_version"`
	AnswersFor    string         `json:"answers_for"`
	Outcome       PromiseOutcome `json:"outcome,omitempty"`
	OutcomeNote   string         `json:"outcome_note,omitempty"`
}

func PromisesAsTasks(ctx context.Context, board mwanachamataskmanager.TaskManager, formID string, reportVersion int, promises []ReportPromise) ([]mwanachamataskmanager.Task, error) {
	if formID == "" || reportVersion < 1 {
		return nil, fmt.Errorf("%w: a promise belongs to a form and a report version", ErrInvalidPromise)
	}
	if err := CheckPromises(promises); err != nil {
		return nil, err
	}
	out := make([]mwanachamataskmanager.Task, 0, len(promises))
	for _, p := range promises {
		link, err := json.Marshal(PromiseLink{FormID: formID, ReportVersion: reportVersion, AnswersFor: p.AnswersFor})
		if err != nil {
			return out, err
		}
		task, err := board.CreateTask(ctx, mwanachamataskmanager.Task{Title: strings.TrimSpace(p.Text), DueAt: p.DueAt, Context: string(link)})
		if err != nil {
			return out, err
		}
		out = append(out, task)
	}
	return out, nil
}

func CheckPromises(promises []ReportPromise) error {
	for _, p := range promises {
		if strings.TrimSpace(p.Text) == "" || p.AnswersFor == "" {
			return fmt.Errorf("%w: a promise needs its text and who answers for it", ErrInvalidPromise)
		}
	}
	return nil
}

func PromiseOf(task mwanachamataskmanager.Task) (PromiseLink, bool) {
	var link PromiseLink
	if err := json.Unmarshal([]byte(task.Context), &link); err != nil || link.FormID == "" {
		return PromiseLink{}, false
	}
	return link, true
}

func RecordPromiseOutcome(ctx context.Context, board mwanachamataskmanager.TaskManager, taskID string, outcome PromiseOutcome, note string, now time.Time) (mwanachamataskmanager.Task, error) {
	switch outcome {
	case PromiseKept, PromisePartlyKept, PromiseNotKept:
	default:
		return mwanachamataskmanager.Task{}, fmt.Errorf("%w: outcome %q", ErrInvalidPromise, outcome)
	}
	outcomes := promiseOutcomesOf(board)
	defer outcomes.hold(taskID)()
	task, err := board.GetTask(ctx, taskID)
	if err != nil {
		return mwanachamataskmanager.Task{}, err
	}
	link, ok := PromiseOf(task)
	if !ok {
		return mwanachamataskmanager.Task{}, fmt.Errorf("%w: task %s is not a report's promise", ErrInvalidPromise, taskID)
	}
	if link.Outcome != "" {
		return mwanachamataskmanager.Task{}, fmt.Errorf("%w: task %s is already %s", ErrPromiseOutcomeRecorded, taskID, link.Outcome)
	}
	if notYetDue(task.DueAt, now) {
		return mwanachamataskmanager.Task{}, fmt.Errorf("%w: task %s falls due %s", ErrPromiseNotDue, taskID, task.DueAt)
	}
	held, claimed, err := outcomes.claim(ctx, taskID, outcome, note)
	if err != nil {
		return mwanachamataskmanager.Task{}, err
	}
	if !claimed {
		finishClaimedOutcome(ctx, board, taskID, held)
		return mwanachamataskmanager.Task{}, fmt.Errorf("%w: task %s is already %s", ErrPromiseOutcomeRecorded, taskID, held.Outcome)
	}
	written, err := writePromiseOutcome(ctx, board, task, link, outcome, note)
	if err != nil {
		if releaseErr := outcomes.release(ctx, taskID); releaseErr != nil {
			slog.Error("releasing a promise outcome claim failed", "task", taskID, "error", releaseErr.Error())
		}
		return mwanachamataskmanager.Task{}, err
	}
	return written, nil
}

func finishClaimedOutcome(ctx context.Context, board mwanachamataskmanager.TaskManager, taskID string, held promiseOutcomeClaim) {
	current, err := board.GetTask(ctx, taskID)
	if err != nil {
		slog.Error("reading a claimed promise failed", "task", taskID, "error", err.Error())
		return
	}
	link, ok := PromiseOf(current)
	if !ok || link.Outcome != "" {
		return
	}
	if _, err := writePromiseOutcome(ctx, board, current, link, PromiseOutcome(held.Outcome), held.Note); err != nil {
		slog.Error("finishing a claimed promise outcome failed", "task", taskID, "error", err.Error())
	}
}

func writePromiseOutcome(ctx context.Context, board mwanachamataskmanager.TaskManager, task mwanachamataskmanager.Task, link PromiseLink, outcome PromiseOutcome, note string) (mwanachamataskmanager.Task, error) {
	link.Outcome = outcome
	link.OutcomeNote = note
	raw, err := json.Marshal(link)
	if err != nil {
		return mwanachamataskmanager.Task{}, err
	}
	task.Context = string(raw)
	return board.UpdateTask(ctx, task)
}

func notYetDue(dueAt string, now time.Time) bool {
	due, err := time.Parse(time.RFC3339, dueAt)
	return err == nil && now.Before(due)
}

type ReportPromiseRead struct {
	TaskID      string         `json:"task_id"`
	Text        string         `json:"text"`
	DueAt       string         `json:"due_at"`
	AnswersFor  string         `json:"answers_for"`
	Outcome     PromiseOutcome `json:"outcome,omitempty"`
	OutcomeNote string         `json:"outcome_note,omitempty"`
}

func ReportPromises(ctx context.Context, board mwanachamataskmanager.TaskManager, formID string, reportVersion int) ([]ReportPromiseRead, error) {
	tasks, err := board.ListTasks(ctx, mwanachamataskmanager.TaskFilter{})
	if err != nil {
		return nil, err
	}
	out := []ReportPromiseRead{}
	for _, task := range tasks {
		link, ok := PromiseOf(task)
		if !ok || link.FormID != formID || link.ReportVersion != reportVersion {
			continue
		}
		out = append(out, ReportPromiseRead{TaskID: task.ID, Text: task.Title, DueAt: task.DueAt, AnswersFor: link.AnswersFor, Outcome: link.Outcome, OutcomeNote: link.OutcomeNote})
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].TaskID < out[j].TaskID })
	return out, nil
}
