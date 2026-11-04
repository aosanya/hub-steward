package main

import (
	"bufio"
	"log/slog"
	"os"
	"strings"
)

// envFile is the local development environment, read from the working
// directory on a normal boot. It is gitignored and holds real credentials, so
// nothing but a developer's own machine has one.
const envFile = ".env"

// loadEnvFile reads KEY=VALUE lines from path into the process environment.
// A value already present wins, so `PORT=9000 go run ./cmd/server` still
// overrides the file, and a deployment that sets its own environment is
// unaffected. A missing file is not an error.
func loadEnvFile(path string, logger *slog.Logger) {
	f, err := os.Open(path)
	if err != nil {
		return
	}
	defer func() { _ = f.Close() }()

	var loaded []string
	lines := bufio.NewScanner(f)
	for lines.Scan() {
		line := strings.TrimPrefix(strings.TrimSpace(lines.Text()), "export ")
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		name, value, ok := strings.Cut(line, "=")
		name = strings.TrimSpace(name)
		if !ok || name == "" {
			continue
		}
		if _, set := os.LookupEnv(name); set {
			continue
		}
		if err := os.Setenv(name, unquote(strings.TrimSpace(value))); err != nil {
			logger.Warn("could not apply an environment file entry", "file", path, "name", name, "error", err.Error())
			continue
		}
		loaded = append(loaded, name)
	}
	if err := lines.Err(); err != nil {
		logger.Warn("could not finish reading the environment file", "file", path, "error", err.Error())
	}
	// Names only. The values are the secrets this file exists to hold.
	if len(loaded) > 0 {
		logger.Info("read the environment file", "file", path, "set", strings.Join(loaded, ","))
	}
}

func unquote(v string) string {
	if len(v) > 1 && (v[0] == '"' || v[0] == '\'') && v[len(v)-1] == v[0] {
		return v[1 : len(v)-1]
	}
	return v
}
