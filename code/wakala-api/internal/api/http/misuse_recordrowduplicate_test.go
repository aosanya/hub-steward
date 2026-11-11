package http

import (
	"context"
	"errors"
	"testing"

	mwanachamaagency "wakalaserver/modules/agency"
	agencymodels "wakalaserver/modules/agency/models"
)

func TestSameAnswersFromAnotherMemberAreNotADuplicate(t *testing.T) {
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
	answers := map[string]string{}
	for _, q := range record.Questions {
		answers[q.Prompt] = "1"
	}
	rowBy := func(member string) agencymodels.RecordRow {
		return agencymodels.RecordRow{
			DraftID: draftID, RecordID: record.ID, RoleID: record.RoleID,
			AddedBy: member, Answers: answers, OrderID: "order-1",
		}
	}

	if _, err := mgr.CreateRecordRow(ctx, rowBy("owner")); err != nil {
		t.Fatalf("the owner's row: %v", err)
	}
	if _, err := mgr.CreateRecordRow(ctx, rowBy("clerk")); err != nil {
		t.Errorf("the clerk giving the same answers on the same order is refused: %v; want it kept as its own entry", err)
	}
	if _, err := mgr.CreateRecordRow(ctx, rowBy("clerk")); !errors.Is(err, mwanachamaagency.ErrDuplicateRecordRow) {
		t.Errorf("the clerk repeating the same answers: %v; want ErrDuplicateRecordRow", err)
	}
}
