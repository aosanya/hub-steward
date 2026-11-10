package http

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	catalog "wakalaserver/modules/catalog"
	forms "wakalaserver/modules/forms"
	formsmodels "wakalaserver/modules/forms/models"
)

type sendRecordsForms struct {
	forms.FormManager
	stored []formsmodels.Answer
	err    error
}

func (f sendRecordsForms) SubmitAnswersFor(context.Context, string, string, string, string, string, []formsmodels.Answer) ([]formsmodels.Answer, error) {
	return f.stored, f.err
}

type sendRecordsCatalog struct {
	catalog.CatalogManager
	put    []catalog.Record
	putErr error
}

func (c *sendRecordsCatalog) PutRecord(_ context.Context, r catalog.Record) (catalog.Record, error) {
	c.put = append(c.put, r)
	return r, c.putErr
}

type sendRecordsCatalogs struct {
	manager catalog.CatalogManager
	err     error
}

func (c sendRecordsCatalogs) CatalogManager(context.Context, string, string) (catalog.CatalogManager, error) {
	return c.manager, c.err
}

func recordedAnswers() []formsmodels.Answer {
	yes := true
	count := 3.0
	return []formsmodels.Answer{
		{QuestionID: "q1", ValueBool: &yes, ChapterID: "ch1"},
		{QuestionID: "q2", ValueNumber: &count},
		{QuestionID: "q3", OptionIDs: []string{"a", "b"}},
		{QuestionID: "q4", ValueText: "free words are not counted"},
	}
}

func TestSubmittedAnswersLeaveACountableRecord(t *testing.T) {
	cm := &sendRecordsCatalog{}
	sends := sendsRecorded{
		FormManager: sendRecordsForms{stored: recordedAnswers()},
		catalogs:    sendRecordsCatalogs{manager: cm},
		instanceID:  "i",
	}
	stored, err := sends.SubmitAnswersFor(context.Background(), "form1", "member1", "", "en", "", nil)
	if err != nil || len(stored) != 4 {
		t.Fatalf("stored %d err %v: the answers must come back as the form kept them", len(stored), err)
	}
	if len(cm.put) != 1 {
		t.Fatalf("one record per send, got %d", len(cm.put))
	}
	rec := cm.put[0]
	if rec.SubjectID != "form1" || rec.HolderID != "member1" || rec.ScopeID != "ch1" {
		t.Fatalf("record %+v", rec)
	}
	var doc map[string]any
	if err := json.Unmarshal([]byte(rec.Doc), &doc); err != nil {
		t.Fatal(err)
	}
	if len(doc) != 3 || doc["q1"] != true || doc["q2"] != 3.0 {
		t.Fatalf("the record must hold yes/no, numbers and choices only, got %v", doc)
	}
	if _, counted := doc["q4"]; counted {
		t.Fatal("free text must not be counted")
	}
}

func TestARefusedSubmissionLeavesNoRecord(t *testing.T) {
	cm := &sendRecordsCatalog{}
	refused := errors.New("answer required")
	sends := sendsRecorded{
		FormManager: sendRecordsForms{err: refused},
		catalogs:    sendRecordsCatalogs{manager: cm},
	}
	if _, err := sends.SubmitAnswersFor(context.Background(), "f", "m", "", "en", "", nil); !errors.Is(err, refused) {
		t.Fatalf("the refusal must reach the caller, got %v", err)
	}
	if len(cm.put) != 0 {
		t.Fatal("nothing may be recorded for a refused submission")
	}
}

func TestSendsStillSucceedWhereRecordsAreNotKept(t *testing.T) {
	noCatalog := sendsRecorded{
		FormManager: sendRecordsForms{stored: recordedAnswers()},
		catalogs:    sendRecordsCatalogs{err: errors.New("catalog not mounted")},
	}
	if _, err := noCatalog.SubmitAnswersFor(context.Background(), "f", "m", "", "en", "", nil); err != nil {
		t.Fatalf("an agency with no record catalog must still accept answers, got %v", err)
	}
	notKept := sendsRecorded{
		FormManager: sendRecordsForms{stored: recordedAnswers()},
		catalogs:    sendRecordsCatalogs{manager: &sendRecordsCatalog{putErr: catalog.ErrRecordsNotKept}},
	}
	if _, err := notKept.SubmitAnswersFor(context.Background(), "f", "m", "", "en", "", nil); err != nil {
		t.Fatalf("a catalog that keeps no records must not fail the send, got %v", err)
	}
}

func TestAStoreErrorWhileRecordingIsReported(t *testing.T) {
	down := errors.New("store down")
	sends := sendsRecorded{
		FormManager: sendRecordsForms{stored: recordedAnswers()},
		catalogs:    sendRecordsCatalogs{manager: &sendRecordsCatalog{putErr: down}},
	}
	if _, err := sends.SubmitAnswersFor(context.Background(), "f", "m", "", "en", "", nil); !errors.Is(err, down) {
		t.Fatalf("a failed record write must be reported, got %v", err)
	}
}

func TestAnsweredThroughIsTheFirstChapterGiven(t *testing.T) {
	if got := answeredThrough([]formsmodels.Answer{{QuestionID: "a"}, {ChapterID: "c2"}, {ChapterID: "c3"}}); got != "c2" {
		t.Fatalf("got %q", got)
	}
	if got := answeredThrough(nil); got != "" {
		t.Fatalf("no answers have no chapter, got %q", got)
	}
}
