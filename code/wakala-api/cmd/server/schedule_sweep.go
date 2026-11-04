package main

import (
	"context"
	"log/slog"
	"os"
	"time"

	"wakalaserver/internal/agencies"
)

const defaultScheduleSweepInterval = 5 * time.Minute

func scheduleSweepInterval(logger *slog.Logger) (time.Duration, bool) {
	raw := os.Getenv("SCHEDULE_SWEEP_INTERVAL")
	switch raw {
	case "":
		return defaultScheduleSweepInterval, true
	case "off", "0":
		return 0, false
	}
	interval, err := time.ParseDuration(raw)
	if err != nil || interval <= 0 {
		logger.Error("SCHEDULE_SWEEP_INTERVAL is not a positive duration; using the default", "value", raw, "default", defaultScheduleSweepInterval.String())
		return defaultScheduleSweepInterval, true
	}
	return interval, true
}

func startScheduleSweep(ctx context.Context, reg agencies.Registry, logger *slog.Logger) {
	interval, on := scheduleSweepInterval(logger)
	if !on || reg == nil {
		logger.Info("schedule sweep off")
		return
	}
	logger.Info("schedule sweep on", "interval", interval.String())
	go agencies.RunScheduleSweep(ctx, reg, interval, time.Now, logger)
}
