package http

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"

	mwanachamainsights "wakalaserver/modules/insights"

	"wakalaserver/internal/agencies"
)

type insightSubject struct {
	id     string
	found  bool
	usable bool
}

func insightSubjectOf(r *http.Request, im mwanachamainsights.InsightManager) insightSubject {
	if id := r.PathValue("insightID"); id != "" {
		in, err := im.GetInsight(r.Context(), id)
		if err != nil {
			return insightSubject{}
		}
		return insightSubject{id: in.SubjectID, found: true, usable: true}
	}
	if r.Method == http.MethodGet || r.Method == http.MethodHead {
		return insightSubject{id: r.URL.Query().Get("subject_id"), found: true, usable: true}
	}
	id, ok := subjectOfBody(r)
	return insightSubject{id: id, found: true, usable: ok}
}

func subjectOfBody(r *http.Request) (string, bool) {
	if r.Body == nil {
		return "", true
	}
	raw, err := io.ReadAll(r.Body)
	r.Body.Close()
	r.Body = io.NopCloser(bytes.NewReader(raw))
	if err != nil {
		return "", false
	}
	if len(bytes.TrimSpace(raw)) == 0 {
		return "", true
	}
	dec := json.NewDecoder(bytes.NewReader(raw))
	var body struct {
		SubjectID string `json:"subject_id"`
	}
	if err := dec.Decode(&body); err != nil {
		return "", false
	}
	if _, err := dec.Token(); err != io.EOF {
		return "", false
	}
	return body.SubjectID, true
}

func scopeInsightsToMembership(reg agencies.Registry, im mwanachamainsights.InsightManager, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if reg == nil {
			next(w, r)
			return
		}
		subject := insightSubjectOf(r, im)
		if !subject.found {
			writeErr(w, http.StatusNotFound, "not found")
			return
		}
		if !subject.usable || subject.id == "" {
			writeErr(w, http.StatusBadRequest, "an insight names the agency it belongs to")
			return
		}
		if err := mustBeMember(r.Context(), reg, subject.id); err != nil {
			writeErr(w, http.StatusNotFound, "not found")
			return
		}
		next(w, r)
	}
}
