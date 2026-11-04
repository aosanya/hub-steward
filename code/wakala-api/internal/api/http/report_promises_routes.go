package http

import (
	"errors"
	"net/http"

	formsmodels "wakalaserver/modules/forms/models"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

const reportPromisesPattern = "GET " + formsInstancePrefix + "/forms/{form_id}/results/latest/promises"

type reportWithPromises struct {
	Report   formsmodels.ResultReport     `json:"report"`
	Promises []agencies.ReportPromiseRead `json:"promises"`
}

func (d *Deps) registerReportPromisesRoute(mux *http.ServeMux, reg agencies.Registry, auth callers) {
	if reg == nil {
		return
	}
	mux.HandleFunc(reportPromisesPattern, auth.require(func(w http.ResponseWriter, r *http.Request) {
		instanceID := r.PathValue("instanceID")
		fm, role, err := formsManagerFor(r.Context(), reg, instanceID)
		if err != nil {
			writeInstanceErr(w, err)
			return
		}
		r = withPartition(r, instanceID)
		if refusedAsMissing(w, r, d.instanceFormsMount(role).Authorize, "forms.results.read") {
			return
		}
		report, err := fm.LatestResults(r.Context(), r.PathValue("form_id"), accounts.IDFromContext(r.Context()))
		if err != nil {
			writeInstanceErr(w, agencies.ErrInstanceNotFound)
			return
		}
		promises := []agencies.ReportPromiseRead{}
		err = mustBeMounted(r.Context(), reg, instanceID, "taskmanager")
		if err == nil {
			promises, err = readReportPromises(r, reg, instanceID, report)
		}
		if err != nil && !errors.Is(err, agencies.ErrInstanceNotFound) {
			writeInstanceErr(w, err)
			return
		}
		if promises == nil {
			promises = []agencies.ReportPromiseRead{}
		}
		writeJSON(w, http.StatusOK, reportWithPromises{Report: report, Promises: promises})
	}))
}

func readReportPromises(r *http.Request, reg agencies.Registry, instanceID string, report formsmodels.ResultReport) ([]agencies.ReportPromiseRead, error) {
	board, err := reg.TaskManager(r.Context(), instanceID)
	if err != nil {
		return nil, err
	}
	return agencies.ReportPromises(r.Context(), board, report.FormID, report.Version)
}
