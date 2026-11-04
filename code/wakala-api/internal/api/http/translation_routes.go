package http

import (
	"context"
	"errors"
	"net/http"
	"regexp"
	"strings"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
	"wakalaserver/internal/languages"
)

type Translator interface {
	Translate(ctx context.Context, texts []string, language string) ([]string, error)
	Detect(ctx context.Context, text string) (string, error)
}

const maxTranslationItems = 200

var (
	languageTag               = regexp.MustCompile(`^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$`)
	errTranslatorUnconfigured = errors.New("translation is not configured")
	errTranslatorFailed       = errors.New("the translator could not answer")
	errTranslationInvalid     = errors.New("invalid translation request")
)

type translationItem struct {
	Key  string `json:"key"`
	Text string `json:"text"`
}

type draftTranslationsRequest struct {
	Languages []string          `json:"languages"`
	Items     []translationItem `json:"items"`
}

type draftItem struct {
	Key    string `json:"key"`
	Source string `json:"source"`
	Text   string `json:"text"`
}

type languageDrafts struct {
	Language string      `json:"language"`
	Items    []draftItem `json:"items"`
}

type draftTranslationsResponse struct {
	Drafts []languageDrafts `json:"drafts"`
}

type translateAnswerRequest struct {
	Text           string `json:"text"`
	Language       string `json:"language"`
	SourceLanguage string `json:"source_language"`
}

type translateAnswerResponse struct {
	Source           string `json:"source"`
	DetectedLanguage string `json:"detected_language"`
	Language         string `json:"language"`
	Text             string `json:"text"`
}

type contentLanguages func(ctx context.Context, instanceID string) ([]string, error)

func agencyContentLanguages(store *languages.Store) contentLanguages {
	if store == nil {
		return nil
	}
	return func(ctx context.Context, instanceID string) ([]string, error) {
		a, err := store.Agency(ctx, instanceID)
		if err != nil {
			return nil, err
		}
		tags := make([]string, len(a.Content))
		for i, code := range a.Content {
			tags[i] = strings.ToLower(code)
		}
		return tags, nil
	}
}

func registerTranslationRoutes(mux *http.ServeMux, reg agencies.Registry, auth callers, translator Translator, content contentLanguages) {
	mux.HandleFunc("POST /instances/{instanceID}/translations/drafts", auth.require(draftTranslationsRoute(reg, translator, content)))
	mux.HandleFunc("POST /instances/{instanceID}/translations/answer", auth.require(translateAnswerRoute(reg, translator)))
}

func mustBeOperator(ctx context.Context, reg agencies.Registry, instanceID string) error {
	caller := accounts.IDFromContext(ctx)
	if caller == "" {
		return agencies.ErrInstanceNotFound
	}
	role, err := reg.RoleOf(ctx, instanceID, caller)
	if err != nil {
		return err
	}
	if role != agencies.RoleOwner && role != agencies.RoleAgent {
		return agencies.ErrInstanceNotFound
	}
	return nil
}

func validLanguage(tag string) bool {
	return languageTag.MatchString(tag)
}

func draftTranslations(ctx context.Context, translator Translator, in draftTranslationsRequest) (draftTranslationsResponse, error) {
	if len(in.Languages) == 0 || len(in.Items) == 0 || len(in.Items) > maxTranslationItems {
		return draftTranslationsResponse{}, errTranslationInvalid
	}
	sources := make([]string, len(in.Items))
	for i, item := range in.Items {
		if strings.TrimSpace(item.Key) == "" || strings.TrimSpace(item.Text) == "" {
			return draftTranslationsResponse{}, errTranslationInvalid
		}
		sources[i] = item.Text
	}
	seen := map[string]bool{}
	for _, language := range in.Languages {
		if !validLanguage(language) || seen[language] {
			return draftTranslationsResponse{}, errTranslationInvalid
		}
		seen[language] = true
	}
	if translator == nil {
		return draftTranslationsResponse{}, errTranslatorUnconfigured
	}
	out := draftTranslationsResponse{Drafts: make([]languageDrafts, 0, len(in.Languages))}
	for _, language := range in.Languages {
		texts, err := translator.Translate(ctx, sources, language)
		if err != nil || len(texts) != len(sources) {
			return draftTranslationsResponse{}, errTranslatorFailed
		}
		items := make([]draftItem, len(in.Items))
		for i, item := range in.Items {
			items[i] = draftItem{Key: item.Key, Source: item.Text, Text: texts[i]}
		}
		out.Drafts = append(out.Drafts, languageDrafts{Language: language, Items: items})
	}
	return out, nil
}

func translateAnswer(ctx context.Context, translator Translator, in translateAnswerRequest) (translateAnswerResponse, error) {
	if strings.TrimSpace(in.Text) == "" || !validLanguage(in.Language) {
		return translateAnswerResponse{}, errTranslationInvalid
	}
	if in.SourceLanguage != "" && !validLanguage(in.SourceLanguage) {
		return translateAnswerResponse{}, errTranslationInvalid
	}
	if translator == nil {
		return translateAnswerResponse{}, errTranslatorUnconfigured
	}
	detected, err := answerLanguage(ctx, translator, in)
	if err != nil {
		return translateAnswerResponse{}, errTranslatorFailed
	}
	out := translateAnswerResponse{Source: in.Text, DetectedLanguage: detected, Language: in.Language, Text: in.Text}
	if detected == in.Language {
		return out, nil
	}
	texts, err := translator.Translate(ctx, []string{in.Text}, in.Language)
	if err != nil || len(texts) != 1 {
		return translateAnswerResponse{}, errTranslatorFailed
	}
	out.Text = texts[0]
	return out, nil
}

func answerLanguage(ctx context.Context, translator Translator, in translateAnswerRequest) (string, error) {
	if in.SourceLanguage != "" {
		return in.SourceLanguage, nil
	}
	return translator.Detect(ctx, in.Text)
}

func writeTranslationErr(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, errTranslationInvalid):
		writeErr(w, http.StatusBadRequest, err.Error())
	case errors.Is(err, errTranslatorUnconfigured):
		writeErr(w, http.StatusServiceUnavailable, err.Error())
	case errors.Is(err, errTranslatorFailed):
		writeErr(w, http.StatusBadGateway, err.Error())
	default:
		writeInstanceErr(w, err)
	}
}

func draftTranslationsRoute(reg agencies.Registry, translator Translator, content contentLanguages) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		instanceID := r.PathValue("instanceID")
		if err := mustBeOperator(r.Context(), reg, instanceID); err != nil {
			writeInstanceErr(w, err)
			return
		}
		var in draftTranslationsRequest
		if err := readJSON(r, &in); err != nil {
			writeReadErr(w, err)
			return
		}
		if len(in.Languages) == 0 && content != nil {
			defaults, err := content(r.Context(), instanceID)
			if err != nil {
				writeErr(w, http.StatusInternalServerError, "internal error")
				return
			}
			in.Languages = defaults
		}
		out, err := draftTranslations(r.Context(), translator, in)
		if err != nil {
			writeTranslationErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, out)
	}
}

func translateAnswerRoute(reg agencies.Registry, translator Translator) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if err := mustBeOperator(r.Context(), reg, r.PathValue("instanceID")); err != nil {
			writeInstanceErr(w, err)
			return
		}
		var in translateAnswerRequest
		if err := readJSON(r, &in); err != nil {
			writeReadErr(w, err)
			return
		}
		out, err := translateAnswer(r.Context(), translator, in)
		if err != nil {
			writeTranslationErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, out)
	}
}
