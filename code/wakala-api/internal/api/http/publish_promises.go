package http

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"

	formsmodels "wakalaserver/modules/forms/models"
	mwanachamataskmanager "wakalaserver/modules/taskmanager"

	"wakalaserver/internal/agencies"
)

const publishResultsAction = "forms.results.publish"

type promisesToFile struct {
	board    mwanachamataskmanager.TaskManager
	promises []agencies.ReportPromise
}

func takePublishedPromises(w http.ResponseWriter, r *http.Request, reg agencies.Registry, action string) (promisesToFile, bool) {
	if action != publishResultsAction || r.Body == nil {
		return promisesToFile{}, true
	}
	raw, err := io.ReadAll(r.Body)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid request body")
		return promisesToFile{}, false
	}
	r.Body = io.NopCloser(bytes.NewReader(raw))
	var fields map[string]json.RawMessage
	if json.Unmarshal(raw, &fields) != nil {
		return promisesToFile{}, true
	}
	listed, named := fields["promises"]
	if !named {
		return promisesToFile{}, true
	}
	var promises []agencies.ReportPromise
	if err := json.Unmarshal(listed, &promises); err != nil {
		writeErr(w, http.StatusBadRequest, "promises must be a list of text, due_at and answers_for")
		return promisesToFile{}, false
	}
	if err := agencies.CheckPromises(promises); err != nil {
		writeErr(w, http.StatusBadRequest, err.Error())
		return promisesToFile{}, false
	}
	delete(fields, "promises")
	rest, err := json.Marshal(fields)
	if err != nil {
		writeErr(w, http.StatusBadRequest, "invalid request body")
		return promisesToFile{}, false
	}
	r.Body = io.NopCloser(bytes.NewReader(rest))
	r.ContentLength = int64(len(rest))
	if len(promises) == 0 {
		return promisesToFile{}, true
	}
	board, err := boardForPromises(r.Context(), reg, r.PathValue("instanceID"))
	if err != nil {
		writeErr(w, http.StatusConflict, "promises need the agency's task board, which is switched off")
		return promisesToFile{}, false
	}
	return promisesToFile{board: board, promises: promises}, true
}

func boardForPromises(ctx context.Context, reg agencies.Registry, instanceID string) (mwanachamataskmanager.TaskManager, error) {
	if err := mustBeMounted(ctx, reg, instanceID, "taskmanager"); err != nil {
		return nil, err
	}
	return reg.TaskManager(ctx, instanceID)
}

func (m surveysAnnounced) filePromises(ctx context.Context, report formsmodels.ResultReport) {
	if m.promises.board == nil || len(m.promises.promises) == 0 {
		return
	}
	_, err := agencies.PromisesAsTasks(ctx, m.promises.board, report.FormID, report.Version, m.promises.promises)
	if err != nil && !errors.Is(err, context.Canceled) {
		slog.Default().Warn("published results filed not every promise",
			"instance", m.instanceID, "form", report.FormID, "version", report.Version, "error", err.Error())
	}
}
