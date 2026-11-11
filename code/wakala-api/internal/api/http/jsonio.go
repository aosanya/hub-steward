package http

import (
	"encoding/json"
	"errors"
	"net/http"

	"wakalaserver/modules/shared/httpwire"
)

// writeJSON writes v as the response body with the given status code.
func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, code int, msg string) {
	writeJSON(w, code, map[string]string{"error": httpwire.PlainMessage(msg)})
}

// readJSON decodes a JSON body into v, refusing unknown fields.
func readJSON(r *http.Request, v any) error {
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	return dec.Decode(v)
}

func writeReadErr(w http.ResponseWriter, err error) {
	var tooLarge *http.MaxBytesError
	if errors.As(err, &tooLarge) {
		writeErr(w, http.StatusRequestEntityTooLarge, "request body too large")
		return
	}
	writeErr(w, http.StatusBadRequest, err.Error())
}
