package http

import (
	"net/http"
	"net/url"

	"wakalaserver/modules/shared/plaintext"
)

func refuseControlCharactersInAddress(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := addressProblem(r.URL); err != nil {
			writeErr(w, http.StatusBadRequest, err.Error())
			return
		}
		next.ServeHTTP(w, r)
	})
}

func addressProblem(address *url.URL) error {
	if err := plaintext.CheckText("the path", address.Path); err != nil {
		return err
	}
	values, _ := url.ParseQuery(address.RawQuery)
	for name, list := range values {
		if err := plaintext.CheckText("the query name "+name, name); err != nil {
			return err
		}
		for _, value := range list {
			if err := plaintext.CheckText("the query value "+name, value); err != nil {
				return err
			}
		}
	}
	return nil
}
