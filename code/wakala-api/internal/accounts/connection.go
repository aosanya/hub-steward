package accounts

import (
	"errors"
	"fmt"
	"net/url"
	"regexp"
)

// APIRole is the Postgres role the API connects as in every account
// database; provision creates it, and a hosted pooler login is
// "<role>.<project ref>".
const APIRole = "wakala_api"

// APISchema is the schema the API's own tables live in: public, the one a
// customer's own Supabase dashboard opens on. A launched project belongs to
// the person who launched it, and an agency they cannot find in their own
// Table Editor is not theirs in any way that matters.
//
// public is PostgREST's exposed schema, so the lock is no longer "the schema
// is unreachable over HTTP" — it is the grants and RLS provision applies
// instead: anon and authenticated hold nothing here, and every table the API
// creates has row-level security on with no policy. Supabase's pooler does not
// apply a role's stored search_path, so the connection still asks for it
// explicitly.
const APISchema = "public"

// Kind says how a Connection reaches its database.
type Kind string

const (
	// KindSupabase is a hosted Supabase project, dialled through its pooler.
	// The host is always built here from ProjectRef and Region, never taken
	// from a caller-supplied URL.
	KindSupabase Kind = "supabase"
	// KindLocal is a caller-supplied DSN for local development
	// (`supabase start`), refused unless the Store was built to allow it.
	KindLocal Kind = "local"
)

// AllowLocalDSN permits KindLocal connections, which carry a caller-supplied
// DSN rather than one built from a validated project ref. Development only;
// cmd/server sets it from WAKALA_ALLOW_LOCAL_DSN.
var AllowLocalDSN = false

var (
	projectRefPattern = regexp.MustCompile(`^[a-z]{20}$`)
	regionPattern     = regexp.MustCompile(`^[a-z]{2}-[a-z]+-[0-9]$`)

	// ErrInvalidConnection is returned for a Connection that fails validation.
	ErrInvalidConnection = errors.New("accounts: invalid connection")
)

// Connection is how to reach one account's database. It is the secret half
// of a stored row and is only ever held encrypted.
type Connection struct {
	Kind       Kind   `json:"kind"`
	ProjectRef string `json:"project_ref,omitempty"`
	Region     string `json:"region,omitempty"`
	Password   string `json:"password,omitempty"`
	DSN        string `json:"dsn,omitempty"`
}

// Validate rejects anything that could not have come from Supabase. It runs on
// every DSN build, so a ref that is really a hostname cannot be dialled.
func (c Connection) Validate(allowLocal bool) error {
	switch c.Kind {
	case KindSupabase:
		if !projectRefPattern.MatchString(c.ProjectRef) {
			return fmt.Errorf("%w: project ref must be 20 lowercase letters", ErrInvalidConnection)
		}
		if !regionPattern.MatchString(c.Region) {
			return fmt.Errorf("%w: region looks wrong", ErrInvalidConnection)
		}
		if c.Password == "" {
			return fmt.Errorf("%w: password is required", ErrInvalidConnection)
		}
	case KindLocal:
		if !allowLocal {
			return fmt.Errorf("%w: local connections are not allowed here", ErrInvalidConnection)
		}
		if c.DSN == "" {
			return fmt.Errorf("%w: dsn is required", ErrInvalidConnection)
		}
	default:
		return fmt.Errorf("%w: unknown kind %q", ErrInvalidConnection, c.Kind)
	}
	return nil
}

// PostgresDSN is the connection string to dial. For Supabase it is built
// from the validated project ref and region.
func (c Connection) PostgresDSN() (string, error) {
	if err := c.Validate(AllowLocalDSN); err != nil {
		return "", err
	}
	switch c.Kind {
	case KindSupabase:
		u := url.URL{
			Scheme: "postgres",
			User:   url.UserPassword(APIRole+"."+c.ProjectRef, c.Password),
			Host:   fmt.Sprintf("aws-0-%s.pooler.supabase.com:5432", c.Region),
			Path:   "/postgres",
			// Spelled out rather than url.Values.Encode()d: libpq reads a "+"
			// in a URI query literally, so the space has to stay %20.
			RawQuery: "sslmode=require&options=-c%20search_path%3D" + APISchema,
		}
		return u.String(), nil
	case KindLocal:
		return c.DSN, nil
	}
	return "", ErrInvalidConnection
}
