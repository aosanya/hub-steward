package http

import (
	"context"
	"net/http"
	"testing"

	mwanachamaagency "wakalaserver/modules/agency"
)

func TestAgencyRecordRowAuthorIsTheCallerNotTheBody(t *testing.T) {
	w := referral(t)
	ctx := context.Background()
	mgr, err := w.deps.Registry.AgencyManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	draftID, err := liveDraftOf(ctx, mgr)
	if err != nil {
		t.Fatalf("liveDraftOf: %v", err)
	}
	records, err := mgr.ListRecords(ctx, draftID, mwanachamaagency.RecordFilter{})
	if err != nil || len(records) == 0 {
		t.Fatalf("ListRecords: %v %v", records, err)
	}
	record := records[0]
	questions := map[string]string{}
	for _, q := range record.Questions {
		questions[q.Prompt] = "1"
	}

	forged := "C-forged-clerk-1"
	rec := w.call(t, "POST", "/instances/"+w.instance+"/record-rows", map[string]any{
		"draft_id": draftID, "record_id": record.ID, "record_code": record.Code,
		"role_id": record.RoleID, "added_by": forged, "answers": questions,
	}, w.owner)
	if rec.Code != http.StatusCreated {
		return
	}
	if author, _ := decodeObject(t, rec)["added_by"].(string); author != "test-owner" {
		t.Errorf("the stored row names %q; want the caller's own id test-owner, never the body's %q", author, forged)
	}
}
