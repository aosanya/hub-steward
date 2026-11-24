package main

import (
	"bytes"
	"strings"
	"testing"
	"time"

	mwanachamaactor "github.com/aosanya/mwanachama-backend-actor"

	apihttp "wakalaserver/internal/api/http"
)

func TestInvitationLifetimeAcceptsDaysAndGoDurations(t *testing.T) {
	cases := map[string]time.Duration{
		"14d":   14 * 24 * time.Hour,
		" 2d ":  48 * time.Hour,
		"336h":  336 * time.Hour,
		"90m":   90 * time.Minute,
		"1h30m": 90 * time.Minute,
	}
	for raw, want := range cases {
		got, err := parseInvitationLifetime(raw)
		if err != nil || got != want {
			t.Errorf("%q gave %v, %v; want %v", raw, got, err, want)
		}
	}
}

func TestInvitationLifetimeBlankFallsBackToTheModuleDefault(t *testing.T) {
	for _, raw := range []string{"", "   "} {
		got, err := parseInvitationLifetime(raw)
		if err != nil || got != mwanachamaactor.DefaultInvitationLifetime {
			t.Errorf("%q gave %v, %v", raw, got, err)
		}
	}
}

func TestInvitationLifetimeRefusesUnreadableValuesNamingTheVariable(t *testing.T) {
	for _, raw := range []string{"abc", "d", "1.5d", "tomorrow", "10"} {
		_, err := parseInvitationLifetime(raw)
		if err == nil || !strings.Contains(err.Error(), invitationLifetimeVar) || !strings.Contains(err.Error(), "14d") {
			t.Errorf("%q gave %v", raw, err)
		}
	}
}

func TestInvitationLifetimeRefusesZeroAndNegative(t *testing.T) {
	for _, raw := range []string{"0d", "0s", "-3d", "-1h"} {
		_, err := parseInvitationLifetime(raw)
		if err == nil || !strings.Contains(err.Error(), "must be positive") {
			t.Errorf("%q gave %v", raw, err)
		}
	}
}

func TestPoolConnectionsReadsAPositiveWholeNumberElseDefaults(t *testing.T) {
	cases := map[string]int{
		"":     defaultPoolConnections,
		"4":    4,
		" 30 ": 30,
		"0":    defaultPoolConnections,
		"-2":   defaultPoolConnections,
		"many": defaultPoolConnections,
		"2.5":  defaultPoolConnections,
	}
	for raw, want := range cases {
		got := poolConnections(func(key string) string {
			if key != poolConnectionsEnv {
				t.Fatalf("read %q", key)
			}
			return raw
		})
		if got != want {
			t.Errorf("%q gave %d, want %d", raw, got, want)
		}
	}
}

func envOf(values map[string]string) func(string) string {
	return func(key string) string { return values[key] }
}

func TestCookieSecureFollowsExplicitSettingOverEverythingElse(t *testing.T) {
	if !cookieSecureFrom(envOf(map[string]string{"WAKALA_COOKIE_SECURE": "true", "WAKALA_DEV_MODE": "true"})) {
		t.Error("explicit true must win over dev mode")
	}
	if cookieSecureFrom(envOf(map[string]string{"WAKALA_COOKIE_SECURE": "false", "PUBLIC_BASE_URL": "https://hub.example"})) {
		t.Error("explicit false must win over an https base url")
	}
}

func TestCookieSecureDefaultsOnlyForHttpsOutsideDevMode(t *testing.T) {
	cases := []struct {
		name string
		env  map[string]string
		want bool
	}{
		{"https base", map[string]string{"PUBLIC_BASE_URL": "https://hub.example"}, true},
		{"http base", map[string]string{"PUBLIC_BASE_URL": "http://hub.example"}, false},
		{"no base", map[string]string{}, false},
		{"https in dev mode", map[string]string{"PUBLIC_BASE_URL": "https://hub.example", "WAKALA_DEV_MODE": "true"}, false},
		{"unrecognised setting falls through", map[string]string{"WAKALA_COOKIE_SECURE": "yes", "PUBLIC_BASE_URL": "https://hub.example"}, true},
	}
	for _, c := range cases {
		if got := cookieSecureFrom(envOf(c.env)); got != c.want {
			t.Errorf("%s: got %v, want %v", c.name, got, c.want)
		}
	}
}

func TestScheduleSweepIntervalDefaultsOffAndParses(t *testing.T) {
	cases := []struct {
		raw  string
		want time.Duration
		on   bool
		warn bool
	}{
		{"", defaultScheduleSweepInterval, true, false},
		{"off", 0, false, false},
		{"0", 0, false, false},
		{"30s", 30 * time.Second, true, false},
		{"2m", 2 * time.Minute, true, false},
		{"soon", defaultScheduleSweepInterval, true, true},
		{"-5s", defaultScheduleSweepInterval, true, true},
		{"0s", defaultScheduleSweepInterval, true, true},
	}
	for _, c := range cases {
		t.Setenv("SCHEDULE_SWEEP_INTERVAL", c.raw)
		var buf bytes.Buffer
		got, on := scheduleSweepInterval(quietLogger(&buf))
		if got != c.want || on != c.on {
			t.Errorf("%q gave %v, %v", c.raw, got, on)
		}
		if warned := strings.Contains(buf.String(), "SCHEDULE_SWEEP_INTERVAL"); warned != c.warn {
			t.Errorf("%q logged=%v, want %v: %s", c.raw, warned, c.warn, buf.String())
		}
	}
}

func TestMemberOriginsKeepsValidOnesAndWarnsOfTheRest(t *testing.T) {
	t.Setenv("MEMBER_APP_ORIGINS", "https://app.example, not-an-origin")
	var buf bytes.Buffer
	got := memberOrigins(quietLogger(&buf))
	if len(got) != 1 || got[0] != "https://app.example" {
		t.Fatalf("origins %v", got)
	}
	if !strings.Contains(buf.String(), "not-an-origin") {
		t.Errorf("rejected entry not reported: %s", buf.String())
	}
}

func TestMemberOriginsBlankFallsBackToTheLocalDefault(t *testing.T) {
	t.Setenv("MEMBER_APP_ORIGINS", "")
	var buf bytes.Buffer
	got := memberOrigins(quietLogger(&buf))
	if len(got) != 1 || got[0] != apihttp.DefaultMemberOrigin {
		t.Fatalf("origins %v", got)
	}
	if strings.Contains(buf.String(), "no member app origin is allowed") {
		t.Errorf("unexpected warning: %s", buf.String())
	}
}

func TestMemberOriginsWarnsWhenEveryEntryIsRejected(t *testing.T) {
	t.Setenv("MEMBER_APP_ORIGINS", "nonsense")
	var buf bytes.Buffer
	if got := memberOrigins(quietLogger(&buf)); len(got) != 0 {
		t.Fatalf("origins %v", got)
	}
	if !strings.Contains(buf.String(), "no member app origin is allowed") {
		t.Errorf("no warning: %s", buf.String())
	}
}

func TestStudioOriginsListsAllowedAndReportsIgnoredEntries(t *testing.T) {
	t.Setenv("MEMBER_APP_ORIGINS", "https://app.example")
	t.Setenv("STUDIO_ORIGINS", "https://console.example, junk")
	var buf bytes.Buffer
	got := studioOrigins(quietLogger(&buf))
	if len(got) != 1 || got[0] != "https://console.example" {
		t.Fatalf("origins %v", got)
	}
	if !strings.Contains(buf.String(), "junk") {
		t.Errorf("ignored entry not reported: %s", buf.String())
	}
}

func TestStudioOriginsNoteWhenNoneSet(t *testing.T) {
	t.Setenv("MEMBER_APP_ORIGINS", "")
	t.Setenv("STUDIO_ORIGINS", "")
	var buf bytes.Buffer
	if got := studioOrigins(quietLogger(&buf)); len(got) != 0 {
		t.Fatalf("origins %v", got)
	}
	if !strings.Contains(buf.String(), "no console origin is allowed") {
		t.Errorf("no note: %s", buf.String())
	}
}
