package http

import (
	"context"
	"fmt"
	"slices"
	"strings"

	"github.com/google/uuid"

	mwanachamaaccounting "github.com/aosanya/mwanachama-backend-accounting"
	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
	mwanachamadigitaltwin "github.com/aosanya/mwanachama-backend-digitaltwin"
	mwanachamataskmanager "github.com/aosanya/mwanachama-backend-taskmanager"

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

func everyLiveRecordRow(ctx context.Context, m mwanachamaagency.AgencyManager) ([]agencymodels.RecordRow, error) {
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
	return every, nil
}

func liveRowLineage(reg agencies.Registry, instanceID string) rowLineageReader {
	return func(ctx context.Context, recordRowID string) ([]string, error) {
		m, err := agencyOfAnyone(ctx, reg, instanceID)
		if err != nil {
			return nil, err
		}
		every, err := everyLiveRecordRow(ctx, m)
		if err != nil {
			return nil, err
		}
		return rowLineage(every, recordRowID), nil
	}
}

type partyRowsOfAgency struct {
	reg        agencies.Registry
	instanceID string
}

func (p partyRowsOfAgency) liveRows(ctx context.Context) ([]agencymodels.RecordRow, error) {
	m, err := p.reg.AgencyManager(ctx, p.instanceID)
	if err != nil {
		return nil, err
	}
	return everyLiveRecordRow(ctx, m)
}

func (p partyRowsOfAgency) RowExists(ctx context.Context, recordRowID string) (bool, error) {
	every, err := p.liveRows(ctx)
	if err != nil {
		return false, err
	}
	return slices.ContainsFunc(every, func(row agencymodels.RecordRow) bool { return row.ID == recordRowID }), nil
}

func (p partyRowsOfAgency) RowChain(ctx context.Context, recordRowID string) ([]string, error) {
	every, err := p.liveRows(ctx)
	if err != nil {
		return nil, err
	}
	return rowLineage(every, recordRowID), nil
}

type boardFollowingRowCorrections struct {
	mwanachamataskmanager.TaskManager
	rows mwanachamataskmanager.PartyRows
}

func withPartyRows(board mwanachamataskmanager.TaskManager, rows mwanachamataskmanager.PartyRows) mwanachamataskmanager.TaskManager {
	return boardFollowingRowCorrections{TaskManager: board, rows: rows}
}

func (b boardFollowingRowCorrections) AddProjectParty(ctx context.Context, party mwanachamataskmanager.ProjectParty) (mwanachamataskmanager.ProjectParty, error) {
	recordRowID := strings.ToLower(strings.TrimSpace(party.RecordRowID))
	if _, err := uuid.Parse(recordRowID); err == nil {
		exists, err := b.rows.RowExists(ctx, recordRowID)
		if err != nil {
			return mwanachamataskmanager.ProjectParty{}, fmt.Errorf("check record row %s: %w", recordRowID, err)
		}
		if !exists {
			return mwanachamataskmanager.ProjectParty{}, fmt.Errorf("%w: record row %s", mwanachamataskmanager.ErrProjectPartyRowUnknown, recordRowID)
		}
	}
	return b.TaskManager.AddProjectParty(ctx, party)
}

func (b boardFollowingRowCorrections) FindProjects(ctx context.Context, filter mwanachamataskmanager.ProjectFilter) ([]mwanachamataskmanager.Project, error) {
	recordRowID := strings.ToLower(strings.TrimSpace(filter.PartyRowID))
	if _, err := uuid.Parse(recordRowID); err == nil {
		chain, err := b.rows.RowChain(ctx, recordRowID)
		if err != nil {
			return nil, fmt.Errorf("follow record row %s: %w", recordRowID, err)
		}
		filter.PartyRowIDs = append(slices.Clone(filter.PartyRowIDs), chain...)
	}
	return b.TaskManager.FindProjects(ctx, filter)
}

type ledgerFollowingRowCorrections struct {
	mwanachamaaccounting.LedgerRepository
	lineage rowLineageReader
}

func withRowLineage(repo mwanachamaaccounting.LedgerRepository, lineage rowLineageReader) mwanachamaaccounting.LedgerRepository {
	return ledgerFollowingRowCorrections{LedgerRepository: repo, lineage: lineage}
}

func lineageOrSelf(ctx context.Context, read rowLineageReader, recordRowID string) []string {
	if recordRowID == "" {
		return nil
	}
	lineage, err := read(ctx, recordRowID)
	if err != nil || len(lineage) == 0 {
		return []string{recordRowID}
	}
	return lineage
}

func (l ledgerFollowingRowCorrections) lineageOf(ctx context.Context, recordRowID string) []string {
	return lineageOrSelf(ctx, l.lineage, recordRowID)
}

func (l ledgerFollowingRowCorrections) ListBills(ctx context.Context, filter mwanachamaaccounting.BillFilter) ([]mwanachamaaccounting.Bill, error) {
	filter.RecordRowIDs = l.lineageOf(ctx, filter.RecordRowID)
	return l.LedgerRepository.ListBills(ctx, filter)
}

func (l ledgerFollowingRowCorrections) ListPayments(ctx context.Context, filter mwanachamaaccounting.PaymentFilter) ([]mwanachamaaccounting.Payment, error) {
	filter.RecordRowIDs = l.lineageOf(ctx, filter.RecordRowID)
	return l.LedgerRepository.ListPayments(ctx, filter)
}

type twinFollowingRowCorrections struct {
	mwanachamadigitaltwin.TwinManager
	lineage rowLineageReader
}

func withTenureRowLineage(twin mwanachamadigitaltwin.TwinManager, lineage rowLineageReader) mwanachamadigitaltwin.TwinManager {
	return twinFollowingRowCorrections{TwinManager: twin, lineage: lineage}
}

func (t twinFollowingRowCorrections) ListTenures(ctx context.Context, filter mwanachamadigitaltwin.TenureFilter) ([]mwanachamadigitaltwin.Tenure, error) {
	filter.HolderRecordRowIDs = lineageOrSelf(ctx, t.lineage, filter.HolderRecordRowID)
	return t.TwinManager.ListTenures(ctx, filter)
}
