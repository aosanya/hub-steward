package main

import (
	"context"
	"log/slog"
	"time"

	"wakalaserver/internal/agencies"
)

func startStepLimitSweep(ctx context.Context, reg agencies.Registry, rules agencies.RuleOf, logger *slog.Logger) {
	if reg == nil {
		logger.Info("step limit sweep off")
		return
	}
	logger.Info("step limit sweep on", "interval", agencies.StepLimitSweepEvery.String())
	ticker := time.NewTicker(agencies.StepLimitSweepEvery)
	go func() {
		defer ticker.Stop()
		agencies.RunStepLimitSweep(ctx, reg, ticker.C, time.Now, logger, agencies.WithTold(rules))
	}()
}
