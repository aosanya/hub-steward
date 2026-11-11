package http

import (
	"errors"
	"net/http"

	mwanachamataskmanager "wakalaserver/modules/taskmanager"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

const promiseOutcomeAction = "forms.results.promise_outcome"

const promiseOutcomePattern = "PUT " + formsInstancePrefix + "/forms/{form_id}/results/promises/{task_id}/outcome"

type promiseOutcomeBody struct {
	Outcome agencies.PromiseOutcome `json:"outcome"`
	Note    string                  `json:"note"`
}

func (d *Deps) registerPromiseOutcomeRoute(mux *http.ServeMux, reg agencies.Registry, auth callers) {
	if reg == nil {
		return
	}
	mux.HandleFunc(promiseOutcomePattern, auth.require(func(w http.ResponseWriter, r *http.Request) {
		instanceID := r.PathValue("instanceID")
		board, ok := promiseBoardForOperator(w, r, reg, instanceID)
		if !ok {
			return
		}
		if d.requireAgentMay(withPartition(r, instanceID).Context(), instanceID, promiseOutcomeAction) != nil {
			writeErr(w, http.StatusForbidden, "forbidden")
			return
		}
		var body promiseOutcomeBody
		if err := readJSON(r, &body); err != nil {
			writeErr(w, http.StatusBadRequest, err.Error())
			return
		}
		switch body.Outcome {
		case agencies.PromiseKept, agencies.PromisePartlyKept, agencies.PromiseNotKept:
		default:
			writeErr(w, http.StatusBadRequest, "outcome must be kept, partly_kept or not_kept")
			return
		}
		taskID := r.PathValue("task_id")
		task, err := board.GetTask(r.Context(), taskID)
		if err != nil {
			writePromiseMissing(w, err)
			return
		}
		link, isPromise := agencies.PromiseOf(task)
		if !isPromise || link.FormID != r.PathValue("form_id") {
			writeErr(w, http.StatusNotFound, "not found")
			return
		}
		task, err = agencies.RecordPromiseOutcome(r.Context(), board, taskID, body.Outcome, body.Note)
		if err != nil {
			writePromiseMissing(w, err)
			return
		}
		link, _ = agencies.PromiseOf(task)
		writeJSON(w, http.StatusOK, agencies.ReportPromiseRead{TaskID: task.ID, Text: task.Title, DueAt: task.DueAt, AnswersFor: link.AnswersFor, Outcome: link.Outcome, OutcomeNote: link.OutcomeNote})
	}))
}

func promiseBoardForOperator(w http.ResponseWriter, r *http.Request, reg agencies.Registry, instanceID string) (mwanachamataskmanager.TaskManager, bool) {
	caller := accounts.IDFromContext(r.Context())
	role, err := reg.RoleOf(r.Context(), instanceID, caller)
	if err != nil || caller == "" || (role != agencies.RoleOwner && role != agencies.RoleAgent) {
		writeInstanceErr(w, agencies.ErrInstanceNotFound)
		return nil, false
	}
	if err := mustBeMounted(r.Context(), reg, instanceID, "taskmanager"); err != nil {
		writeInstanceErr(w, err)
		return nil, false
	}
	board, err := reg.TaskManager(r.Context(), instanceID)
	if err != nil {
		writeInstanceErr(w, err)
		return nil, false
	}
	return board, true
}

func writePromiseMissing(w http.ResponseWriter, err error) {
	if errors.Is(err, mwanachamataskmanager.ErrTaskNotFound) {
		writeErr(w, http.StatusNotFound, "not found")
		return
	}
	writeInstanceErr(w, err)
}
