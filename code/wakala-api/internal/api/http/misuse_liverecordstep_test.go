package http

import (
	"context"
	"net/http"
	"testing"

	mwanachamaagency "wakalaserver/modules/agency"
)

func TestLiveRecordRow_OwnerCannotDoAnotherRolesStepOutOfTurn(t *testing.T) {
	w := referral(t)
	ctx := context.Background()

	sent := w.submit(t, w.people["Volunteer"], "Report a referral", map[string]string{"Reason": "Needs a clinic check", "Minutes to the clinic": "25"}, "")
	if sent.Code != http.StatusCreated {
		t.Fatalf("the volunteer's submit: %d %s", sent.Code, sent.Body.String())
	}
	order, _ := decodeObject(t, sent)["order_id"].(string)
	if order == "" {
		t.Fatalf("no order_id in %s", sent.Body.String())
	}

	mgr, err := w.deps.Registry.AgencyManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	draftID, err := liveDraftOf(ctx, mgr)
	if err != nil {
		t.Fatalf("liveDraftOf: %v", err)
	}
	records, err := mgr.ListRecords(ctx, draftID, mwanachamaagency.RecordFilter{})
	if err != nil {
		t.Fatalf("ListRecords: %v", err)
	}
	closing := ""
	for _, r := range records {
		if r.Name == "Close the referral" {
			closing = r.Code
		}
	}
	if closing == "" {
		t.Fatalf("no register for the closing step in %v", records)
	}

	if rec := w.submit(t, w.owner, "Close the referral", map[string]string{"Note": "Closed by the owner"}, order); rec.Code != http.StatusForbidden {
		t.Fatalf("owner answering the coordinator's step: %d %s, want 403", rec.Code, rec.Body.String())
	}

	row := w.call(t, "POST", "/instances/"+w.instance+"/live-records/"+closing+"/rows", map[string]any{"answers": map[string]string{"Note": "Closed by the owner"}, "order_id": order}, w.owner)
	if row.Code != http.StatusForbidden && row.Code != http.StatusConflict {
		t.Errorf("owner adding a row to the coordinator's step register while the run waits at the liaison: %d %s, want 403 or 409", row.Code, row.Body.String())
	}

	if rec := w.submit(t, w.people["Liaison"], "Confirm arrival", map[string]string{"Arrived": "yes"}, order); rec.Code != http.StatusCreated {
		t.Fatalf("the liaison answering her waiting step: %d %s, want 201", rec.Code, rec.Body.String())
	}

	other := w.submit(t, w.people["Volunteer"], "Report a referral", map[string]string{"Reason": "Second referral", "Minutes to the clinic": "10"}, "")
	if other.Code != http.StatusCreated {
		t.Fatalf("the volunteer's second submit: %d %s", other.Code, other.Body.String())
	}
	second, _ := decodeObject(t, other)["order_id"].(string)
	if rec := w.submit(t, w.people["Liaison"], "Confirm arrival", map[string]string{"Arrived": "yes"}, second); rec.Code != http.StatusCreated {
		t.Fatalf("the liaison on the second run: %d %s, want 201", rec.Code, rec.Body.String())
	}
	if rec := w.submit(t, w.people["Coordinator"], "Close the referral", map[string]string{"Note": "Closed"}, second); rec.Code != http.StatusCreated {
		t.Fatalf("the coordinator answering her waiting step: %d %s, want 201", rec.Code, rec.Body.String())
	}
}
