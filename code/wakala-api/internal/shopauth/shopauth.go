// Package shopauth answers two questions about a bearer token by asking a
// Supabase project itself, so wakala-api holds no second copy of who anyone
// is: "whose token is this?" (User) and "is this an agency admin of the
// website?" (Admin, which adds the check its admin screens rely on,
// public.is_agency_admin). One Verifier per project — the website's for the
// launch flow, the catalog's for an agent signing in to the database it
// works on.
package shopauth

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"
)

// ErrNotAdmin is returned for a valid token that is not an agency admin, or
// a token Supabase rejects; the two are deliberately not told apart.
var ErrNotAdmin = errors.New("shopauth: not an agency admin")

// ErrNotSignedIn is returned for a token the project does not recognise, and
// for a Verifier with no project configured — an unconfigured verifier
// refuses rather than accepting anything.
var ErrNotSignedIn = errors.New("shopauth: not a signed-in user")

// Verifier checks bearer tokens against the website's Supabase project.
type Verifier struct {
	URL     string // https://<ref>.supabase.co
	AnonKey string
	HTTP    *http.Client
}

func (v Verifier) client() *http.Client {
	if v.HTTP != nil {
		return v.HTTP
	}
	return &http.Client{Timeout: 10 * time.Second}
}

func (v Verifier) call(ctx context.Context, method, path, token string, out any) (int, error) {
	req, err := http.NewRequestWithContext(ctx, method, strings.TrimRight(v.URL, "/")+path, nil)
	if err != nil {
		return 0, err
	}
	req.Header.Set("apikey", v.AnonKey)
	req.Header.Set("Authorization", "Bearer "+token)
	res, err := v.client().Do(req)
	if err != nil {
		return 0, errors.New("could not reach the website's Supabase")
	}
	defer res.Body.Close()
	if res.StatusCode/100 == 2 && out != nil {
		if err := json.NewDecoder(res.Body).Decode(out); err != nil {
			return res.StatusCode, err
		}
	}
	return res.StatusCode, nil
}

// User returns the id of the project user this token belongs to, or
// ErrNotSignedIn. The project decides: an expired, forged or revoked token is
// one Supabase answers 401 to, and nothing here has to know how it was signed.
func (v Verifier) User(ctx context.Context, token string) (string, error) {
	if token == "" || v.URL == "" || v.AnonKey == "" {
		return "", ErrNotSignedIn
	}
	var user struct {
		ID string `json:"id"`
	}
	code, err := v.call(ctx, http.MethodGet, "/auth/v1/user", token, &user)
	if err != nil {
		return "", err
	}
	if code != http.StatusOK || user.ID == "" {
		return "", ErrNotSignedIn
	}
	return user.ID, nil
}

// Admin returns the signed-in admin's user id, or ErrNotAdmin.
func (v Verifier) Admin(ctx context.Context, token string) (string, error) {
	if token == "" {
		return "", ErrNotAdmin
	}
	id, err := v.User(ctx, token)
	if errors.Is(err, ErrNotSignedIn) {
		return "", ErrNotAdmin
	}
	if err != nil {
		return "", err
	}
	user := struct{ ID string }{ID: id}
	var isAdmin bool
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(v.URL, "/")+"/rest/v1/rpc/is_agency_admin", strings.NewReader("{}"))
	if err != nil {
		return "", err
	}
	req.Header.Set("apikey", v.AnonKey)
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	res, err := v.client().Do(req)
	if err != nil {
		return "", errors.New("could not reach the website's Supabase")
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK || json.NewDecoder(res.Body).Decode(&isAdmin) != nil || !isAdmin {
		return "", ErrNotAdmin
	}
	return user.ID, nil
}
