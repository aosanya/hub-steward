package http

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"

	"wakalaserver/internal/agencies"
)

type rowStepWalk struct {
	stepRunWalk
	record  agencymodels.Record
	liveID  string
	manager mwanachamaagency.AgencyManager
}

func tenderQuestions() []agencymodels.StepQuestion {
	return []agencymodels.StepQuestion{
		{Prompt: "Tender", AnswerType: agencymodels.AnswerFreeText, Required: true},
		{Prompt: "Client", AnswerType: agencymodels.AnswerFreeText},
	}
}

func newRowStepWalk(t *testing.T, shape func(w stepRunWalk, r *agencymodels.Record)) rowStepWalk {
	t.Helper()
	w := referral(t)
	ctx := context.Background()
	mgr, err := w.deps.Registry.AgencyManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	record := agencymodels.Record{
		DraftID: w.draftID, WorkflowID: w.workflow, Name: "Tenders", ItemName: "Tender",
		FormName: "Tender", Questions: tenderQuestions(),
	}
	if shape != nil {
		shape(w, &record)
	}
	created, err := mgr.CreateRecord(ctx, record)
	if err != nil {
		t.Fatalf("CreateRecord: %v", err)
	}
	letRoleDo(t, mgr, w.roles["Coordinator"], created, agencymodels.RowActionAdd)
	letRoleDo(t, mgr, w.roles["Liaison"], created, agencymodels.RowActionAdd, agencymodels.RowActionEdit)
	letRoleDo(t, mgr, w.roles["Volunteer"], created, agencymodels.RowActionDelete)
	w.publish(t)
	live, err := liveDraftOf(ctx, mgr)
	if err != nil {
		t.Fatalf("liveDraftOf: %v", err)
	}
	return rowStepWalk{stepRunWalk: w, record: created, liveID: live, manager: mgr}
}

func (w rowStepWalk) generatedStepID(t *testing.T, action string) string {
	t.Helper()
	steps, err := w.manager.ListWorkItems(context.Background(), w.liveID, mwanachamaagency.WorkItemFilter{})
	if err != nil {
		t.Fatalf("ListWorkItems: %v", err)
	}
	for _, s := range steps {
		if s.Code == w.record.Key+"."+action+".1" {
			return s.ID
		}
	}
	t.Fatalf("the live version has no step %s.%s.1", w.record.Key, action)
	return ""
}

func (w rowStepWalk) send(t *testing.T, as *http.Cookie, action string, body map[string]any) *httptest.ResponseRecorder {
	t.Helper()
	return w.call(t, "POST", "/instances/"+w.instance+"/steps/"+w.generatedStepID(t, action)+"/answers", body, as)
}

func (w rowStepWalk) add(t *testing.T, as *http.Cookie, tender string) string {
	t.Helper()
	rec := w.send(t, as, "add", map[string]any{"answers": map[string]string{"Tender": tender}})
	if rec.Code != http.StatusCreated {
		t.Fatalf("add %s: %d %s", tender, rec.Code, rec.Body.String())
	}
	id, _ := decodeObject(t, rec)["row_id"].(string)
	return id
}

func (w rowStepWalk) rows(t *testing.T, query string) []agencymodels.RecordRow {
	t.Helper()
	path := "/instances/" + w.instance + "/live-records/" + w.record.Key + "/rows" + query
	rec := w.call(t, "GET", path, nil, w.owner)
	if rec.Code != http.StatusOK {
		t.Fatalf("GET %s: %d %s", path, rec.Code, rec.Body.String())
	}
	var rows []agencymodels.RecordRow
	decodeInto(t, rec, &rows)
	return rows
}

func (w rowStepWalk) seedRow(t *testing.T, tender, orderID string) agencymodels.RecordRow {
	t.Helper()
	row, err := w.manager.CreateRecordRow(context.Background(), agencymodels.RecordRow{
		DraftID: w.liveID, RecordID: w.record.ID, RoleID: w.roles["Coordinator"], AddedBy: "seed",
		Answers: map[string]string{"Tender": tender}, OrderID: orderID,
	})
	if err != nil {
		t.Fatalf("seed row: %v", err)
	}
	return row
}

func (w rowStepWalk) agentWith(t *testing.T, subject, role string) *http.Cookie {
	t.Helper()
	if err := w.deps.Registry.AddMember(context.Background(), w.instance, subject, agencies.RoleAgent); err != nil {
		t.Fatalf("AddMember agent: %v", err)
	}
	w.seatAs(t, subject, w.roles[role])
	return w.cookieFor(t, subject)
}

func decodeInto(t *testing.T, rec *httptest.ResponseRecorder, out any) {
	t.Helper()
	if err := json.Unmarshal(rec.Body.Bytes(), out); err != nil {
		t.Fatalf("decode %q: %v", rec.Body.String(), err)
	}
}
