package main

import (
	"database/sql"
	"errors"
	"strings"
	"testing"

	_ "github.com/glebarez/go-sqlite"

	"wakalaserver/internal/invitemail"
)

func TestInvitationMailIsNilUntilServerAndSenderAreBothSet(t *testing.T) {
	cases := map[string]map[string]string{
		"nothing set":    {},
		"server only":    {"INVITATION_SMTP_ADDR": "smtp.example.org:587"},
		"sender only":    {"INVITATION_MAIL_FROM": "invites@example.org"},
		"blank server":   {"INVITATION_SMTP_ADDR": "   ", "INVITATION_MAIL_FROM": "invites@example.org"},
		"blank sender":   {"INVITATION_SMTP_ADDR": "smtp.example.org:587", "INVITATION_MAIL_FROM": "  "},
		"password alone": {"INVITATION_SMTP_PASSWORD": "secret"},
		"misuse alone":   {"INVITATION_MISUSE_ADDRESS": "abuse@example.org"},
		"fallback alone": {"INVITATION_CONTACT_FALLBACK": "help@example.org"},
	}
	for name, env := range cases {
		if got := invitationMailFrom(envOf(env)); got != nil {
			t.Errorf("%s: want no invitation mail, got %+v", name, got)
		}
	}
}

func TestInvitationMailTrimsSettingsAndKeepsThePasswordVerbatim(t *testing.T) {
	mail := invitationMailFrom(envOf(map[string]string{
		"INVITATION_SMTP_ADDR":        "  smtp.example.org:587 ",
		"INVITATION_SMTP_USER":        " mailer ",
		"INVITATION_SMTP_PASSWORD":    " pa ss ",
		"INVITATION_MAIL_FROM":        " invites@example.org ",
		"INVITATION_MISUSE_ADDRESS":   " report@example.org ",
		"INVITATION_CONTACT_FALLBACK": " help@example.org ",
	}))
	if mail == nil {
		t.Fatal("want invitation mail when server and sender are set")
	}
	want := invitemail.SMTP{Addr: "smtp.example.org:587", User: "mailer", Password: " pa ss ", From: "invites@example.org"}
	if mail.Sender != want {
		t.Errorf("sender = %+v, want %+v", mail.Sender, want)
	}
	if mail.Misuse != "report@example.org" {
		t.Errorf("misuse = %q", mail.Misuse)
	}
	if mail.FallbackContact != "help@example.org" {
		t.Errorf("fallback contact = %q", mail.FallbackContact)
	}
}

func TestInvitationMailMisuseAddressDefaultsWhenBlankOrMissing(t *testing.T) {
	for _, misuse := range []string{"", "   "} {
		mail := invitationMailFrom(envOf(map[string]string{
			"INVITATION_SMTP_ADDR":      "smtp.example.org:587",
			"INVITATION_MAIL_FROM":      "invites@example.org",
			"INVITATION_MISUSE_ADDRESS": misuse,
		}))
		if mail == nil || mail.Misuse != defaultMisuseAddress {
			t.Errorf("misuse %q: got %+v, want default %q", misuse, mail, defaultMisuseAddress)
		}
		if mail != nil && mail.FallbackContact != "" {
			t.Errorf("fallback contact should stay empty, got %q", mail.FallbackContact)
		}
	}
}

func TestStagingEnvironmentAcceptsAStoreWithNoLiveProjectReference(t *testing.T) {
	err := checkStagingEnvironment([]string{"PATH=/usr/bin", "DATABASE_URL=postgres://staging.example.org/db"})
	if err != nil {
		t.Errorf("want no refusal, got %v", err)
	}
}

func TestStagingEnvironmentRefusesARunWithoutAStore(t *testing.T) {
	for name, environ := range map[string][]string{
		"no variables":        {},
		"store unset":         {"PATH=/usr/bin"},
		"store blank":         {"DATABASE_URL="},
		"other name carrying": {"OTHER_DATABASE_URL=postgres://x"},
	} {
		if err := checkStagingEnvironment(environ); !errors.Is(err, errStagingWithoutStore) {
			t.Errorf("%s: err = %v, want errStagingWithoutStore", name, err)
		}
	}
}

func TestStagingEnvironmentNamesEverySettingThatPointsAtTheLiveProject(t *testing.T) {
	err := checkStagingEnvironment([]string{
		"DATABASE_URL=postgres://staging.example.org/db",
		"ZED_URL=https://" + strings.ToUpper(liveProjectRef) + ".supabase.co",
		"ALPHA_URL=https://" + liveProjectRef + ".supabase.co",
		"HARMLESS=value",
	})
	if err == nil {
		t.Fatal("want a refusal naming the live project")
	}
	msg := err.Error()
	if !strings.Contains(msg, liveProjectRef) {
		t.Errorf("message should name the live project: %q", msg)
	}
	if !strings.HasSuffix(msg, "ALPHA_URL,ZED_URL") {
		t.Errorf("settings should be listed sorted: %q", msg)
	}
	if strings.Contains(msg, "HARMLESS") {
		t.Errorf("unrelated settings must not be named: %q", msg)
	}
}

func TestStagingEnvironmentLiveReferenceOutranksAMissingStore(t *testing.T) {
	err := checkStagingEnvironment([]string{"API_URL=https://" + liveProjectRef + ".supabase.co"})
	if err == nil || errors.Is(err, errStagingWithoutStore) {
		t.Errorf("want the live project refusal, got %v", err)
	}
}

func TestStagingEnvironmentSecretValueNeverAppearsInTheRefusal(t *testing.T) {
	secret := "postgres://user:hunter2@db." + liveProjectRef + ".supabase.co/postgres"
	err := checkStagingEnvironment([]string{"DATABASE_URL=" + secret})
	if err == nil {
		t.Fatal("want a refusal")
	}
	if strings.Contains(err.Error(), "hunter2") {
		t.Errorf("refusal leaks a credential: %q", err.Error())
	}
	if !strings.Contains(err.Error(), "DATABASE_URL") {
		t.Errorf("refusal should name the setting: %q", err.Error())
	}
}

func TestStagingRunIsOnlyTheExactWordTrue(t *testing.T) {
	for value, want := range map[string]bool{"true": true, "TRUE": false, "1": false, "": false, "false": false} {
		t.Setenv(stagingFlag, value)
		if got := stagingRun(); got != want {
			t.Errorf("%s=%q: stagingRun = %v, want %v", stagingFlag, value, got, want)
		}
	}
}

func TestSizePoolCapsOpenConnectionsAtTheGivenSize(t *testing.T) {
	pool, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	sizePool(pool, 7)
	if got := pool.Stats().MaxOpenConnections; got != 7 {
		t.Errorf("max open connections = %d, want 7", got)
	}
}
