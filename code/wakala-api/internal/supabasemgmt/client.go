// Package supabasemgmt is the slice of Supabase's Management API the launch
// flow uses: OAuth (authorization code + PKCE), projects, and SQL against a
// project. Every call is made with the token of the person who consented, on
// their own account.
package supabasemgmt

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// DefaultBase is the only host the client talks to in production.
const DefaultBase = "https://api.supabase.com"

// Config is the registered Supabase OAuth app.
type Config struct {
	ClientID     string
	ClientSecret string
	RedirectURI  string
	// Base overrides DefaultBase; tests point it at a fake server.
	Base string
	HTTP *http.Client
}

func (c Config) base() string {
	if c.Base != "" {
		return strings.TrimRight(c.Base, "/")
	}
	return DefaultBase
}

func (c Config) client() *http.Client {
	if c.HTTP != nil {
		return c.HTTP
	}
	return &http.Client{Timeout: 30 * time.Second}
}

// NewPKCE returns a code verifier and its S256 challenge.
func NewPKCE() (verifier, challenge string, err error) {
	b := make([]byte, 32)
	if _, err = rand.Read(b); err != nil {
		return "", "", err
	}
	verifier = base64.RawURLEncoding.EncodeToString(b)
	sum := sha256.Sum256([]byte(verifier))
	return verifier, base64.RawURLEncoding.EncodeToString(sum[:]), nil
}

// AuthorizeURL is where the person is sent to see Supabase's consent screen.
func (c Config) AuthorizeURL(state, challenge string) string {
	q := url.Values{
		"client_id":             {c.ClientID},
		"redirect_uri":          {c.RedirectURI},
		"response_type":         {"code"},
		"state":                 {state},
		"code_challenge":        {challenge},
		"code_challenge_method": {"S256"},
	}
	return c.base() + "/v1/oauth/authorize?" + q.Encode()
}

type Token struct {
	Access  string
	Refresh string
}

func (c Config) Exchange(ctx context.Context, code, verifier string) (Token, error) {
	form := url.Values{
		"grant_type":    {"authorization_code"},
		"code":          {code},
		"redirect_uri":  {c.RedirectURI},
		"code_verifier": {verifier},
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.base()+"/v1/oauth/token", strings.NewReader(form.Encode()))
	if err != nil {
		return Token{}, err
	}
	req.SetBasicAuth(c.ClientID, c.ClientSecret)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	var out struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
	}
	if err := c.do(req, &out); err != nil {
		return Token{}, err
	}
	if out.AccessToken == "" {
		return Token{}, errors.New("supabase returned no access token")
	}
	return Token{Access: out.AccessToken, Refresh: out.RefreshToken}, nil
}

func (c Config) Revoke(ctx context.Context, refreshToken string) error {
	b, err := json.Marshal(map[string]string{
		"client_id": c.ClientID, "client_secret": c.ClientSecret, "refresh_token": refreshToken,
	})
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.base()+"/v1/oauth/revoke", strings.NewReader(string(b)))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	return c.do(req, nil)
}

// Org is a Supabase organization the person belongs to.
type Org struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Slug string `json:"slug"`
}

// Project is a Supabase project.
type Project struct {
	Ref    string `json:"id"`
	Name   string `json:"name"`
	Org    string `json:"organization_id"`
	Region string `json:"region"`
	Status string `json:"status"`
}

// Session is the Management API as one person.
type Session struct {
	cfg   Config
	token string
}

// For returns the API as the person who owns token.
func (c Config) For(token string) *Session { return &Session{cfg: c, token: token} }

func (s *Session) call(ctx context.Context, method, path string, body, out any) error {
	var r io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return err
		}
		r = strings.NewReader(string(b))
	}
	req, err := http.NewRequestWithContext(ctx, method, s.cfg.base()+path, r)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+s.token)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	return s.cfg.do(req, out)
}

func (c Config) do(req *http.Request, out any) error {
	res, err := c.client().Do(req)
	if err != nil {
		return errors.New("could not reach Supabase")
	}
	defer res.Body.Close()
	b, _ := io.ReadAll(io.LimitReader(res.Body, 4<<20))
	if res.StatusCode/100 != 2 {
		return &Error{Status: res.StatusCode, Message: strings.TrimSpace(string(b))}
	}
	if out != nil && len(b) > 0 {
		return json.Unmarshal(b, out)
	}
	return nil
}

// Error is a non-2xx answer from Supabase.
type Error struct {
	Status  int
	Message string
}

func (e *Error) Error() string { return fmt.Sprintf("supabase answered %d: %s", e.Status, e.Message) }

func (s *Session) Orgs(ctx context.Context) ([]Org, error) {
	var out []Org
	return out, s.call(ctx, http.MethodGet, "/v1/organizations", nil, &out)
}

func (s *Session) Projects(ctx context.Context) ([]Project, error) {
	var out []Project
	return out, s.call(ctx, http.MethodGet, "/v1/projects", nil, &out)
}

// CreateProject starts a new project; it is not usable until Ready.
func (s *Session) CreateProject(ctx context.Context, name, orgSlug, region, dbPass string) (Project, error) {
	var out Project
	err := s.call(ctx, http.MethodPost, "/v1/projects", map[string]string{
		"name": name, "organization_slug": orgSlug, "region": region, "db_pass": dbPass,
	}, &out)
	return out, err
}

func (s *Session) Project(ctx context.Context, ref string) (Project, error) {
	var out Project
	return out, s.call(ctx, http.MethodGet, "/v1/projects/"+url.PathEscape(ref), nil, &out)
}

// Ready waits until the project answers ACTIVE_HEALTHY. onStatus, when
// supplied, is handed every status seen along the way: this is the slowest
// step of a launch, so it is the one worth reporting while it runs.
func (s *Session) Ready(ctx context.Context, ref string, every time.Duration, onStatus func(status string)) error {
	for {
		p, err := s.Project(ctx, ref)
		if err != nil {
			return err
		}
		if onStatus != nil {
			onStatus(p.Status)
		}
		switch p.Status {
		case "ACTIVE_HEALTHY":
			return nil
		case "INIT_FAILED", "REMOVED", "GOING_DOWN":
			return fmt.Errorf("project %s is %s", ref, p.Status)
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(every):
		}
	}
}

// Query runs one SQL statement as the project's owner.
func (s *Session) Query(ctx context.Context, ref, sql string) error {
	return s.call(ctx, http.MethodPost, "/v1/projects/"+url.PathEscape(ref)+"/database/query", map[string]string{"query": sql}, nil)
}

// RestrictNetwork limits direct database connections to cidrs.
func (s *Session) RestrictNetwork(ctx context.Context, ref string, cidrs []string) error {
	return s.call(ctx, http.MethodPost, "/v1/projects/"+url.PathEscape(ref)+"/network-restrictions/apply",
		map[string]any{"dbAllowedCidrs": cidrs}, nil)
}

// AnonKey returns the project's anon key — the one Studio signs people in with.
// The service_role key is deliberately never read: no service-role key is held
// anywhere in this design, so user creation goes through a SECURITY DEFINER
// function instead (internal/provision).
func (s *Session) AnonKey(ctx context.Context, ref string) (string, error) {
	var keys []struct {
		Name   string `json:"name"`
		APIKey string `json:"api_key"`
	}
	if err := s.call(ctx, http.MethodGet, "/v1/projects/"+url.PathEscape(ref)+"/api-keys", nil, &keys); err != nil {
		return "", err
	}
	for _, k := range keys {
		if k.Name == "anon" {
			return k.APIKey, nil
		}
	}
	return "", errors.New("supabase returned no anon key for the project")
}
