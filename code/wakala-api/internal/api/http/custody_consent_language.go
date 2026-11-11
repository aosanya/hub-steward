package http

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"strings"
)

const consentGiveAction = "custody.consent.give"

const maxConsentGiveBody = 64 << 10

func (d *Deps) withAgencyConsentLanguage(r *http.Request, instanceID string) *http.Request {
	if d.Languages == nil || r.Body == nil {
		return r
	}
	raw, err := io.ReadAll(io.LimitReader(r.Body, maxConsentGiveBody+1))
	if err != nil || len(raw) > maxConsentGiveBody {
		r.Body = io.NopCloser(io.MultiReader(bytes.NewReader(raw), r.Body))
		return r
	}
	r.Body = io.NopCloser(bytes.NewReader(raw))
	body := map[string]any{}
	if len(bytes.TrimSpace(raw)) > 0 && (json.Unmarshal(raw, &body) != nil || body == nil) {
		return r
	}
	if named, present := body["language"]; present && named != "" {
		return r
	}
	agency, err := d.Languages.Agency(r.Context(), instanceID)
	if err != nil {
		return r
	}
	body["language"] = strings.ToLower(agency.ContentDefault)
	filled, err := json.Marshal(body)
	if err != nil {
		return r
	}
	r.Body = io.NopCloser(bytes.NewReader(filled))
	r.ContentLength = int64(len(filled))
	return r
}
