package agencies

import (
	"context"
	"log/slog"
	"os"

	mwanachamataskmanager "wakalaserver/modules/taskmanager"
)

const (
	envBackfillIssueCodes = "WAKALA_BACKFILL_ISSUE_CODES"
	backfillReport        = "report"
	backfillApply         = "apply"
)

func backfillIssueCodes(ctx context.Context, board mwanachamataskmanager.TaskManager, instanceID string) {
	mode := os.Getenv(envBackfillIssueCodes)
	if mode != backfillReport && mode != backfillApply {
		return
	}
	report, err := mwanachamataskmanager.BackfillTaskCodes(ctx, board, mode == backfillApply)
	if err != nil {
		slog.ErrorContext(ctx, "issue code backfill failed", "instance", instanceID, "mode", mode, "error", err.Error())
		return
	}
	slog.InfoContext(ctx, "issue code backfill",
		"instance", instanceID, "mode", mode, "applied", report.Applied, "read", report.Read,
		"from_row", report.FromRow, "from_title", report.FromTitle, "numbered", report.Numbered,
		"unusual", report.Unusual, "duplicates", report.Duplicates)
}
