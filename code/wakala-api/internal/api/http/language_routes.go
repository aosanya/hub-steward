package http

import (
	"errors"
	"log/slog"
	"net/http"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
	"wakalaserver/internal/languages"
)

const (
	languagesNotRead  = "the languages could not be read"
	languagesNotSaved = "the languages could not be saved"
)

var (
	errLanguagesNotRead  = errors.New(languagesNotRead)
	errLanguagesNotSaved = errors.New(languagesNotSaved)
)

func registerLanguageRoutes(mux *http.ServeMux, reg agencies.Registry, store *languages.Store, auth callers) {
	if store == nil {
		return
	}
	mux.HandleFunc("GET /languages", auth.require(listOfferedLanguages))
	mux.HandleFunc("GET /instances/{instanceID}/languages", auth.require(readAgencyLanguages(reg, store)))
	mux.HandleFunc("PUT /instances/{instanceID}/languages", auth.require(setAgencyLanguages(reg, store)))
	mux.HandleFunc("GET /me/studio-language", auth.require(readStudioLanguage(store)))
	mux.HandleFunc("PUT /me/studio-language", auth.require(setStudioLanguage(store)))
	mux.HandleFunc("GET /instances/{instanceID}/me/studio-language", auth.require(readEffectiveStudioLanguage(reg, store)))
}

func listOfferedLanguages(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"items": languages.Offered})
}

func readAgencyLanguages(reg agencies.Registry, store *languages.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		instanceID := r.PathValue("instanceID")
		if _, err := admittedRole(r.Context(), reg, instanceID); err != nil {
			writeInstanceErr(w, err)
			return
		}
		a, err := store.Agency(r.Context(), instanceID)
		if err != nil {
			writeErr(w, http.StatusServiceUnavailable, languagesNotRead)
			return
		}
		writeJSON(w, http.StatusOK, a)
	}
}

func setAgencyLanguages(reg agencies.Registry, store *languages.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		instanceID := r.PathValue("instanceID")
		role, err := admittedRole(r.Context(), reg, instanceID)
		if err != nil {
			writeInstanceErr(w, err)
			return
		}
		if role != agencies.RoleOwner {
			writeInstanceErr(w, agencies.ErrInstanceNotFound)
			return
		}
		var body languages.Agency
		if err := readJSON(r, &body); err != nil {
			writeErr(w, http.StatusBadRequest, err.Error())
			return
		}
		a, err := store.PutAgency(r.Context(), instanceID, body)
		if err != nil {
			writeLanguageErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, a)
	}
}

type studioLanguage struct {
	Language string `json:"language"`
}

func readStudioLanguage(store *languages.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		code, err := store.Person(r.Context(), accounts.IDFromContext(r.Context()))
		if err != nil {
			writeErr(w, http.StatusServiceUnavailable, languagesNotRead)
			return
		}
		writeJSON(w, http.StatusOK, studioLanguage{Language: code})
	}
}

func setStudioLanguage(store *languages.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body studioLanguage
		if err := readJSON(r, &body); err != nil {
			writeErr(w, http.StatusBadRequest, err.Error())
			return
		}
		code, err := store.PutPerson(r.Context(), accounts.IDFromContext(r.Context()), body.Language)
		if err != nil {
			writeLanguageErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, studioLanguage{Language: code})
	}
}

type effectiveStudioLanguage struct {
	Language string `json:"language"`
	Chosen   bool   `json:"chosen"`
}

func readEffectiveStudioLanguage(reg agencies.Registry, store *languages.Store) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		instanceID := r.PathValue("instanceID")
		if _, err := admittedRole(r.Context(), reg, instanceID); err != nil {
			writeInstanceErr(w, err)
			return
		}
		code, err := store.Person(r.Context(), accounts.IDFromContext(r.Context()))
		if err != nil {
			writeErr(w, http.StatusServiceUnavailable, languagesNotRead)
			return
		}
		if code != "" {
			writeJSON(w, http.StatusOK, effectiveStudioLanguage{Language: code, Chosen: true})
			return
		}
		a, err := store.Agency(r.Context(), instanceID)
		if err != nil {
			writeErr(w, http.StatusServiceUnavailable, languagesNotRead)
			return
		}
		writeJSON(w, http.StatusOK, effectiveStudioLanguage{Language: a.StudioDefault})
	}
}

var refusedLanguages = []error{
	languages.ErrUnknownLanguage,
	languages.ErrNoContent,
	languages.ErrRepeated,
	languages.ErrDefaultNotListed,
	languages.ErrNoInstance,
}

func refusedLanguage(err error) bool {
	for _, refused := range refusedLanguages {
		if errors.Is(err, refused) {
			return true
		}
	}
	return false
}

func namedLanguageFailure(err, named error) error {
	if refusedLanguage(err) {
		return err
	}
	slog.Error("the languages store failed", "error", err.Error())
	return named
}

func writeLanguageErr(w http.ResponseWriter, err error) {
	if errors.Is(err, languages.ErrNoPerson) {
		writeErr(w, http.StatusUnauthorized, err.Error())
		return
	}
	if refusedLanguage(err) {
		writeErr(w, http.StatusBadRequest, err.Error())
		return
	}
	writeErr(w, http.StatusServiceUnavailable, languagesNotSaved)
}
