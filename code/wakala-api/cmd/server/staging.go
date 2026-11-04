package main

import (
	"errors"
	"fmt"
	"log/slog"
	"os"
	"sort"
	"strings"
)

const (
	stagingFlag      = "WAKALA_STAGING"
	liveProjectRef   = "gwqxjuhrvetwkbvefcgp"
	stagingStoreName = "DATABASE_URL"
)

var errStagingWithoutStore = errors.New(stagingStoreName + " is unset, so a staging run would fall back to an in-memory sqlite store")

func stagingRun() bool {
	return os.Getenv(stagingFlag) == "true"
}

func prepareEnvironment(logger *slog.Logger) {
	if !stagingRun() {
		loadEnvFile(envFile, logger)
		return
	}
	if err := checkStagingEnvironment(os.Environ()); err != nil {
		logger.Error("refusing to start a staging run", "error", err.Error())
		os.Exit(1)
	}
	logger.Info("staging run", "env_file", "not read")
}

func checkStagingEnvironment(environ []string) error {
	var live []string
	store := false
	for _, entry := range environ {
		name, value, _ := strings.Cut(entry, "=")
		if name == stagingStoreName && value != "" {
			store = true
		}
		if strings.Contains(strings.ToLower(value), liveProjectRef) {
			live = append(live, name)
		}
	}
	if len(live) > 0 {
		sort.Strings(live)
		return fmt.Errorf("settings naming the live mwanachama-2 project (%s): %s", liveProjectRef, strings.Join(live, ","))
	}
	if !store {
		return errStagingWithoutStore
	}
	return nil
}
