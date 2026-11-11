package http

import (
	"context"
	"errors"
	"net/http"

	mwanachamataskmanager "wakalaserver/modules/taskmanager"

	taskmanagerroutes "wakalaserver/modules/taskmanager/routes"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

const taskmanagerInstancePrefix = "/instances/{instanceID}/taskmanager"

var taskmanagerMount = taskmanagerroutes.Mount{Caller: accounts.IDFromContext}

func (d *Deps) instanceTaskManagerMount(role string) taskmanagerroutes.Mount {
	mount := taskmanagerMount
	mount.Authorize = d.taskPermissioned(role, mount.Authorize)
	return mount
}

func (d *Deps) registerTaskManagerRoutes(mux *http.ServeMux, reg agencies.Registry, auth callers, endGrants recordGrantsEnder, onRecord recordGrantChecker) {
	shape := taskmanagerroutes.Shape()
	for i, rt := range shape {
		idx := i
		action := rt.Action
		mux.HandleFunc(rt.Pattern(taskmanagerInstancePrefix), auth.require(func(w http.ResponseWriter, r *http.Request) {
			r = withPartition(r, r.PathValue("instanceID"))
			m, err := d.taskManagerFor(r.Context(), reg, r.PathValue("instanceID"))
			if err != nil && errors.Is(err, agencies.ErrInstanceNotFound) && recordReadableActions[action] && onRecord != nil {
				m, err = taskManagerThroughRecord(r, reg, action, onRecord)
			}
			if err != nil {
				writeInstanceErr(w, err)
				return
			}
			if assigneeGatedActions[action] && !admitAssignee(w, r, reg) {
				return
			}
			if assignedToGatedActions[action] && !admitAssignedTo(w, r, reg) {
				return
			}
			if action == caseVoteAction && !pinVoterKindOnRequest(w, r, d.callerRole(r, r.PathValue("instanceID"))) {
				return
			}
			if action == takeBackVoteAction && !admitVoteWithdrawal(w, r, d.callerRole(r, r.PathValue("instanceID"))) {
				return
			}
			handler := taskmanagerroutes.RoutesFor(m, d.instanceTaskManagerMount(d.callerRole(r, r.PathValue("instanceID"))))[idx].Handler
			if action == caseEndAction && endGrants != nil {
				endCaseThenItsGrants(w, r, handler, endGrants)
				return
			}
			handler(w, r)
		}))
	}
}

const caseEndAction = "taskmanager.case.end"

var recordReadableActions = map[string]bool{
	"taskmanager.case.read": true,
}

type recordGrantChecker func(ctx context.Context, module, object, id, action string) bool

func taskManagerThroughRecord(r *http.Request, reg agencies.Registry, action string, onRecord recordGrantChecker) (mwanachamataskmanager.TaskManager, error) {
	instanceID := r.PathValue("instanceID")
	if !onRecord(r.Context(), "taskmanager", "case", r.PathValue("caseID"), action) {
		return nil, agencies.ErrInstanceNotFound
	}
	if err := mustBeMounted(r.Context(), reg, instanceID, "taskmanager"); err != nil {
		return nil, err
	}
	return reg.TaskManager(r.Context(), instanceID)
}

type recordGrantsEnder func(r *http.Request, module, object, id string) error

type statusWriter struct {
	http.ResponseWriter
	code int
}

func (w *statusWriter) WriteHeader(code int) {
	if w.code == 0 {
		w.code = code
	}
	w.ResponseWriter.WriteHeader(code)
}

func (w *statusWriter) Write(b []byte) (int, error) {
	if w.code == 0 {
		w.code = http.StatusOK
	}
	return w.ResponseWriter.Write(b)
}

func endCaseThenItsGrants(w http.ResponseWriter, r *http.Request, handler http.HandlerFunc, endGrants recordGrantsEnder) {
	sw := &statusWriter{ResponseWriter: w}
	handler(sw, r)
	if sw.code < 200 || sw.code >= 300 {
		return
	}
	_ = endGrants(r, "taskmanager", "case", r.PathValue("caseID"))
}
