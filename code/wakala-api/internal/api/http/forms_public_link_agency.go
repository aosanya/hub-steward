package http

import (
	"bytes"
	"encoding/json"
	"net/http"

	"wakalaserver/internal/agencies"
)

const openPublicLinkAction = "forms.public_link.open"

type publicLinkAgency struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	JoinMode string `json:"join_mode"`
}

func agencyOnLink(inst agencies.Instance) publicLinkAgency {
	return publicLinkAgency{ID: inst.ID, Name: inst.Name, JoinMode: inst.JoinMode}
}

type heldResponse struct {
	header http.Header
	status int
	body   bytes.Buffer
}

func (h *heldResponse) Header() http.Header { return h.header }

func (h *heldResponse) WriteHeader(status int) {
	if h.status == 0 {
		h.status = status
	}
}

func (h *heldResponse) Write(p []byte) (int, error) {
	h.WriteHeader(http.StatusOK)
	return h.body.Write(p)
}

func serveNamingAgency(w http.ResponseWriter, r *http.Request, inst agencies.Instance, handler http.HandlerFunc) {
	held := &heldResponse{header: http.Header{}}
	handler(held, r)
	if held.status == http.StatusOK {
		var body map[string]json.RawMessage
		if json.Unmarshal(held.body.Bytes(), &body) == nil {
			agency, err := json.Marshal(agencyOnLink(inst))
			if err == nil {
				body["agency"] = agency
				writeJSON(w, http.StatusOK, body)
				return
			}
		}
	}
	for name, values := range held.header {
		w.Header()[name] = values
	}
	if held.status == 0 {
		held.status = http.StatusOK
	}
	w.WriteHeader(held.status)
	_, _ = w.Write(held.body.Bytes())
}
