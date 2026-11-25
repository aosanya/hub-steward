package http

import (
	"context"
	"net/http"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"

	"wakalaserver/internal/agencies"
)

type testDataCleanupReport struct {
	agencies.TestDataGroup
	RowsTagged map[string]int `json:"rows_tagged"`
}

func registerTestDataCleanupRoute(mux *http.ServeMux, d *Deps, auth callers) {
	mux.HandleFunc("POST /instances/{instanceID}/test-data-cleanup", auth.require(d.testDataCleanupRoute))
}

func (d *Deps) testDataCleanupRoute(w http.ResponseWriter, r *http.Request) {
	report, err := d.testDataCleanup(r.Context(), r.PathValue("instanceID"))
	if err != nil {
		writeTagErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, report)
}

func (d *Deps) testDataCleanup(ctx context.Context, instanceID string) (testDataCleanupReport, error) {
	tags, err := d.tagsAsAdministrator(ctx, instanceID)
	if err != nil {
		return testDataCleanupReport{}, err
	}
	group, err := agencies.EnsureTestDataGroup(ctx, d.Registry, tags, instanceID)
	if err != nil {
		return testDataCleanupReport{}, err
	}
	m, err := d.Registry.AgencyManager(ctx, instanceID)
	if err != nil {
		return testDataCleanupReport{}, err
	}
	tagged, err := tagUntaggedRows(ctx, m, group.TagID)
	if err != nil {
		return testDataCleanupReport{}, err
	}
	return testDataCleanupReport{TestDataGroup: group, RowsTagged: tagged}, nil
}

func tagUntaggedRows(ctx context.Context, m mwanachamaagency.AgencyManager, tagID string) (map[string]int, error) {
	drafts, err := draftsOfEveryPublication(ctx, m)
	if err != nil {
		return nil, err
	}
	tagged := map[string]int{}
	for _, draftID := range drafts {
		records, err := m.ListRecords(ctx, draftID, mwanachamaagency.RecordFilter{})
		if err != nil {
			return nil, err
		}
		for _, record := range records {
			count, err := tagUntaggedRowsOf(ctx, m, draftID, record.ID, tagID)
			if err != nil {
				return nil, err
			}
			tagged[record.Identity()] += count
		}
	}
	return tagged, nil
}

func tagUntaggedRowsOf(ctx context.Context, m mwanachamaagency.AgencyManager, draftID, recordID, tagID string) (int, error) {
	rows, err := m.ListRecordRows(ctx, draftID, mwanachamaagency.RecordRowFilter{RecordID: recordID})
	if err != nil {
		return 0, err
	}
	replaced := map[string]bool{}
	for _, row := range rows {
		if row.Replaces != "" {
			replaced[row.Replaces] = true
		}
	}
	count := 0
	for _, row := range rows {
		if len(row.Tags) > 0 || replaced[row.ID] {
			continue
		}
		if _, err := m.AddRecordRowTag(ctx, row.ID, tagID); err != nil {
			return count, err
		}
		count++
	}
	return count, nil
}
