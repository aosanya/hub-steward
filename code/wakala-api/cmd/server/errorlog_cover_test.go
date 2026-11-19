package main

import (
	"bytes"
	"context"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

type recordingHandler struct {
	min     slog.Level
	records []slog.Record
	attrs   []slog.Attr
	groups  []string
}

func (h *recordingHandler) Enabled(_ context.Context, l slog.Level) bool { return l >= h.min }
func (h *recordingHandler) Handle(_ context.Context, r slog.Record) error {
	h.records = append(h.records, r)
	return nil
}
func (h *recordingHandler) WithAttrs(a []slog.Attr) slog.Handler {
	c := *h
	c.attrs = append(append([]slog.Attr{}, h.attrs...), a...)
	return &c
}
func (h *recordingHandler) WithGroup(n string) slog.Handler {
	c := *h
	c.groups = append(append([]string{}, h.groups...), n)
	return &c
}

func TestFanoutSendsEachRecordOnlyToHandlersThatWantIt(t *testing.T) {
	all := &recordingHandler{min: slog.LevelDebug}
	errorsOnly := &recordingHandler{min: slog.LevelError}
	logger := slog.New(fanoutHandler{all, errorsOnly})
	logger.Info("routine")
	logger.Error("broken")
	if len(all.records) != 2 {
		t.Fatalf("console got %d records, want 2", len(all.records))
	}
	if len(errorsOnly.records) != 1 || errorsOnly.records[0].Message != "broken" {
		t.Fatalf("error file got %v, want only the error", errorsOnly.records)
	}
}

func TestFanoutEnabledWhenAnyHandlerIs(t *testing.T) {
	f := fanoutHandler{&recordingHandler{min: slog.LevelError}, &recordingHandler{min: slog.LevelWarn}}
	if f.Enabled(context.Background(), slog.LevelInfo) {
		t.Error("info enabled though no handler wants it")
	}
	if !f.Enabled(context.Background(), slog.LevelWarn) {
		t.Error("warn must be enabled by the second handler")
	}
	if (fanoutHandler{}).Enabled(context.Background(), slog.LevelError) {
		t.Error("an empty fanout enables nothing")
	}
}

func TestFanoutAttrsAndGroupsReachEveryHandler(t *testing.T) {
	a := &recordingHandler{min: slog.LevelDebug}
	b := &recordingHandler{min: slog.LevelDebug}
	withAttrs := fanoutHandler{a, b}.WithAttrs([]slog.Attr{slog.String("k", "v")}).(fanoutHandler)
	withGroup := fanoutHandler{a, b}.WithGroup("g").(fanoutHandler)
	for i := range withAttrs {
		if got := withAttrs[i].(*recordingHandler).attrs; len(got) != 1 || got[0].Key != "k" {
			t.Errorf("handler %d attrs = %v", i, got)
		}
		if got := withGroup[i].(*recordingHandler).groups; len(got) != 1 || got[0] != "g" {
			t.Errorf("handler %d groups = %v", i, got)
		}
	}
	if len(a.attrs) != 0 || len(a.groups) != 0 {
		t.Error("the original handler was mutated")
	}
}

func TestNewLoggerWithoutAFileWritesNoErrorLog(t *testing.T) {
	t.Setenv(errorLogVariable, "")
	if newLogger(slog.LevelInfo) == nil {
		t.Fatal("no logger")
	}
}

func TestNewLoggerAppendsOnlyErrorsToTheFileAndCreatesItsDirectory(t *testing.T) {
	path := filepath.Join(t.TempDir(), "nested", "dir", "errors.log")
	t.Setenv(errorLogVariable, path)
	logger := newLogger(slog.LevelError + 8)
	logger.Info("quiet")
	logger.Error("loud", "why", "disk")
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	text := string(data)
	if !strings.Contains(text, `"msg":"loud"`) || !strings.Contains(text, `"why":"disk"`) {
		t.Fatalf("error not written: %q", text)
	}
	if strings.Contains(text, "quiet") {
		t.Fatalf("an info record reached the error file: %q", text)
	}
}

func TestNewLoggerFileWritesSurviveARestart(t *testing.T) {
	path := filepath.Join(t.TempDir(), "errors.log")
	t.Setenv(errorLogVariable, path)
	newLogger(slog.LevelInfo).Error("first")
	newLogger(slog.LevelInfo).Error("second")
	data, _ := os.ReadFile(path)
	if strings.Count(string(data), "\n") != 2 || !strings.Contains(string(data), "first") || !strings.Contains(string(data), "second") {
		t.Fatalf("log = %q, want both entries appended", data)
	}
}

func TestNewLoggerFallsBackToConsoleWhenTheFileCannotBeOpened(t *testing.T) {
	dir := t.TempDir()
	blocker := filepath.Join(dir, "blocker")
	if err := os.WriteFile(blocker, []byte("x"), 0o600); err != nil {
		t.Fatal(err)
	}
	t.Setenv(errorLogVariable, filepath.Join(blocker, "errors.log"))
	if newLogger(slog.LevelInfo) == nil {
		t.Fatal("the logger must still work when the file cannot be opened")
	}
}

func TestFailedErrorLogReportsThePathAndTheCause(t *testing.T) {
	var buf bytes.Buffer
	logger := failedErrorLog(slog.NewTextHandler(&buf, nil), "/no/such/file.log", os.ErrPermission)
	logger.Info("still usable")
	out := buf.String()
	for _, want := range []string{"the error log file could not be opened", "/no/such/file.log", "permission denied", "still usable"} {
		if !strings.Contains(out, want) {
			t.Errorf("output missing %q: %s", want, out)
		}
	}
}
