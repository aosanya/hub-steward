package http

import (
	"net/http"

	"wakalaserver/modules/shared/dispatch"

	"wakalaserver/internal/agencies"
)

func refusedAsMissing(w http.ResponseWriter, r *http.Request, authorize dispatch.Authorizer, action string) bool {
	if authorize == nil || authorize(r.Context(), action) == nil {
		return false
	}
	writeInstanceErr(w, agencies.ErrInstanceNotFound)
	return true
}
