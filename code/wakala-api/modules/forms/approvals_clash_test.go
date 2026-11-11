package mwanachamaforms_test

import (
	"context"
	"fmt"
	"strings"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"wakalaserver/internal/approvals"
	forms "wakalaserver/modules/forms"
	"wakalaserver/modules/shared/spec"
)

const clashSlug = "agency1"

func clashDB(t *testing.T) (*gorm.DB, *spec.Spec) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatalf("gorm.Open: %v", err)
	}
	s, err := forms.SpecFor(clashSlug)
	if err != nil {
		t.Fatalf("SpecFor: %v", err)
	}
	return db, s
}

func proposeApprovals(t *testing.T, db *gorm.DB, summaries ...string) []approvals.Approval {
	t.Helper()
	store, err := approvals.Open(db, clashSlug)
	if err != nil {
		t.Fatalf("approvals.Open: %v", err)
	}
	var made []approvals.Approval
	for _, summary := range summaries {
		a, err := store.Propose(context.Background(), "owner-1", "instance_rename", summary, `{"name":"Z"}`)
		if err != nil {
			t.Fatalf("Propose %q: %v", summary, err)
		}
		made = append(made, a)
	}
	return made
}

func listedSummaries(t *testing.T, db *gorm.DB) []string {
	t.Helper()
	store, err := approvals.Open(db, clashSlug)
	if err != nil {
		t.Fatalf("approvals.Open: %v", err)
	}
	listed, err := store.List(context.Background(), "")
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	out := make([]string, 0, len(listed))
	for _, a := range listed {
		out = append(out, a.Summary)
	}
	return out
}

func mustProvision(t *testing.T, db *gorm.DB, s *spec.Spec) {
	t.Helper()
	if err := forms.Provision(db, s); err != nil {
		t.Fatalf("Provision: %v", err)
	}
}

func formsApprovalTable(s *spec.Spec) string {
	o, _ := s.ByRole("approval")
	return s.TableFor(o)
}

func rowsIn(t *testing.T, db *gorm.DB, table string) int64 {
	t.Helper()
	var n int64
	if err := db.Table(table).Count(&n).Error; err != nil {
		t.Fatalf("count %s: %v", table, err)
	}
	return n
}

func sameSummaries(got, want []string) bool {
	if len(got) != len(want) {
		return false
	}
	seen := map[string]int{}
	for _, g := range got {
		seen[g]++
	}
	for _, w := range want {
		seen[w]--
	}
	for _, n := range seen {
		if n != 0 {
			return false
		}
	}
	return true
}

func TestFormsUsedThenAnApprovalProposedThenARestartStillProvisions(t *testing.T) {
	db, s := clashDB(t)
	mustProvision(t, db, s)
	proposeApprovals(t, db, "rename")

	if err := forms.Provision(db, s); err != nil {
		t.Fatalf("Provision after an approval was proposed: %v", err)
	}
	if got := listedSummaries(t, db); !sameSummaries(got, []string{"rename"}) {
		t.Fatalf("approvals after the restart = %v, want [rename]", got)
	}
}

func TestAnApprovalProposedBeforeTheFirstFormsCallIsLeftWhereItIs(t *testing.T) {
	db, s := clashDB(t)
	proposeApprovals(t, db, "rename", "second")

	mustProvision(t, db, s)

	if got := listedSummaries(t, db); !sameSummaries(got, []string{"rename", "second"}) {
		t.Fatalf("approvals after forms were provisioned = %v, want [rename second]", got)
	}
	if n := rowsIn(t, db, formsApprovalTable(s)); n != 0 {
		t.Fatalf("the forms approvals table holds %d row(s) of the agency store", n)
	}
}

func swallowedByForms(t *testing.T, db *gorm.DB, s *spec.Spec, summaries ...string) {
	t.Helper()
	mustProvision(t, db, s)
	proposeApprovals(t, db, summaries...)
	agency, swallowed := approvals.TableFor(clashSlug), formsApprovalTable(s)
	types, err := db.Migrator().ColumnTypes(agency)
	if err != nil {
		t.Fatalf("ColumnTypes: %v", err)
	}
	var names []string
	for _, c := range types {
		names = append(names, c.Name())
		if db.Migrator().HasColumn(swallowed, c.Name()) {
			continue
		}
		if err := db.Exec(fmt.Sprintf("alter table %s add column %s text", swallowed, c.Name())).Error; err != nil {
			t.Fatalf("add column %s: %v", c.Name(), err)
		}
	}
	list := strings.Join(names, ", ")
	if err := db.Exec(fmt.Sprintf("insert into %s (%s, form_id) select %s, '' from %s", swallowed, list, list, agency)).Error; err != nil {
		t.Fatalf("copy: %v", err)
	}
	if err := db.Exec("drop table " + agency).Error; err != nil {
		t.Fatalf("drop table: %v", err)
	}
}

func TestApprovalsAlreadySwallowedByFormsAreGivenBack(t *testing.T) {
	db, s := clashDB(t)
	swallowedByForms(t, db, s, "rename", "second")

	if err := forms.Provision(db, s); err != nil {
		t.Fatalf("Provision on a swallowed store: %v", err)
	}

	if got := listedSummaries(t, db); !sameSummaries(got, []string{"rename", "second"}) {
		t.Fatalf("approvals after the repair = %v, want [rename second]", got)
	}
	if n := rowsIn(t, db, formsApprovalTable(s)); n != 0 {
		t.Fatalf("the forms approvals table still holds %d row(s) of the agency store", n)
	}
}

func TestTheRepairKeepsApprovalsProposedAfterTheDamageAndFormsRoundsAlike(t *testing.T) {
	db, s := clashDB(t)
	swallowedByForms(t, db, s, "old one")
	proposeApprovals(t, db, "new one")
	formsRound := fmt.Sprintf("insert into %s (id, form_id, requested_by, requested_at, decided_at) values ('r-1', 'f-1', 'm-1', '2026-01-01T00:00:00Z', '')", formsApprovalTable(s))
	if err := db.Exec(formsRound).Error; err != nil {
		t.Fatalf("insert forms round: %v", err)
	}

	mustProvision(t, db, s)
	mustProvision(t, db, s)

	if got := listedSummaries(t, db); !sameSummaries(got, []string{"old one", "new one"}) {
		t.Fatalf("approvals after the repair = %v, want [old one new one]", got)
	}
	if n := rowsIn(t, db, formsApprovalTable(s)); n != 1 {
		t.Fatalf("the forms approvals table holds %d row(s), want its one forms round", n)
	}
}

func TestTheRepairNeverOverwritesAnApprovalThatAlreadyHasThatId(t *testing.T) {
	db, s := clashDB(t)
	swallowedByForms(t, db, s, "kept in forms table")
	var swallowed approvals.Approval
	if err := db.Table(formsApprovalTable(s)).Where("kind <> ''").Take(&swallowed).Error; err != nil {
		t.Fatalf("read swallowed row: %v", err)
	}
	store, err := approvals.Open(db, clashSlug)
	if err != nil {
		t.Fatalf("approvals.Open: %v", err)
	}
	twin := swallowed
	twin.Summary = "already given back"
	if err := db.Table(approvals.TableFor(clashSlug)).Create(&twin).Error; err != nil {
		t.Fatalf("create twin: %v", err)
	}

	mustProvision(t, db, s)

	got, err := store.Get(context.Background(), swallowed.ID)
	if err != nil {
		t.Fatalf("Get: %v", err)
	}
	if got.Summary != "already given back" {
		t.Fatalf("the repair overwrote the store's row: summary = %q", got.Summary)
	}
	if n := rowsIn(t, db, formsApprovalTable(s)); n != 1 {
		t.Fatalf("the forms approvals table holds %d row(s), want the differing copy kept", n)
	}
}

func TestALegacyFormsApprovalsTableOfThatNameIsStillRenamedIntoForms(t *testing.T) {
	db, s := clashDB(t)
	create := fmt.Sprintf("create table %s (id text primary key, form_id text not null, requested_by text, requested_at text, decided_by text, decided_at text, decision text, note text, slot text)", approvals.TableFor(clashSlug))
	insert := fmt.Sprintf("insert into %s (id, form_id, requested_by, requested_at, decided_at) values ('r-1', 'f-1', 'm-1', '2026-01-01T00:00:00Z', '')", approvals.TableFor(clashSlug))
	for _, stmt := range []string{create, insert} {
		if err := db.Exec(stmt).Error; err != nil {
			t.Fatalf("legacy table: %v", err)
		}
	}

	mustProvision(t, db, s)

	if n := rowsIn(t, db, formsApprovalTable(s)); n != 1 {
		t.Fatalf("the forms approvals table holds %d row(s), want the legacy round", n)
	}
	if db.Migrator().HasTable(approvals.TableFor(clashSlug)) {
		t.Fatalf("the legacy forms table was left behind")
	}
}
