package main

import (
	"bytes"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func quietLogger(buf *bytes.Buffer) *slog.Logger {
	return slog.New(slog.NewTextHandler(buf, &slog.HandlerOptions{Level: slog.LevelDebug}))
}

func writeEnvFile(t *testing.T, content string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), ".env")
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
	return path
}

func TestUnquoteStripsMatchingQuotesOnly(t *testing.T) {
	cases := map[string]string{
		`"double"`:   "double",
		`'single'`:   "single",
		`"mixed'`:    `"mixed'`,
		`"`:          `"`,
		`plain`:      "plain",
		`""`:         "",
		`"a "b" c"`:  `a "b" c`,
		`  spaced  `: `  spaced  `,
	}
	for in, want := range cases {
		if got := unquote(in); got != want {
			t.Errorf("unquote(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestLoadEnvFileSetsValuesAndSkipsNoise(t *testing.T) {
	t.Setenv("COVER_ENV_PLAIN", "")
	os.Unsetenv("COVER_ENV_PLAIN")
	os.Unsetenv("COVER_ENV_EXPORTED")
	os.Unsetenv("COVER_ENV_QUOTED")
	os.Unsetenv("COVER_ENV_EQUALS")
	os.Unsetenv("COVER_ENV_COMMENTED")
	t.Cleanup(func() {
		for _, n := range []string{"COVER_ENV_PLAIN", "COVER_ENV_EXPORTED", "COVER_ENV_QUOTED", "COVER_ENV_EQUALS"} {
			os.Unsetenv(n)
		}
	})
	path := writeEnvFile(t, strings.Join([]string{
		"# a comment",
		"",
		"COVER_ENV_PLAIN=one",
		"export COVER_ENV_EXPORTED=two",
		`COVER_ENV_QUOTED="three four"`,
		"COVER_ENV_EQUALS=a=b=c",
		"no equals sign here",
		"=novalue",
		"#COVER_ENV_COMMENTED=hidden",
	}, "\n"))
	var buf bytes.Buffer
	loadEnvFile(path, quietLogger(&buf))

	want := map[string]string{
		"COVER_ENV_PLAIN":    "one",
		"COVER_ENV_EXPORTED": "two",
		"COVER_ENV_QUOTED":   "three four",
		"COVER_ENV_EQUALS":   "a=b=c",
	}
	for name, value := range want {
		if got := os.Getenv(name); got != value {
			t.Errorf("%s = %q, want %q", name, got, value)
		}
	}
	if _, set := os.LookupEnv("COVER_ENV_COMMENTED"); set {
		t.Error("a commented line was applied")
	}
}

func TestLoadEnvFileKeepsAnExistingValue(t *testing.T) {
	t.Setenv("COVER_ENV_KEEP", "from-process")
	path := writeEnvFile(t, "COVER_ENV_KEEP=from-file\n")
	var buf bytes.Buffer
	loadEnvFile(path, quietLogger(&buf))
	if got := os.Getenv("COVER_ENV_KEEP"); got != "from-process" {
		t.Fatalf("COVER_ENV_KEEP = %q, the process value must win", got)
	}
	if strings.Contains(buf.String(), "COVER_ENV_KEEP") {
		t.Fatalf("a skipped name was reported as loaded: %s", buf.String())
	}
}

func TestLoadEnvFileLogsNamesAndNeverValues(t *testing.T) {
	os.Unsetenv("COVER_ENV_SECRET")
	t.Cleanup(func() { os.Unsetenv("COVER_ENV_SECRET") })
	path := writeEnvFile(t, "COVER_ENV_SECRET=hunter2-super-secret\n")
	var buf bytes.Buffer
	loadEnvFile(path, quietLogger(&buf))
	logged := buf.String()
	if !strings.Contains(logged, "COVER_ENV_SECRET") {
		t.Errorf("the loaded name was not logged: %s", logged)
	}
	if strings.Contains(logged, "hunter2") {
		t.Errorf("a secret value reached the log: %s", logged)
	}
}

func TestLoadEnvFileMissingFileIsSilent(t *testing.T) {
	var buf bytes.Buffer
	loadEnvFile(filepath.Join(t.TempDir(), "absent.env"), quietLogger(&buf))
	if buf.Len() != 0 {
		t.Fatalf("a missing file logged: %s", buf.String())
	}
}

func TestLoadEnvFileWithNothingToSetLogsNothing(t *testing.T) {
	path := writeEnvFile(t, "# only a comment\n\n")
	var buf bytes.Buffer
	loadEnvFile(path, quietLogger(&buf))
	if buf.Len() != 0 {
		t.Fatalf("an empty file logged: %s", buf.String())
	}
}
