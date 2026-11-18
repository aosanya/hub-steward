package http

import (
	"context"

	mwanachamaaccounting "wakalaserver/modules/accounting"
	mwanachamaagency "wakalaserver/modules/agency"
	agencymodels "wakalaserver/modules/agency/models"

	"wakalaserver/internal/agencies"
)

type rowLineageReader func(ctx context.Context, recordRowID string) ([]string, error)

func rowLineage(rows []agencymodels.RecordRow, recordRowID string) []string {
	replaces := map[string]string{}
	for _, row := range rows {
		if row.Replaces != "" {
			replaces[row.ID] = row.Replaces
		}
	}
	seen := map[string]bool{recordRowID: true}
	lineage := []string{recordRowID}
	for older, ok := replaces[recordRowID]; ok && !seen[older]; older, ok = replaces[older] {
		seen[older] = true
		lineage = append(lineage, older)
	}
	return lineage
}

func liveRowLineage(reg agencies.Registry, instanceID string) rowLineageReader {
	return func(ctx context.Context, recordRowID string) ([]string, error) {
		m, err := agencyOfAnyone(ctx, reg, instanceID)
		if err != nil {
			return nil, err
		}
		drafts, err := draftsOfEveryPublication(ctx, m)
		if err != nil {
			return nil, err
		}
		var every []agencymodels.RecordRow
		for _, id := range drafts {
			found, err := m.ListRecordRows(ctx, id, mwanachamaagency.RecordRowFilter{})
			if err != nil {
				return nil, err
			}
			every = append(every, found...)
		}
		return rowLineage(every, recordRowID), nil
	}
}

type ledgerFollowingRowCorrections struct {
	mwanachamaaccounting.LedgerRepository
	lineage rowLineageReader
}

func withRowLineage(repo mwanachamaaccounting.LedgerRepository, lineage rowLineageReader) mwanachamaaccounting.LedgerRepository {
	return ledgerFollowingRowCorrections{LedgerRepository: repo, lineage: lineage}
}

func (l ledgerFollowingRowCorrections) lineageOf(ctx context.Context, recordRowID string) []string {
	if recordRowID == "" {
		return nil
	}
	lineage, err := l.lineage(ctx, recordRowID)
	if err != nil || len(lineage) == 0 {
		return []string{recordRowID}
	}
	return lineage
}

func (l ledgerFollowingRowCorrections) ListBills(ctx context.Context, filter mwanachamaaccounting.BillFilter) ([]mwanachamaaccounting.Bill, error) {
	filter.RecordRowIDs = l.lineageOf(ctx, filter.RecordRowID)
	return l.LedgerRepository.ListBills(ctx, filter)
}

func (l ledgerFollowingRowCorrections) ListPayments(ctx context.Context, filter mwanachamaaccounting.PaymentFilter) ([]mwanachamaaccounting.Payment, error) {
	filter.RecordRowIDs = l.lineageOf(ctx, filter.RecordRowID)
	return l.LedgerRepository.ListPayments(ctx, filter)
}
