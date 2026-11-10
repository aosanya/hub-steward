package main

import (
	"context"
	"log/slog"
	"os"
	"path/filepath"
)

const errorLogVariable = "WAKALA_ERROR_LOG"

type fanoutHandler []slog.Handler

func (f fanoutHandler) Enabled(ctx context.Context, level slog.Level) bool {
	for _, h := range f {
		if h.Enabled(ctx, level) {
			return true
		}
	}
	return false
}

func (f fanoutHandler) Handle(ctx context.Context, record slog.Record) error {
	for _, h := range f {
		if h.Enabled(ctx, record.Level) {
			_ = h.Handle(ctx, record.Clone())
		}
	}
	return nil
}

func (f fanoutHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	out := make(fanoutHandler, len(f))
	for i, h := range f {
		out[i] = h.WithAttrs(attrs)
	}
	return out
}

func (f fanoutHandler) WithGroup(name string) slog.Handler {
	out := make(fanoutHandler, len(f))
	for i, h := range f {
		out[i] = h.WithGroup(name)
	}
	return out
}

func newLogger(level slog.Level) *slog.Logger {
	console := slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: level})
	path := os.Getenv(errorLogVariable)
	if path == "" {
		return slog.New(console)
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return failedErrorLog(console, path, err)
	}
	file, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return failedErrorLog(console, path, err)
	}
	errors := slog.NewJSONHandler(file, &slog.HandlerOptions{Level: slog.LevelError})
	return slog.New(fanoutHandler{console, errors})
}

func failedErrorLog(console slog.Handler, path string, err error) *slog.Logger {
	logger := slog.New(console)
	logger.Error("the error log file could not be opened", "path", path, "error", err.Error())
	return logger
}
