package http

import (
	"context"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"sync"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"

	mwanachamaagency "wakalaserver/modules/agency"
	agencymodels "wakalaserver/modules/agency/models"
)

func openSharedFile(t *testing.T, path string) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:"+path+"?_pragma=busy_timeout(10000)&_pragma=journal_mode(WAL)&_txlock=immediate"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite %s: %v", path, err)
	}
	t.Cleanup(func() {
		if sqlDB, err := db.DB(); err == nil {
			sqlDB.Close()
		}
	})
	return db
}

func TestStepSentOnceWhenTwoProcessesShareADatabase(t *testing.T) {
	plan := []stepSpec{
		{title: "Report", form: "Report form", role: "Volunteer", questions: []agencymodels.StepQuestion{
			{Prompt: "Reason", AnswerType: agencymodels.AnswerFreeText, Required: true},
		}},
		{title: "Confirm", form: "Confirm form", role: "Liaison", questions: []agencymodels.StepQuestion{
			{Prompt: "Arrived", AnswerType: agencymodels.AnswerYesNo, Required: true},
		}},
	}
	path := filepath.Join(t.TempDir(), "wakala.db")
	first := newStepRunWalkOn(t, openSharedFile(t, path), plan, "Volunteer", "Liaison")
	secondDeps, _ := stepRunDeps(t, openSharedFile(t, path))
	secondDeps.Sessions = first.deps.Sessions
	handlers := []http.Handler{first.handler, NewRouter(secondDeps)}

	for round := 0; round < 12; round++ {
		sent := first.submit(t, first.people["Volunteer"], "Report", map[string]string{"Reason": "Round " + string(rune('a'+round))}, "")
		if sent.Code != http.StatusCreated {
			t.Fatalf("round %d: the volunteer's submit: %d %s", round, sent.Code, sent.Body.String())
		}
		order, _ := decodeObject(t, sent)["order_id"].(string)

		const senders = 6
		results := make([]*httptest.ResponseRecorder, senders)
		start := make(chan struct{})
		var wg sync.WaitGroup
		for i := 0; i < senders; i++ {
			wg.Add(1)
			go func(i int) {
				defer wg.Done()
				<-start
				results[i] = callOn(handlers[i%len(handlers)], "POST", "/instances/"+first.instance+"/steps/"+first.steps["Confirm"]+"/answers",
					map[string]any{"answers": map[string]string{"Arrived": "yes"}, "order_id": order}, first.people["Liaison"])
			}(i)
		}
		close(start)
		wg.Wait()

		created, conflicts := 0, 0
		for _, rec := range results {
			switch rec.Code {
			case http.StatusCreated:
				created++
			case http.StatusConflict:
				conflicts++
			default:
				t.Fatalf("round %d: unexpected %d %s", round, rec.Code, rec.Body.String())
			}
		}
		if created != 1 || conflicts != senders-1 {
			t.Fatalf("round %d: %d created and %d conflicts from %d sends split over two processes, want 1 and %d", round, created, conflicts, senders, senders-1)
		}
	}
}

func TestStartupKeepsDuplicateRowsWrittenBeforeTheSendKey(t *testing.T) {
	plan := []stepSpec{
		{title: "Report", form: "Report form", role: "Volunteer", questions: []agencymodels.StepQuestion{
			{Prompt: "Reason", AnswerType: agencymodels.AnswerFreeText, Required: true},
		}},
		{title: "Confirm", form: "Confirm form", role: "Liaison", questions: []agencymodels.StepQuestion{
			{Prompt: "Arrived", AnswerType: agencymodels.AnswerYesNo, Required: true},
		}},
	}
	path := filepath.Join(t.TempDir(), "wakala.db")
	db := openSharedFile(t, path)
	w := newStepRunWalkOn(t, db, plan, "Volunteer", "Liaison")
	sent := w.submit(t, w.people["Volunteer"], "Report", map[string]string{"Reason": "Fever"}, "")
	order, _ := decodeObject(t, sent)["order_id"].(string)
	if rec := w.submit(t, w.people["Liaison"], "Confirm", map[string]string{"Arrived": "yes"}, order); rec.Code != http.StatusCreated {
		t.Fatalf("the liaison's send: %d %s", rec.Code, rec.Body.String())
	}

	var table, index string
	if err := db.Raw(`select m.name from sqlite_master m, pragma_table_info(m.name) p where m.type = 'table' and p.name = 'send_key' and not exists (select 1 from pragma_table_info(m.name) r where r.name = 'run_id')`).Scan(&table).Error; err != nil || table == "" {
		t.Fatalf("find the record rows table: %q %v", table, err)
	}
	if err := db.Raw(`select name from sqlite_master where type = 'index' and tbl_name = ? and sql like '%send_key%'`, table).Scan(&index).Error; err != nil || index == "" {
		t.Fatalf("find the send key index: %q %v", index, err)
	}
	legacy := []string{
		"drop index " + index,
		"insert into " + table + " (id, draft_id, record_id, record_code, role_id, added_by, answers, order_id, replaces, corrected_on, send_key, created_at, last_updated, deleted) " +
			"select id || '-again', draft_id, record_id, record_code, role_id, added_by, answers, order_id, replaces, corrected_on, '', created_at, last_updated, deleted from " + table + " where send_key <> ''",
		"alter table " + table + " drop column send_key",
	}
	for _, stmt := range legacy {
		if err := db.Exec(stmt).Error; err != nil {
			t.Fatalf("%s: %v", stmt, err)
		}
	}

	restarted, _ := stepRunDeps(t, openSharedFile(t, path))
	restarted.Sessions = w.deps.Sessions
	handler := NewRouter(restarted)
	ctx := context.Background()
	mgr, err := restarted.Registry.AgencyManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("AgencyManager after the restart: %v", err)
	}
	draftID, err := liveDraftOf(ctx, mgr)
	if err != nil {
		t.Fatalf("liveDraftOf: %v", err)
	}
	rows, err := mgr.ListRecordRows(ctx, draftID, mwanachamaagency.RecordRowFilter{OrderID: order})
	if err != nil || len(rows) != 4 {
		t.Fatalf("the run holds %d rows after the restart (%v), want the 4 kept as they were", len(rows), err)
	}

	again := callOn(handler, "POST", "/instances/"+w.instance+"/steps/"+w.steps["Confirm"]+"/answers",
		map[string]any{"answers": map[string]string{"Arrived": "yes"}, "order_id": order}, w.people["Liaison"])
	if again.Code != http.StatusConflict {
		t.Fatalf("a send of the step already sent twice: %d %s, want 409", again.Code, again.Body.String())
	}
}
