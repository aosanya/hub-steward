package accounts

import (
	"errors"
	"net/url"
	"strings"
	"testing"
)

const goodRef = "abcdefghijklmnopqrst"

func supabase() Connection {
	return Connection{Kind: KindSupabase, ProjectRef: goodRef, Region: "eu-central-1", Password: "p@ss word/1"}
}

func TestSupabaseConnectionNeedsALookalikeRefRegionAndPassword(t *testing.T) {
	if err := supabase().Validate(false); err != nil {
		t.Fatalf("good connection refused: %v", err)
	}
	cases := map[string]func(*Connection){
		"short ref":        func(c *Connection) { c.ProjectRef = "abc" },
		"upper-case ref":   func(c *Connection) { c.ProjectRef = strings.ToUpper(goodRef) },
		"hostname as ref":  func(c *Connection) { c.ProjectRef = "evil.example.com:5432/x" },
		"empty region":     func(c *Connection) { c.Region = "" },
		"region injection": func(c *Connection) { c.Region = "eu-central-1.evil.com" },
		"no password":      func(c *Connection) { c.Password = "" },
	}
	for name, mutate := range cases {
		c := supabase()
		mutate(&c)
		if err := c.Validate(false); !errors.Is(err, ErrInvalidConnection) {
			t.Errorf("%s: err = %v", name, err)
		}
	}
}

func TestLocalConnectionIsRefusedUnlessTheStoreAllowsItAndHasADSN(t *testing.T) {
	local := Connection{Kind: KindLocal, DSN: "postgres://localhost/x"}
	if err := local.Validate(false); !errors.Is(err, ErrInvalidConnection) {
		t.Errorf("not allowed: %v", err)
	}
	if err := local.Validate(true); err != nil {
		t.Errorf("allowed: %v", err)
	}
	if err := (Connection{Kind: KindLocal}).Validate(true); !errors.Is(err, ErrInvalidConnection) {
		t.Errorf("no dsn: %v", err)
	}
}

func TestAnUnknownConnectionKindIsInvalid(t *testing.T) {
	err := (Connection{Kind: "mysql"}).Validate(true)
	if !errors.Is(err, ErrInvalidConnection) || !strings.Contains(err.Error(), `"mysql"`) {
		t.Errorf("err = %v", err)
	}
}

func TestSupabaseDSNIsBuiltFromTheRefAndRegionNeverFromCallerText(t *testing.T) {
	dsn, err := supabase().PostgresDSN()
	if err != nil {
		t.Fatal(err)
	}
	u, err := url.Parse(dsn)
	if err != nil {
		t.Fatal(err)
	}
	password, _ := u.User.Password()
	if u.Scheme != "postgres" || u.Host != "aws-0-eu-central-1.pooler.supabase.com:5432" || u.User.Username() != APIRole+"."+goodRef || password != "p@ss word/1" || u.Path != "/postgres" {
		t.Errorf("dsn = %s", dsn)
	}
	if !strings.Contains(dsn, "sslmode=require") || !strings.Contains(dsn, "options=-c%20search_path%3D"+APISchema) {
		t.Errorf("dsn must require TLS and pin the schema with a literal %%20: %s", dsn)
	}
}

func TestPostgresDSNRefusesAnInvalidConnection(t *testing.T) {
	c := supabase()
	c.ProjectRef = "evil.example.com"
	if _, err := c.PostgresDSN(); !errors.Is(err, ErrInvalidConnection) {
		t.Errorf("err = %v", err)
	}
}

func TestLocalDSNIsUsedOnlyWhileTheDevelopmentSwitchIsOn(t *testing.T) {
	local := Connection{Kind: KindLocal, DSN: "postgres://localhost/dev"}
	if _, err := local.PostgresDSN(); !errors.Is(err, ErrInvalidConnection) {
		t.Errorf("switch off: %v", err)
	}
	AllowLocalDSN = true
	t.Cleanup(func() { AllowLocalDSN = false })
	dsn, err := local.PostgresDSN()
	if err != nil || dsn != "postgres://localhost/dev" {
		t.Errorf("switch on: %q %v", dsn, err)
	}
}
