package http

import (
	"context"
	"encoding/json"
	"net/http"
	"sort"
	"strings"
	"testing"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
)

func tenderRolePermissions(permissions ...string) map[string]any {
	doc := map[string]any{
		"name": "Tender agency",
		"roles": []any{
			map[string]any{"id": "role-bid", "code": "R-1", "name": "Bid writer", "permissions": permissions},
		},
		"workflows": []any{
			map[string]any{"id": "wf-tenders", "code": "WF-1", "name": "Keeps tenders"},
		},
		"goals":      []any{map[string]any{"id": "goal-1", "code": "G-1", "title": "Every tender is kept"}},
		"objectives": []any{map[string]any{"id": "obj-1", "code": "O-1", "goal_id": "goal-1", "title": "Keep each tender"}},
		"workflow_objectives": []any{
			map[string]any{"workflow_id": "wf-tenders", "objective_id": "obj-1"},
		},
		"work_items": []any{
			map[string]any{
				"id": "s0", "code": "WI-9", "workflow_id": "wf-tenders", "title": "Read the tender", "ordinality": 2,
				"kind": "fill_form", "role_id": "role-bid", "form_name": "Read",
				"questions": []any{map[string]any{"prompt": "Read", "answer_type": "free_text", "required": true}},
			},
		},
		"records": []any{
			map[string]any{
				"id": "rec-tender", "code": "tender", "workflow_id": "wf-tenders", "name": "Tender",
				"role_id": "role-bid", "form_name": "Tender", "item_name": "Tender",
				"questions": []any{
					map[string]any{"prompt": "Closing date", "answer_type": "date", "required": true},
					map[string]any{"prompt": "Issuer", "answer_type": "free_text", "required": true},
					map[string]any{"prompt": "Outcome", "answer_type": "free_text"},
				},
			},
		},
	}
	return doc
}

var tenderFieldLevelCodes = []string{
	"record.tender.add.*",
	"record.tender.edit.outcome",
	"record.tender.view.closing_date",
	"record.tender.delete",
	"report.read",
}

func sortedCopy(codes []string) []string {
	out := append([]string(nil), codes...)
	sort.Strings(out)
	return out
}

func samePermissions(got, want []string) bool {
	got, want = sortedCopy(got), sortedCopy(want)
	if len(got) != len(want) {
		return false
	}
	for i := range got {
		if got[i] != want[i] {
			return false
		}
	}
	return true
}

func importTenderRole(t *testing.T, permissions ...string) (stepRunWalk, importResult) {
	t.Helper()
	w := newStepRunWalk(t, nil)
	rec := w.call(t, "POST", "/instances/import", importBodyOf(t, tenderRolePermissions(permissions...)), w.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("import: %d %s", rec.Code, rec.Body.String())
	}
	var result importResult
	if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil {
		t.Fatalf("decode import result: %v", err)
	}
	if len(result.Errors) > 0 {
		t.Fatalf("import errors: %v", result.Errors)
	}
	return w, result
}

func TestAnImportedRoleKeepsItsFieldLevelRecordCodesAsWritten(t *testing.T) {
	w, result := importTenderRole(t, tenderFieldLevelCodes...)
	ctx := context.Background()
	mgr, err := w.deps.Registry.AgencyManager(ctx, result.Instance.ID)
	if err != nil {
		t.Fatalf("AgencyManager: %v", err)
	}

	roles, err := mgr.ListRoles(ctx, result.DraftID, mwanachamaagency.RoleFilter{})
	if err != nil {
		t.Fatalf("ListRoles: %v", err)
	}
	if len(roles) != 1 || !samePermissions(roles[0].Permissions, tenderFieldLevelCodes) {
		t.Fatalf("the draft role holds %+v, want %v with the star as written", roles, tenderFieldLevelCodes)
	}

	rec := w.call(t, "POST", "/instances/"+result.Instance.ID+"/publications", map[string]any{"draft_id": result.DraftID}, w.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("publish: %d %s", rec.Code, rec.Body.String())
	}
	live, err := mgr.GetPublicationForChannel(ctx, "")
	if err != nil {
		t.Fatalf("GetPublicationForChannel: %v", err)
	}
	if len(live.Document.Roles) != 1 || !samePermissions(live.Document.Roles[0].Permissions, tenderFieldLevelCodes) {
		t.Fatalf("the publication holds %+v, want %v", live.Document.Roles, tenderFieldLevelCodes)
	}
}

func TestAnImportedRoleMayEditAFieldItCannotView(t *testing.T) {
	_, result := importTenderRole(t, "record.tender.edit.outcome")
	if result.Created["roles"] != 1 {
		t.Fatalf("created %v, want one role", result.Created)
	}
}

type refusedRoleFile struct {
	permissions []string
	mentions    []string
}

func refusedRoleFiles() map[string]refusedRoleFile {
	return map[string]refusedRoleFile{
		"a plain add": {
			[]string{"record.tender.add"},
			[]string{`"Bid writer"`, "record.tender.add", "record.tender.add.*"},
		},
		"a plain edit": {
			[]string{"record.tender.edit"},
			[]string{`"Bid writer"`, "record.tender.edit", "record.tender.edit.*"},
		},
		"a plain view": {
			[]string{"record.tender.view"},
			[]string{`"Bid writer"`, "record.tender.view", "record.tender.view.*"},
		},
		"a field the record lacks": {
			[]string{"record.tender.edit.nothing"},
			[]string{`"Bid writer"`, "record.tender.edit.nothing", `"nothing"`},
		},
		"a record the file lacks": {
			[]string{"record.nothing.add.*"},
			[]string{`"Bid writer"`, "record.nothing.add.*"},
		},
		"a delete naming a field": {
			[]string{"record.tender.delete.outcome"},
			[]string{`"Bid writer"`, "record.tender.delete.outcome"},
		},
		"a code the catalogue lacks": {
			[]string{"report.read", "not.a.permission"},
			[]string{`"Bid writer"`, "not.a.permission"},
		},
	}
}

func TestAnImportRefusesABadRoleCodeAndCreatesNothing(t *testing.T) {
	for name, refused := range refusedRoleFiles() {
		w := newStepRunWalk(t, nil)
		body := importBodyOf(t, tenderRolePermissions(refused.permissions...))
		before := instanceCount(t, w)

		rec := w.call(t, "POST", "/instances/import", body, w.owner)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("%s: the HTTP import answered %d %s, want 400", name, rec.Code, rec.Body.String())
			continue
		}
		refusal, _ := decodeObject(t, rec)["error"].(string)
		for _, want := range refused.mentions {
			if !strings.Contains(refusal, want) {
				t.Errorf("%s: the refusal %q does not mention %s", name, refusal, want)
			}
		}
		if after := instanceCount(t, w); after != before {
			t.Errorf("%s: the HTTP import left %d new Instances behind, want none", name, after-before)
		}

		err := ImportIntoLaunched(context.Background(), w.db, "Launched agency", json.RawMessage(body))
		if err == nil {
			t.Errorf("%s: the launch import accepted a file the HTTP import refuses", name)
		} else if !strings.Contains(err.Error(), refusal) {
			t.Errorf("%s: the launch import said %q, want the HTTP refusal %q", name, err.Error(), refusal)
		}
		if after := instanceCount(t, w); after != before {
			t.Errorf("%s: the launch import left %d new Instances behind, want none", name, after-before)
		}
	}
}

func TestAnImportKeepsARoleCodeOfARecordADerivingStepGives(t *testing.T) {
	doc := tenderRolePermissions("record.look.add.seen", "record.look.view.*")
	doc["work_items"] = append(doc["work_items"].([]any),
		map[string]any{
			"id": "s1", "code": "WI-1", "workflow_id": "wf-tenders", "title": "Look at the tenders", "ordinality": 1,
			"kind": "fill_form", "role_id": "role-bid", "form_name": "Look", "record_code": "look",
			"questions": []any{map[string]any{"prompt": "Seen", "answer_type": "free_text", "required": true}},
		},
	)
	w := newStepRunWalk(t, nil)
	rec := w.call(t, "POST", "/instances/import", importBodyOf(t, doc), w.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("import: %d %s", rec.Code, rec.Body.String())
	}
	var result importResult
	if err := json.Unmarshal(rec.Body.Bytes(), &result); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(result.Errors) > 0 {
		t.Fatalf("import errors: %v", result.Errors)
	}
}
