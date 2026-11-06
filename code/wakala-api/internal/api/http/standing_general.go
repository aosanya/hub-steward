package http

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

const commStandingCreateAction = "comm.standing_message.create"

func withGeneralStandingThread(reg agencies.Registry, action string, serve http.HandlerFunc) http.HandlerFunc {
	if action != commStandingCreateAction {
		return serve
	}
	return func(w http.ResponseWriter, r *http.Request) {
		raw, err := io.ReadAll(r.Body)
		if err != nil {
			writeErr(w, http.StatusBadRequest, "the body could not be read")
			return
		}
		r.Body = io.NopCloser(bytes.NewReader(raw))
		var body map[string]json.RawMessage
		if json.Unmarshal(raw, &body) != nil || !threadAbsent(body["thread_id"]) {
			serve(w, r)
			return
		}
		general, err := reg.GeneralThreadID(r.Context(), r.PathValue("instanceID"), r.PathValue("structure_id"), accounts.IDFromContext(r.Context()))
		if err != nil {
			writeInstanceErr(w, err)
			return
		}
		if general != "" {
			body["thread_id"], _ = json.Marshal(general)
			if raw, err = json.Marshal(body); err != nil {
				writeErr(w, http.StatusInternalServerError, "internal error")
				return
			}
			r.Body = io.NopCloser(bytes.NewReader(raw))
			r.ContentLength = int64(len(raw))
		}
		serve(w, r)
	}
}

func threadAbsent(v json.RawMessage) bool {
	return len(v) == 0 || string(v) == "null" || string(v) == `""`
}
