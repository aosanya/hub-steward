package agencies

import (
	"context"
	"log/slog"
	"time"

	mwanachamacomm "wakalaserver/modules/comm"
)

type SweepReport struct {
	Agencies       int
	PeriodsMade    int
	MessagesSent   int
	DeliveriesGone int64
	FailedAgencies []string
}

func Sweep(ctx context.Context, reg Registry, now time.Time, logger *slog.Logger) (SweepReport, error) {
	var report SweepReport
	instances, err := reg.ListInstances(ctx)
	if err != nil {
		return report, err
	}
	for _, inst := range instances {
		if ctx.Err() != nil {
			return report, ctx.Err()
		}
		if !inst.Approved() {
			continue
		}
		report.Agencies++
		made, taskErr := sweepRepeatingTasks(ctx, reg, inst.ID, now, logger)
		report.PeriodsMade += made
		sent, commErr := sweepStandingMessages(ctx, reg, inst.ID, now)
		report.MessagesSent += sent
		pruned, pruneErr := prunePushDeliveries(ctx, reg, inst.ID, now)
		report.DeliveriesGone += pruned
		if taskErr != nil || commErr != nil || pruneErr != nil {
			report.FailedAgencies = append(report.FailedAgencies, inst.ID)
			logSweepFailure(logger, inst.ID, "repeating tasks", taskErr)
			logSweepFailure(logger, inst.ID, "standing messages", commErr)
			logSweepFailure(logger, inst.ID, "push deliveries", pruneErr)
		}
	}
	return report, nil
}

func sweepRepeatingTasks(ctx context.Context, reg Registry, instanceID string, now time.Time, logger *slog.Logger) (int, error) {
	board, err := reg.TaskManager(ctx, instanceID)
	if err != nil {
		return 0, err
	}
	tasks, err := board.ListRunningRepeatingTasks(ctx)
	if err != nil {
		return 0, err
	}
	made := 0
	var firstErr error
	for _, task := range tasks {
		_, created, err := board.MakeRepeatingTaskDue(ctx, task.ID, now)
		if err != nil {
			logSweepFailure(logger, instanceID, "repeating task "+task.ID, err)
			if firstErr == nil {
				firstErr = err
			}
			continue
		}
		if created {
			made++
		}
	}
	return made, firstErr
}

func sweepStandingMessages(ctx context.Context, reg Registry, instanceID string, now time.Time) (int, error) {
	rooms, err := reg.CommManager(ctx, instanceID)
	if err != nil {
		return 0, err
	}
	sent, err := rooms.SendDueStandingMessages(ctx, now)
	return len(sent), err
}

func logSweepFailure(logger *slog.Logger, instanceID, step string, err error) {
	if err == nil || logger == nil {
		return
	}
	logger.Error("schedule sweep step failed", "instance", instanceID, "step", step, "error", err.Error())
}

func RunScheduleSweep(ctx context.Context, reg Registry, interval time.Duration, clock func() time.Time, logger *slog.Logger) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		report, err := Sweep(ctx, reg, clock(), logger)
		if err != nil && ctx.Err() == nil && logger != nil {
			logger.Error("schedule sweep failed", "error", err.Error())
		}
		if err == nil && logger != nil && (report.PeriodsMade > 0 || report.MessagesSent > 0 || len(report.FailedAgencies) > 0) {
			logger.Info("schedule sweep", "agencies", report.Agencies, "periods_made", report.PeriodsMade, "messages_sent", report.MessagesSent, "failed_agencies", len(report.FailedAgencies))
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

func prunePushDeliveries(ctx context.Context, reg Registry, instanceID string, now time.Time) (int64, error) {
	rooms, err := reg.CommManager(ctx, instanceID)
	if err != nil {
		return 0, err
	}
	return rooms.PushStore.PrunePushDeliveries(ctx, now.Add(-mwanachamacomm.PushDeliveryRetention))
}
