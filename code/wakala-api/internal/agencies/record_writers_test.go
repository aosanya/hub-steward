package agencies

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	mwanachamacatalog "wakalaserver/modules/catalog"
	mwanachamaforms "wakalaserver/modules/forms"
	formsmodels "wakalaserver/modules/forms/models"
	"wakalaserver/modules/shared/spec"
)

func sqliteDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	return db
}

func registerCatalog(t *testing.T, db *gorm.DB) mwanachamacatalog.CatalogManager {
	t.Helper()
	s, err := mwanachamacatalog.SpecFor("landing", MountFormRecords)
	if err != nil {
		t.Fatal(err)
	}
	if err := spec.Migrate(db, s); err != nil {
		t.Fatal(err)
	}
	cm, err := mwanachamacatalog.NewCatalogManager(db, s)
	if err != nil {
		t.Fatal(err)
	}
	return cm
}

func writerOver(cm mwanachamacatalog.CatalogManager) catalogRecordWriter {
	return catalogRecordWriter{catalog: func(context.Context) (mwanachamacatalog.CatalogManager, error) { return cm, nil }}
}

func landed(name string, key map[string]string, fields map[string]any) mwanachamaforms.LandedRecord {
	return mwanachamaforms.LandedRecord{Record: "catalog." + name, Key: key, Fields: fields}
}

func TestCatalogWriterCreatesARecordAndUpdatesItOnTheSameKey(t *testing.T) {
	cm := registerCatalog(t, sqliteDB(t))
	w := writerOver(cm)
	ctx := context.Background()
	key := map[string]string{"member": "mem-1", "full_name": "Ilona Test"}
	if err := w.Write(ctx, landed("person", key, map[string]any{"ward": "North"})); err != nil {
		t.Fatal(err)
	}
	if err := w.Write(ctx, landed("person", key, map[string]any{"ward": "South"})); err != nil {
		t.Fatal(err)
	}
	if err := w.Write(ctx, landed("person", map[string]string{"member": "mem-2", "full_name": "Bela Test"}, map[string]any{"ward": "North"})); err != nil {
		t.Fatal(err)
	}
	records, err := cm.ListRecords(ctx, "person", "")
	if err != nil {
		t.Fatal(err)
	}
	if len(records) != 2 {
		t.Fatalf("records = %d, want 2: a second write on one key must update, not add", len(records))
	}
	var doc map[string]any
	for _, r := range records {
		if r.HolderID == `{"full_name":"Ilona Test","member":"mem-1"}` {
			if err := json.Unmarshal([]byte(r.Doc), &doc); err != nil {
				t.Fatal(err)
			}
		}
	}
	if doc["ward"] != "South" {
		t.Fatalf("Ilona's record = %v, want ward South", doc)
	}
}

func TestCatalogWriterRefusesARecordNotNamedForAModule(t *testing.T) {
	w := writerOver(registerCatalog(t, sqliteDB(t)))
	err := w.Write(context.Background(), mwanachamaforms.LandedRecord{Record: "person", Key: map[string]string{"a": "b"}})
	if err == nil {
		t.Fatal("a record with no module was written")
	}
}

func TestOnlyTheCatalogTheLedgerAndRatingsHaveAWriter(t *testing.T) {
	writers := (&registry{}).recordWritersIn("landing")
	for _, module := range []string{"catalog", "accounting", "ratings"} {
		if _, found := writers(module); !found {
			t.Fatalf("module %q has no writer", module)
		}
	}
	for _, module := range []string{"taskmanager", "voting", ""} {
		if _, found := writers(module); found {
			t.Fatalf("module %q has a writer", module)
		}
	}
}

func TestASubmittedAnswerLandsInTheCatalogAndAResendUpdatesIt(t *testing.T) {
	db := sqliteDB(t)
	cm := registerCatalog(t, db)
	fs, err := mwanachamaforms.SpecFor("landing")
	if err != nil {
		t.Fatal(err)
	}
	if err := mwanachamaforms.Provision(db, fs); err != nil {
		t.Fatal(err)
	}
	fm, err := mwanachamaforms.NewFormManager(db, fs)
	if err != nil {
		t.Fatal(err)
	}
	writer := writerOver(cm)
	fm.UseRecordWriters(func(module string) (mwanachamaforms.RecordWriter, bool) {
		if module == moduleCatalog {
			return writer, true
		}
		return nil, false
	})
	ctx := context.Background()
	form, err := fm.Create(ctx, formsmodels.Form{
		Title: "Synthetic registration", ClosesAt: "2099-01-01T00:00:00Z", OriginatorChapterID: "g-1",
		CreatedBy: "author-1", Audience: formsmodels.AudienceMember, CollectionMode: formsmodels.CollectionSelf,
		LandsIn: formsmodels.LandsIn{
			Record: "catalog.person", KeyedBy: []string{"member"},
			FieldMap: map[string]string{"Ward": "ward"},
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	ward, _, err := fm.AddQuestion(ctx, formsmodels.QuestionDraft{Question: formsmodels.Question{FormID: form.ID, Prompt: "Ward", AnswerType: formsmodels.AnswerFreeText}})
	if err != nil {
		t.Fatal(err)
	}
	if _, _, err := fm.Publish(ctx, form.ID, "", "author-1", ""); err != nil {
		t.Fatal(err)
	}
	for _, answer := range []string{"North", "South"} {
		if _, err := fm.SubmitAnswers(ctx, form.ID, "mem-1", []formsmodels.Answer{{QuestionID: ward.ID, ValueText: answer}}); err != nil {
			t.Fatal(err)
		}
	}
	records, err := cm.ListRecords(ctx, "person", "")
	if err != nil {
		t.Fatal(err)
	}
	if len(records) != 1 || records[0].Doc != `{"ward":"South"}` {
		t.Fatalf("records = %+v, want one holding ward South", records)
	}
}

func TestATestCopyKnowsTheCatalogTablesOfEachMount(t *testing.T) {
	specs, err := TestCopy{slug: "landing"}.Specs([]TouchedModule{{Code: moduleCatalog, Mounts: []string{"reports", MountFormRecords}}})
	if err != nil {
		t.Fatal(err)
	}
	if len(specs) != 2 {
		t.Fatalf("specs = %d, want one per mount", len(specs))
	}
}
