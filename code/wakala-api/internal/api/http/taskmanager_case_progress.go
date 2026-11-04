package http

import (
	"errors"
	"net/http"

	mwanachamataskmanager "wakalaserver/modules/taskmanager"

	"wakalaserver/internal/agencies"
)

const caseProgressReadAction = "taskmanager.case.read"

type caseProgressStep struct {
	Title  string `json:"title"`
	Status string `json:"status"`
}

type caseProgress struct {
	ID     string             `json:"id"`
	Title  string             `json:"title,omitempty"`
	Status string             `json:"status"`
	Steps  []caseProgressStep `json:"steps"`
}

func registerCaseProgressRoute(mux *http.ServeMux, reg agencies.Registry, auth callers, onRecord recordGrantChecker) {
	mux.HandleFunc("GET "+taskmanagerInstancePrefix+"/cases/{caseID}/progress", auth.require(func(w http.ResponseWriter, r *http.Request) {
		r = withPartition(r, r.PathValue("instanceID"))
		m, err := taskManagerFor(r.Context(), reg, r.PathValue("instanceID"))
		if err != nil && errors.Is(err, agencies.ErrInstanceNotFound) && onRecord != nil {
			m, err = taskManagerThroughRecord(r, reg, caseProgressReadAction, onRecord)
		}
		if err != nil {
			writeInstanceErr(w, err)
			return
		}
		progress, err := readCaseProgress(r, m)
		if err != nil {
			if errors.Is(err, mwanachamataskmanager.ErrCaseNotFound) {
				writeInstanceErr(w, agencies.ErrInstanceNotFound)
				return
			}
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
			return
		}
		writeJSON(w, http.StatusOK, progress)
	}))
}

func readCaseProgress(r *http.Request, m mwanachamataskmanager.TaskManager) (caseProgress, error) {
	caseID := r.PathValue("caseID")
	c, err := m.GetCase(r.Context(), caseID)
	if err != nil {
		return caseProgress{}, err
	}
	tasks, err := m.ListCaseTasks(r.Context(), caseID)
	if err != nil {
		return caseProgress{}, err
	}
	steps := make([]caseProgressStep, 0, len(tasks))
	for _, t := range tasks {
		steps = append(steps, caseProgressStep{Title: t.Title, Status: string(t.Status)})
	}
	return caseProgress{ID: c.ID, Title: c.Title, Status: string(c.Status), Steps: steps}, nil
}
