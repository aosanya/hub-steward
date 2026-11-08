package agencies

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"testing"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	mwanachamaforms "wakalaserver/modules/forms"
	formsmodels "wakalaserver/modules/forms/models"
)

func TestARegistryFormLandsItsAnswersInTheCatalogInPostgres(t *testing.T) {
	dsn := localDatabaseOrSkip(t)
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	reg, err := NewRegistry(db, WithModuleMounted(func(context.Context, string, string) (bool, error) { return true, nil }))
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	inst, err := reg.CreateInstance(ctx, "Landing ward")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		var names []string
		db.Raw("select tablename from pg_tables where schemaname = current_schema() and tablename like ?", inst.TableSlug+"%").Scan(&names)
		for _, name := range names {
			db.Exec(fmt.Sprintf("drop table if exists %q cascade", strings.ReplaceAll(name, `"`, "")))
		}
		db.Exec("delete from agency_instances where id = ?", inst.ID)
	})
	fm, err := reg.FormManager(ctx, inst.ID)
	if err != nil {
		t.Fatal(err)
	}
	compose := func(record string) (formsmodels.Form, formsmodels.Question) {
		form, err := fm.Create(ctx, formsmodels.Form{
			Title: "Synthetic registration", ClosesAt: "2099-01-01T00:00:00Z", OriginatorChapterID: "g-1",
			CreatedBy: "author-1", Audience: formsmodels.AudienceMember, CollectionMode: formsmodels.CollectionSelf,
			LandsIn: formsmodels.LandsIn{Record: record, KeyedBy: []string{"member"}, FieldMap: map[string]string{"Ward": "ward"}},
		})
		if err != nil {
			t.Fatal(err)
		}
		ward, _, err := fm.AddQuestion(ctx, formsmodels.QuestionDraft{Question: formsmodels.Question{FormID: form.ID, Prompt: "Ward", AnswerType: formsmodels.AnswerFreeText}})
		if err != nil {
			t.Fatal(err)
		}
		return form, ward
	}

	form, ward := compose("catalog.person")
	if _, _, err := fm.Publish(ctx, form.ID, "", "author-1", ""); err != nil {
		t.Fatalf("Publish = %v", err)
	}
	for _, answer := range []string{"North", "South"} {
		if _, err := fm.SubmitAnswers(ctx, form.ID, "mem-1", []formsmodels.Answer{{QuestionID: ward.ID, ValueText: answer}}); err != nil {
			t.Fatalf("SubmitAnswers = %v", err)
		}
	}
	cm, err := reg.CatalogManager(ctx, inst.ID, MountFormRecords)
	if err != nil {
		t.Fatal(err)
	}
	records, err := cm.ListRecords(ctx, "person", "")
	if err != nil {
		t.Fatal(err)
	}
	if len(records) != 1 {
		t.Fatalf("records = %+v, want one", records)
	}
	var doc map[string]any
	if err := json.Unmarshal([]byte(records[0].Doc), &doc); err != nil || doc["ward"] != "South" {
		t.Fatalf("doc = %q (%v), want ward South", records[0].Doc, err)
	}

	other, _ := compose("accounting.invoice")
	if _, _, err := fm.Publish(ctx, other.ID, "", "author-1", ""); !errors.Is(err, mwanachamaforms.ErrNoRecordWriter) {
		t.Fatalf("Publish for a module with no writer = %v, want ErrNoRecordWriter", err)
	}
}
