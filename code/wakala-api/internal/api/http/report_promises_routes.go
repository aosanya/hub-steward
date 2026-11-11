package http

import (
	"errors"
	"net/http"

	mwanachamaforms "wakalaserver/modules/forms"
	formsmodels "wakalaserver/modules/forms/models"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

const reportPromisesPattern = "GET " + formsInstancePrefix + "/forms/{form_id}/results/latest/promises"

type reportWithPromises struct {
	Report   formsmodels.ResultReportRead `json:"report"`
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
		callerID := accounts.IDFromContext(r.Context())
		report, err := fm.LatestResults(r.Context(), r.PathValue("form_id"), callerID)
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
		reach := r.Context()
		if d.instanceFormsMount(role).ReachedOnly {
			reach = mwanachamaforms.OnlyReached(reach, callerID)
		}
		writeJSON(w, http.StatusOK, reportWithPromises{Report: report.ReadAs(mwanachamaforms.IsNarrowed(reach)), Promises: promises})
	}))
}

func readReportPromises(r *http.Request, reg agencies.Registry, instanceID string, report formsmodels.ResultReport) ([]agencies.ReportPromiseRead, error) {
	board, err := reg.TaskManager(r.Context(), instanceID)
	if err != nil {
		return nil, err
	}
	return agencies.ReportPromises(r.Context(), board, report.FormID, report.Version)
}
