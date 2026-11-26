package http

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
)

func tenderFileCarrying(field, value string) map[string]any {
	doc := tenderRolePermissions("record.tender.add.*")
	record := doc["records"].([]any)[0].(map[string]any)
	delete(record, "role_id")
	if field != "" {
		record[field] = value
	}
	return doc
}

func TestAnImportRefusesARecordThatCarriesARemovedRoleField(t *testing.T) {
	cases := map[string][]string{
		"role_id":        {"role_id is gone from a record", "record.tender.add.*", "record.tender.add.<field>"},
		"edit_role_id":   {"edit_role_id is gone from a record", "record.tender.edit.*", "record.tender.edit.<field>"},
		"viewer_role_id": {"viewer_role_id is gone from a record", "record.tender.view.*", "record.tender.view.<field>"},
		"delete_role_id": {"delete_role_id is gone from a record", "record.tender.delete"},
	}
	for field, mentions := range cases {
		w := newStepRunWalk(t, nil)
		before := instanceCount(t, w)
		rec := w.call(t, "POST", "/instances/import", importBodyOf(t, tenderFileCarrying(field, "role-bid")), w.owner)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("%s: the import answered %d %s, want 400", field, rec.Code, rec.Body.String())
			continue
		}
		refusal, _ := decodeObject(t, rec)["error"].(string)
		for _, want := range mentions {
			if !strings.Contains(refusal, want) {
				t.Errorf("%s: the refusal %q does not mention %s", field, refusal, want)
			}
		}
		if after := instanceCount(t, w); after != before {
			t.Errorf("%s: the import left %d new Instances behind, want none", field, after-before)
		}

		err := ImportIntoLaunched(context.Background(), w.db, "Launched agency", json.RawMessage(importBodyOf(t, tenderFileCarrying(field, "role-bid"))))
		if err == nil {
			t.Errorf("%s: the launch import accepted a file the HTTP import refuses", field)
		} else if !strings.Contains(err.Error(), refusal) {
			t.Errorf("%s: the launch import said %q, want the HTTP refusal %q", field, err.Error(), refusal)
		}
		if after := instanceCount(t, w); after != before {
			t.Errorf("%s: the launch import left %d new Instances behind, want none", field, after-before)
		}
	}
}

func TestAnImportReadsARemovedRoleFieldSentEmptyAsAbsent(t *testing.T) {
	for _, field := range []string{"role_id", "edit_role_id", "viewer_role_id", "delete_role_id"} {
		w := newStepRunWalk(t, nil)
		rec := w.call(t, "POST", "/instances/import", importBodyOf(t, tenderFileCarrying(field, "")), w.owner)
		if rec.Code != http.StatusCreated {
			t.Errorf("%s sent empty: the import answered %d %s, want 201", field, rec.Code, rec.Body.String())
		}
	}
}

func TestAGeneratedStepHoldsNoStoredRole(t *testing.T) {
	w := newRowStepWalk(t, nil)
	steps, err := w.manager.ListWorkItems(context.Background(), w.liveID, mwanachamaagency.WorkItemFilter{})
	if err != nil {
		t.Fatalf("ListWorkItems: %v", err)
	}
	seen := 0
	for _, s := range steps {
		if s.RowRecord != w.record.Identity() {
			continue
		}
		seen++
		if s.RoleID != "" {
			t.Errorf("the generated %s step holds the role %q, want none", s.RowAction, s.RoleID)
		}
	}
	if seen != 3 {
		t.Fatalf("found %d generated row steps of the record, want add, edit and delete", seen)
	}
}

func (w rowStepWalk) republishedWith(t *testing.T, granted map[string][]string) rowStepWalk {
	t.Helper()
	for role, codes := range granted {
		if _, err := w.manager.SetRolePermissions(context.Background(), w.roles[role], codes); err != nil {
			t.Fatalf("SetRolePermissions %s: %v", role, err)
		}
	}
	w.publish(t)
	live, err := liveDraftOf(context.Background(), w.manager)
	if err != nil {
		t.Fatalf("liveDraftOf: %v", err)
	}
	w.liveID = live
	return w
}

func TestARowIsAddedOnlyByARoleThatCarriesAnAddCodeOfTheRecord(t *testing.T) {
	w := newRowStepWalk(t, nil)
	code := w.record.Code
	view := mwanachamaagency.RecordPermissionCode(code, mwanachamaagency.RecordViewAction, mwanachamaagency.RecordFieldStar)
	add := mwanachamaagency.RecordPermissionCode(code, agencymodels.RowActionAdd, mwanachamaagency.RecordFieldStar)
	body := map[string]any{"answers": map[string]string{"Tender": "Road survey"}}

	w = w.republishedWith(t, map[string][]string{"Coordinator": {view}, "Volunteer": {add}})
	if rec := w.send(t, w.people["Coordinator"], "add", body); rec.Code != http.StatusForbidden {
		t.Errorf("a role that carries only a view code adds a row: %d %s, want 403", rec.Code, rec.Body.String())
	}
	if rec := w.send(t, w.people["Volunteer"], "add", body); rec.Code != http.StatusCreated {
		t.Errorf("a role that carries an add code adds a row: %d %s, want 201", rec.Code, rec.Body.String())
	}
}
