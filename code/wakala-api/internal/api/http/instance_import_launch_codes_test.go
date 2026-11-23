package http

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"testing"
)

func withASecondRecordCoded(code string) func(doc map[string]any) {
	return func(doc map[string]any) {
		doc["workflows"] = append(doc["workflows"].([]any), map[string]any{"id": "wf-other", "code": "WF-4", "name": "Keeps tenders"})
		second := map[string]any{}
		for field, value := range doc["records"].([]any)[0].(map[string]any) {
			second[field] = value
		}
		second["id"], second["code"], second["workflow_id"], second["name"] = "rec-2", code, "wf-other", "Tender"
		delete(second, "add_replaced_by")
		doc["records"] = append(doc["records"].([]any), second)
	}
}

func refusedRecordCodeFiles(t *testing.T) map[string]map[string]any {
	t.Helper()
	files := map[string]map[string]any{
		"two records coded day_worked":                            recordCodedFile(t, "day_worked"),
		"a record coded Day_worked":                               recordCodedFile(t, "Day_worked"),
		"a subject_record naming a record the file does not hold": recordCodedFile(t, "day_worked"),
	}
	withASecondRecordCoded("day_worked")(files["two records coded day_worked"])
	files["a subject_record naming a record the file does not hold"]["workflows"].([]any)[1].(map[string]any)["subject_record"] = "tender"
	return files
}

func instanceCount(t *testing.T, w stepRunWalk) int {
	t.Helper()
	all, err := w.deps.Registry.ListInstances(context.Background())
	if err != nil {
		t.Fatalf("ListInstances: %v", err)
	}
	return len(all)
}

func TestLaunchRefusesWhatTheHTTPImportRefusesAndCreatesNothing(t *testing.T) {
	for name, doc := range refusedRecordCodeFiles(t) {
		w := newStepRunWalk(t, nil)
		body := importBodyOf(t, doc)

		rec := w.call(t, "POST", "/instances/import", body, w.owner)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("%s: the HTTP import answered %d, want 400", name, rec.Code)
			continue
		}
		refusal, _ := decodeObject(t, rec)["error"].(string)
		before := instanceCount(t, w)

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
