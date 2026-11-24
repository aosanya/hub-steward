package http

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
)

var tenderRoleCodesOnClosingDate = []string{
	"record.tender.view.closing_date",
	"record.tender.edit.closing_date",
	"record.tender.add.*",
	"record.tender.edit.outcome",
	"report.read",
}

type renameWorld struct {
	walk     stepRunWalk
	result   importResult
	mgr      mwanachamaagency.AgencyManager
	recordID string
	key      string
}

func importedForRename(t *testing.T) renameWorld {
	t.Helper()
	w, result := importTenderRole(t, tenderRoleCodesOnClosingDate...)
	ctx := context.Background()
	mgr, err := w.deps.Registry.AgencyManager(ctx, result.Instance.ID)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}
	records, err := mgr.ListRecords(ctx, result.DraftID, mwanachamaagency.RecordFilter{})
	if err != nil || len(records) != 1 {
		t.Fatalf("ListRecords: %v %+v", err, records)
	}
	world := renameWorld{walk: w, result: result, mgr: mgr, recordID: records[0].ID}
	for _, q := range records[0].Questions {
		if q.Code == "closing_date" {
			world.key = q.Key
		}
	}
	if world.key == "" {
		t.Fatalf("the record has no closing_date field: %+v", records[0].Questions)
	}
	return world
}

func (rw renameWorld) rename(t *testing.T, key, code string) (int, map[string]any) {
	t.Helper()
	path := "/instances/" + rw.result.Instance.ID + "/records/" + rw.recordID + "/fields/" + key + "/code"
	rec := rw.walk.call(t, "PUT", path, map[string]any{"code": code}, rw.walk.owner)
	var body map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &body)
	return rec.Code, body
}

func (rw renameWorld) fieldCodes(t *testing.T) map[string]string {
	t.Helper()
	record, err := rw.mgr.GetRecord(context.Background(), rw.recordID)
	if err != nil {
		t.Fatalf("GetRecord: %v", err)
	}
	byKey := map[string]string{}
	for _, q := range record.Questions {
		byKey[q.Key] = q.Code
	}
	return byKey
}

func (rw renameWorld) rolePermissions(t *testing.T) []string {
	t.Helper()
	roles, err := rw.mgr.ListRoles(context.Background(), rw.result.DraftID, mwanachamaagency.RoleFilter{})
	if err != nil || len(roles) != 1 {
		t.Fatalf("ListRoles: %v %+v", err, roles)
	}
	return roles[0].Permissions
}

func TestRenamingAFieldCodeKeepsTheKeyAndMovesTheRolesInTheSameSave(t *testing.T) {
	rw := importedForRename(t)
	status, body := rw.rename(t, rw.key, "deadline")
	if status != http.StatusOK {
		t.Fatalf("rename: %d %v", status, body)
	}
	if got := rw.fieldCodes(t)[rw.key]; got != "deadline" {
		t.Fatalf("the field with key %s has the code %q, want deadline", rw.key, got)
	}
	want := []string{
		"record.tender.view.deadline",
		"record.tender.edit.deadline",
		"record.tender.add.*",
		"record.tender.edit.outcome",
		"report.read",
	}
	if got := rw.rolePermissions(t); !samePermissions(got, want) {
		t.Fatalf("the role holds %v, want %v", got, want)
	}
}

func TestRenamingAFieldCodeToOneTheRecordHoldsIsRefusedAndChangesNothing(t *testing.T) {
	rw := importedForRename(t)
	before := rw.fieldCodes(t)
	status, body := rw.rename(t, rw.key, "issuer")
	if status != http.StatusBadRequest {
		t.Fatalf("rename to a taken code: %d %v, want 400", status, body)
	}
	for key, code := range rw.fieldCodes(t) {
		if before[key] != code {
			t.Fatalf("field %s changed from %q to %q after a refused rename", key, before[key], code)
		}
	}
	if got := rw.rolePermissions(t); !samePermissions(got, tenderRoleCodesOnClosingDate) {
		t.Fatalf("the role holds %v after a refused rename, want %v", got, tenderRoleCodesOnClosingDate)
	}
}

func TestRenamingAFieldCodeToAMalformedOneIsRefused(t *testing.T) {
	rw := importedForRename(t)
	for _, code := range []string{"Closing Date", "9lives", "closing.date", ""} {
		if status, body := rw.rename(t, rw.key, code); status != http.StatusBadRequest {
			t.Errorf("rename to %q: %d %v, want 400", code, status, body)
		}
	}
}

func TestRenamingAFieldTheRecordDoesNotHaveIsNotFound(t *testing.T) {
	rw := importedForRename(t)
	status, body := rw.rename(t, "f_0000000000000000", "deadline")
	if refusal, _ := body["error"].(string); status != http.StatusNotFound || refusal == "" {
		t.Fatalf("rename of a key the record lacks: %d %v, want 404 with an error", status, body)
	}
}

func TestARenamedFieldCodeIsInTheNextPublicationWithTheRolesFollowing(t *testing.T) {
	rw := importedForRename(t)
	if status, body := rw.rename(t, rw.key, "deadline"); status != http.StatusOK {
		t.Fatalf("rename: %d %v", status, body)
	}
	rec := rw.walk.call(t, "POST", "/instances/"+rw.result.Instance.ID+"/publications", map[string]any{"draft_id": rw.result.DraftID}, rw.walk.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("publish: %d %s", rec.Code, rec.Body.String())
	}
	live, err := rw.mgr.GetPublicationForChannel(context.Background(), "")
	if err != nil {
		t.Fatalf("GetPublicationForChannel: %v", err)
	}
	var codes []string
	for _, r := range live.Document.Records {
		for _, q := range r.Questions {
			codes = append(codes, q.Code)
		}
	}
	if !samePermissions(codes, []string{"deadline", "issuer", "outcome"}) {
		t.Fatalf("the publication holds the field codes %v, want deadline, issuer, outcome", codes)
	}
	if len(live.Document.Roles) != 1 || !containsCode(live.Document.Roles[0].Permissions, "record.tender.view.deadline") ||
		containsCode(live.Document.Roles[0].Permissions, "record.tender.view.closing_date") {
		t.Fatalf("the publication's role holds %+v, want the new code and not the old", live.Document.Roles)
	}
}

func containsCode(codes []string, want string) bool {
	for _, c := range codes {
		if c == want {
			return true
		}
	}
	return false
}
