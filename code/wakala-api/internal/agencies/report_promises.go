package agencies

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"

	mwanachamataskmanager "wakalaserver/modules/taskmanager"
)

type PromiseOutcome string

const (
	PromiseKept       PromiseOutcome = "kept"
	PromisePartlyKept PromiseOutcome = "partly_kept"
	PromiseNotKept    PromiseOutcome = "not_kept"
)

var ErrInvalidPromise = errors.New("invalid promise")

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

func RecordPromiseOutcome(ctx context.Context, board mwanachamataskmanager.TaskManager, taskID string, outcome PromiseOutcome, note string) (mwanachamataskmanager.Task, error) {
	switch outcome {
	case PromiseKept, PromisePartlyKept, PromiseNotKept:
	default:
		return mwanachamataskmanager.Task{}, fmt.Errorf("%w: outcome %q", ErrInvalidPromise, outcome)
	}
	task, err := board.GetTask(ctx, taskID)
	if err != nil {
		return mwanachamataskmanager.Task{}, err
	}
	link, ok := PromiseOf(task)
	if !ok {
		return mwanachamataskmanager.Task{}, fmt.Errorf("%w: task %s is not a report's promise", ErrInvalidPromise, taskID)
	}
	link.Outcome = outcome
	link.OutcomeNote = note
	raw, err := json.Marshal(link)
	if err != nil {
		return mwanachamataskmanager.Task{}, err
	}
	task.Context = string(raw)
	return board.UpdateTask(ctx, task)
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
