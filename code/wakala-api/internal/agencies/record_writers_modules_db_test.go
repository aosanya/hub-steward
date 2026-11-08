package agencies

import (
	"context"
	"fmt"
	"strings"
	"testing"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	mwanachamaaccounting "wakalaserver/modules/accounting"
	formsmodels "wakalaserver/modules/forms/models"
)

func TestARegistryFormLandsAPaymentInTheLedgerAndARatingInRatingsInPostgres(t *testing.T) {
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
	inst, err := reg.CreateInstance(ctx, "Landing ledger ward")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		ratingsManagers.Delete(ratingsKey{db: db, id: inst.ID})
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
	ledger, err := reg.LedgerRepository(ctx, inst.ID)
	if err != nil {
		t.Fatal(err)
	}
	open := func(category string, kind mwanachamaaccounting.AccountType) mwanachamaaccounting.Account {
		a, err := ledger.OpenAccount(ctx, mwanachamaaccounting.Account{Category: mwanachamaaccounting.AccountCategory(category), HolderID: "ward-3", Type: kind})
		if err != nil {
			t.Fatal(err)
		}
		return a
	}
	fees, income := open("market_fees", mwanachamaaccounting.AccountTypeAsset), open("stall_income", mwanachamaaccounting.AccountTypeIncome)

	compose := func(record string, fieldMap map[string]string, prompts map[string]formsmodels.AnswerType) (formsmodels.Form, map[string]formsmodels.Question) {
		form, err := fm.Create(ctx, formsmodels.Form{
			Title: "Synthetic " + record, ClosesAt: "2099-01-01T00:00:00Z", OriginatorChapterID: "g-1",
			CreatedBy: "author-1", Audience: formsmodels.AudienceMember, CollectionMode: formsmodels.CollectionSelf,
			LandsIn: formsmodels.LandsIn{Record: record, KeyedBy: []string{"member"}, FieldMap: fieldMap},
		})
		if err != nil {
			t.Fatal(err)
		}
		questions := map[string]formsmodels.Question{}
		for prompt, kind := range prompts {
			q, _, err := fm.AddQuestion(ctx, formsmodels.QuestionDraft{Question: formsmodels.Question{FormID: form.ID, Prompt: prompt, AnswerType: kind}})
			if err != nil {
				t.Fatal(err)
			}
			questions[prompt] = q
		}
		if _, _, err := fm.Publish(ctx, form.ID, "", "author-1", ""); err != nil {
			t.Fatalf("Publish %s = %v", record, err)
		}
		return form, questions
	}

	pay, payQ := compose("accounting.entry",
		map[string]string{"Paid into": "debit_account_id", "Income account": "credit_account_id", "Amount": "amount"},
		map[string]formsmodels.AnswerType{"Paid into": formsmodels.AnswerFreeText, "Income account": formsmodels.AnswerFreeText, "Amount": formsmodels.AnswerNumber})
	amount := 4500.0
	answers := []formsmodels.Answer{
		{QuestionID: payQ["Paid into"].ID, ValueText: fees.ID},
		{QuestionID: payQ["Income account"].ID, ValueText: income.ID},
		{QuestionID: payQ["Amount"].ID, ValueNumber: &amount},
	}
	for i := 0; i < 2; i++ {
		if _, err := fm.SubmitAnswers(ctx, pay.ID, "mem-1", answers); err != nil {
			t.Fatalf("SubmitAnswers payment = %v", err)
		}
	}
	entries, err := ledger.ListEntries(ctx, fees.ID, 0)
	if err != nil || len(entries) != 1 || entries[0].Amount != 4500 || entries[0].ActorID != "mem-1" {
		t.Fatalf("entries = %+v (%v), want one payment of 4500 by mem-1 though the form was sent twice", entries, err)
	}

	rate, rateQ := compose("ratings.rating",
		map[string]string{"Stall": "item", "How was it": "value"},
		map[string]formsmodels.AnswerType{"Stall": formsmodels.AnswerFreeText, "How was it": formsmodels.AnswerNumber})
	score := 0.8
	if _, err := fm.SubmitAnswers(ctx, rate.ID, "mem-1", []formsmodels.Answer{
		{QuestionID: rateQ["Stall"].ID, ValueText: "stall-12"},
		{QuestionID: rateQ["How was it"].ID, ValueNumber: &score},
	}); err != nil {
		t.Fatalf("SubmitAnswers rating = %v", err)
	}
	rm, err := reg.(*registry).ratingsManagerFor(ctx, inst.ID)
	if err != nil {
		t.Fatal(err)
	}
	got, err := rm.GetRating(ctx, "mem-1", "stall-12")
	if err != nil || got.Value != 0.8 {
		t.Fatalf("rating = %+v (%v), want 0.8 from mem-1", got, err)
	}
}
