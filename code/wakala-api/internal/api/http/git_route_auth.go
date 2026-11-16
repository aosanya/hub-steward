package http

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
	"wakalaserver/internal/apikeys"
)

const (
	gitRoutePrefix    = "/git/"
	gitBasicChallenge = `Basic realm="hub"`
	gitUploadPack     = "git-upload-pack"
	gitReceivePack    = "git-receive-pack"
)

type gitAccess struct {
	read  bool
	write bool
}

type gitRouteBackend interface {
	signIn(ctx context.Context, token string) (apikeys.Key, error)
	accessIn(ctx context.Context, agency, account string) (gitAccess, error)
	hasRepository(ctx context.Context, agency, repository string) (bool, error)
}

type gitTarget struct {
	agency     string
	repository string
	pushing    bool
}

func (d *Deps) GitRouteAuth(next http.Handler) http.Handler {
	return gitRouteAuth(depsGitBackend{d: d}, next)
}

func gitRouteAuth(backend gitRouteBackend, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		key, err := signInToGitRoute(backend, r)
		if errors.Is(err, apikeys.ErrInvalidKey) {
			w.Header().Set("WWW-Authenticate", gitBasicChallenge)
			writeErr(w, http.StatusUnauthorized, "authentication required")
			return
		}
		if err != nil {
			refuseGitUnavailable(w, r, "sign-in", err)
			return
		}
		target, refusal := parseGitTarget(r)
		if refusal != 0 {
			writeErr(w, refusal, http.StatusText(refusal))
			return
		}
		access, found, err := gitAccessOf(r.Context(), backend, key, target)
		if err != nil {
			refuseGitUnavailable(w, r, "access check", err)
			return
		}
		if !found {
			writeErr(w, http.StatusNotFound, "not found")
			return
		}
		if target.pushing && !access.write || !target.pushing && !access.read {
			writeErr(w, http.StatusForbidden, "forbidden")
			return
		}
		next.ServeHTTP(w, r.WithContext(accounts.WithID(r.Context(), key.AccountID)))
	})
}

func signInToGitRoute(backend gitRouteBackend, r *http.Request) (apikeys.Key, error) {
	token, ok := gitCredential(r)
	if !ok {
		return apikeys.Key{}, apikeys.ErrInvalidKey
	}
	return backend.signIn(r.Context(), token)
}

func refuseGitUnavailable(w http.ResponseWriter, r *http.Request, stage string, cause error) {
	slog.Default().Error("the git route could not check a request",
		"stage", stage,
		"error", cause.Error(),
		"route", r.Method+" "+r.URL.Path,
	)
	writeErr(w, http.StatusServiceUnavailable, "service unavailable")
}

func gitCredential(r *http.Request) (string, bool) {
	if _, password, ok := r.BasicAuth(); ok && password != "" {
		return password, true
	}
	return bearerToken(r)
}

func gitAccessOf(ctx context.Context, backend gitRouteBackend, key apikeys.Key, target gitTarget) (gitAccess, bool, error) {
	if key.InstanceID != "" && key.InstanceID != target.agency {
		return gitAccess{}, false, nil
	}
	access, err := backend.accessIn(ctx, target.agency, key.AccountID)
	if errors.Is(err, agencies.ErrInstanceNotFound) {
		return gitAccess{}, false, nil
	}
	if err != nil {
		return gitAccess{}, false, err
	}
	if !access.read && !access.write {
		return gitAccess{}, false, nil
	}
	exists, err := backend.hasRepository(ctx, target.agency, target.repository)
	if err != nil || !exists {
		return gitAccess{}, false, err
	}
	return access, true, nil
}

func parseGitTarget(r *http.Request) (gitTarget, int) {
	parts := strings.SplitN(strings.TrimPrefix(r.URL.Path, gitRoutePrefix), "/", 3)
	if len(parts) != 3 || parts[0] == "" || parts[1] == "" {
		return gitTarget{}, http.StatusNotFound
	}
	target := gitTarget{agency: parts[0], repository: strings.TrimSuffix(parts[1], ".git")}
	switch parts[2] {
	case "info/refs":
		return advertisementTarget(r, target)
	case gitUploadPack:
		return packTarget(r, target, false)
	case gitReceivePack:
		return packTarget(r, target, true)
	}
	return gitTarget{}, http.StatusNotFound
}

func advertisementTarget(r *http.Request, target gitTarget) (gitTarget, int) {
	if r.Method != http.MethodGet {
		return gitTarget{}, http.StatusMethodNotAllowed
	}
	switch r.URL.Query().Get("service") {
	case gitUploadPack:
		return target, 0
	case gitReceivePack:
		target.pushing = true
		return target, 0
	}
	return gitTarget{}, http.StatusNotFound
}

func packTarget(r *http.Request, target gitTarget, pushing bool) (gitTarget, int) {
	if r.Method != http.MethodPost {
		return gitTarget{}, http.StatusMethodNotAllowed
	}
	target.pushing = pushing
	return target, 0
}

type depsGitBackend struct{ d *Deps }

func (b depsGitBackend) signIn(ctx context.Context, token string) (apikeys.Key, error) {
	if b.d.APIKeys == nil {
		return apikeys.Key{}, apikeys.ErrInvalidKey
	}
	return b.d.APIKeys.Verify(ctx, token)
}

func (b depsGitBackend) accessIn(ctx context.Context, agency, account string) (gitAccess, error) {
	role, err := b.d.Registry.RoleOf(ctx, agency, account)
	if err != nil {
		return gitAccess{}, err
	}
	if role != agencies.RoleOwner && role != agencies.RoleAgent {
		return gitAccess{}, nil
	}
	if err := mustBeMounted(ctx, b.d.Registry, agency, gitModuleCode); err != nil {
		return gitAccess{}, err
	}
	return gitAccess{read: true, write: true}, nil
}

func (b depsGitBackend) hasRepository(ctx context.Context, agency, repository string) (bool, error) {
	gm, err := b.d.Registry.GitManager(ctx, agency)
	if err != nil {
		if errors.Is(err, agencies.ErrInstanceNotFound) {
			return false, nil
		}
		return false, err
	}
	repositories, err := gm.ListRepositories(ctx)
	if err != nil {
		return false, err
	}
	for _, found := range repositories {
		if found.Name == repository {
			return true, nil
		}
	}
	return false, nil
}
