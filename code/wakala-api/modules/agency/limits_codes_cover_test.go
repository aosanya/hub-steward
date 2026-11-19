package mwanachamaagency

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"wakalaserver/modules/agency/models"
)

func newCoverManager(t *testing.T) (*agencyManager, *gorm.DB) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(1)
	s, err := SpecFor("covertest")
	if err != nil {
		t.Fatal(err)
	}
	if err := Provision(db, s); err != nil {
		t.Fatal(err)
	}
	mgr, err := NewAgencyManager(db, s)
	if err != nil {
		t.Fatal(err)
	}
	return mgr.(*agencyManager), db
}

func newCounterTable(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(1)
	if err := db.Exec("CREATE TABLE counters (entity_type TEXT PRIMARY KEY, next_number INTEGER NOT NULL)").Error; err != nil {
		t.Fatal(err)
	}
	return db
}

func counterOf(t *testing.T, db *gorm.DB, entityType string) int {
	t.Helper()
	var n int
	if err := db.Raw("SELECT next_number FROM counters WHERE entity_type = ?", entityType).Scan(&n).Error; err != nil {
		t.Fatal(err)
	}
	return n
}

func TestQuoteIfUnsafe_LeavesPrintableTextAlone(t *testing.T) {
	for _, in := range []string{"", "plain", "with spaces and punctuation, ok!", "unicode ünï café 日本"} {
		if got := QuoteIfUnsafe(in); got != in {
			t.Errorf("QuoteIfUnsafe(%q) = %q, want it unchanged", in, got)
		}
	}
}

func TestQuoteIfUnsafe_QuotesTextWithControlCharacters(t *testing.T) {
	cases := map[string]string{
		"line one\nline two": `"line one\nline two"`,
		"tab\there":          `"tab\there"`,
		"bell\a":             `"bell\a"`,
		"nul\x00byte":        `"nul\x00byte"`,
	}
	for in, want := range cases {
		if got := QuoteIfUnsafe(in); got != want {
			t.Errorf("QuoteIfUnsafe(%q) = %s, want %s", in, got, want)
		}
	}
}

func TestIsApprovalStampPrompt_OnlyTheTwoStampPromptsExactly(t *testing.T) {
	for _, p := range []string{ApprovedByPrompt, ApprovedAtPrompt} {
		if !isApprovalStampPrompt(p) {
			t.Errorf("%q should be an approval stamp prompt", p)
		}
	}
	for _, p := range []string{"", "approved by", "Approved by ", "Approved", "Approved on"} {
		if isApprovalStampPrompt(p) {
			t.Errorf("%q should not be an approval stamp prompt", p)
		}
	}
}

func TestCheckDesignSpecSize_AllowsUpToTheCapAndRefusesOneOver(t *testing.T) {
	for _, n := range []int{0, 1, MaxDesignSpecEntities} {
		if err := CheckDesignSpecSize(n); err != nil {
			t.Errorf("CheckDesignSpecSize(%d) = %v, want nil", n, err)
		}
	}
	err := CheckDesignSpecSize(MaxDesignSpecEntities + 1)
	if !errors.Is(err, ErrLimitExceeded) {
		t.Fatalf("one over the cap: err = %v, want ErrLimitExceeded", err)
	}
	for _, part := range []string{"1000", "1001", "several calls"} {
		if !strings.Contains(err.Error(), part) {
			t.Errorf("refusal %q should mention %q", err.Error(), part)
		}
	}
}

func TestNumberIn_ReadsTheNumberOnlyForThePrefixAndAWholeNumber(t *testing.T) {
	cases := []struct {
		code, prefix string
		want         int
	}{
		{"G-7", "G", 7},
		{"WI-120", "WI", 120},
		{"G-7", "WI", 0},
		{"WI-7", "W", 0},
		{"G-", "G", 0},
		{"G-x", "G", 0},
		{"G-7a", "G", 0},
		{"G7", "G", 0},
		{"", "G", 0},
	}
	for _, c := range cases {
		if got := numberIn(c.code, c.prefix); got != c.want {
			t.Errorf("numberIn(%q, %q) = %d, want %d", c.code, c.prefix, got, c.want)
		}
	}
}

func TestAsInt_ReadsNumbersAndRefusesTheRest(t *testing.T) {
	for in, want := range map[any]int{int64(4): 4, 5: 5, float64(6): 6} {
		got, err := asInt(in)
		if err != nil || got != want {
			t.Errorf("asInt(%v) = %d, %v; want %d", in, got, err, want)
		}
	}
	for _, in := range []any{"7", nil, true} {
		if _, err := asInt(in); err == nil {
			t.Errorf("asInt(%v) should be refused", in)
		}
	}
}

func TestNextCode_CountsUpFromOnePerEntityType(t *testing.T) {
	db := newCounterTable(t)
	ctx := context.Background()
	want := []string{"G-1", "G-2", "G-3"}
	for _, w := range want {
		got, err := nextCode(ctx, db, "counters", "goal", "G")
		if err != nil || got != w {
			t.Fatalf("nextCode goal = %q, %v; want %q", got, err, w)
		}
	}
	got, err := nextCode(ctx, db, "counters", "role", "R")
	if err != nil || got != "R-1" {
		t.Fatalf("a different entity type starts its own count: %q, %v", got, err)
	}
	if n := counterOf(t, db, "goal"); n != 4 {
		t.Errorf("goal counter = %d, want 4", n)
	}
}

func TestNextCode_RefusesACounterItCannotRead(t *testing.T) {
	db := newCounterTable(t)
	if err := db.Exec("INSERT INTO counters (entity_type, next_number) VALUES ('goal', 'many')").Error; err != nil {
		t.Fatal(err)
	}
	if _, err := nextCode(context.Background(), db, "counters", "goal", "G"); err == nil {
		t.Fatal("a counter holding text should be refused")
	}
}

func TestNextCode_ReportsAMissingTable(t *testing.T) {
	db := newCounterTable(t)
	if _, err := nextCode(context.Background(), db, "no_such_table", "goal", "G"); err == nil {
		t.Fatal("a missing counter table should be an error")
	}
}

func TestRaiseSequence_OnlyEverMovesTheCounterUp(t *testing.T) {
	db := newCounterTable(t)
	ctx := context.Background()
	if err := raiseSequence(ctx, db, "counters", "goal", 10); err != nil {
		t.Fatal(err)
	}
	if n := counterOf(t, db, "goal"); n != 10 {
		t.Fatalf("a new entity type is seeded at 10, got %d", n)
	}
	if err := raiseSequence(ctx, db, "counters", "goal", 4); err != nil {
		t.Fatal(err)
	}
	if n := counterOf(t, db, "goal"); n != 10 {
		t.Fatalf("a lower request leaves the counter at 10, got %d", n)
	}
	if err := raiseSequence(ctx, db, "counters", "goal", 25); err != nil {
		t.Fatal(err)
	}
	if n := counterOf(t, db, "goal"); n != 25 {
		t.Fatalf("a higher request raises the counter to 25, got %d", n)
	}
}

func TestClaimCode_NoContextClaimsTheNextNumber(t *testing.T) {
	db := newCounterTable(t)
	got, err := claimCode(context.Background(), db, "counters", "goal", "G")
	if err != nil || got != "G-1" {
		t.Fatalf("claimCode = %q, %v; want G-1", got, err)
	}
}

func TestClaimCode_AKeptCodeIsReturnedAndTheCounterMovesPastIt(t *testing.T) {
	db := newCounterTable(t)
	ctx := WithKeptCode(context.Background(), "G-12")
	got, err := claimCode(ctx, db, "counters", "goal", "G")
	if err != nil || got != "G-12" {
		t.Fatalf("claimCode = %q, %v; want the kept code G-12", got, err)
	}
	next, err := claimCode(context.Background(), db, "counters", "goal", "G")
	if err != nil || next != "G-13" {
		t.Fatalf("the next claimed code = %q, %v; want G-13", next, err)
	}
}

func TestClaimCode_AKeptCodeOfAnotherPrefixLeavesTheCounterAlone(t *testing.T) {
	db := newCounterTable(t)
	ctx := WithKeptCode(context.Background(), "custom-code")
	got, err := claimCode(ctx, db, "counters", "goal", "G")
	if err != nil || got != "custom-code" {
		t.Fatalf("claimCode = %q, %v; want custom-code", got, err)
	}
	next, err := claimCode(context.Background(), db, "counters", "goal", "G")
	if err != nil || next != "G-1" {
		t.Fatalf("a foreign kept code must not move the counter: next = %q, %v", next, err)
	}
}

func TestClaimCode_SkipsEveryReservedCode(t *testing.T) {
	db := newCounterTable(t)
	ctx := WithReservedCodes(context.Background(), map[string]bool{"G-1": true, "G-2": true, "G-4": true})
	var got []string
	for i := 0; i < 2; i++ {
		code, err := claimCode(ctx, db, "counters", "goal", "G")
		if err != nil {
			t.Fatal(err)
		}
		got = append(got, code)
	}
	if got[0] != "G-3" || got[1] != "G-5" {
		t.Fatalf("claimed %v, want [G-3 G-5] with G-1, G-2 and G-4 reserved", got)
	}
}

func TestCreateAgency_ASecondAgencyIsRefused(t *testing.T) {
	m, _ := newCoverManager(t)
	ctx := context.Background()
	first, err := m.CreateAgency(ctx, models.Agency{Name: "First"})
	if err != nil {
		t.Fatal(err)
	}
	if first.ID == "" || first.CreatedAt == "" {
		t.Fatalf("the manager mints id and created_at: %+v", first)
	}
	if _, err := m.CreateAgency(ctx, models.Agency{Name: "Second"}); !errors.Is(err, ErrAgencyExists) {
		t.Fatalf("second agency: err = %v, want ErrAgencyExists", err)
	}
	got, err := m.GetAgency(ctx)
	if err != nil || got.Name != "First" {
		t.Fatalf("GetAgency = %+v, %v; want the first agency", got, err)
	}
}

func TestCreateAgency_CallerSuppliedIDAndClockAreIgnored(t *testing.T) {
	m, _ := newCoverManager(t)
	out, err := m.CreateAgency(context.Background(), models.Agency{
		ID: "chosen", Name: "A", CreatedAt: "1999-01-01T00:00:00Z", Deleted: true,
	})
	if err != nil {
		t.Fatal(err)
	}
	if out.ID == "chosen" || out.CreatedAt == "1999-01-01T00:00:00Z" || out.Deleted {
		t.Fatalf("server-owned fields were honoured: %+v", out)
	}
}

func TestGetAgency_BeforeOneIsCreatedIsNotFound(t *testing.T) {
	m, _ := newCoverManager(t)
	if _, err := m.GetAgency(context.Background()); !errors.Is(err, ErrAgencyNotFound) {
		t.Fatalf("err = %v, want ErrAgencyNotFound", err)
	}
}

func TestCreateDraft_NeedsAnAgencyFirst(t *testing.T) {
	m, _ := newCoverManager(t)
	if _, err := m.CreateDraft(context.Background(), "d", "", ""); !errors.Is(err, ErrAgencyNotFound) {
		t.Fatalf("err = %v, want ErrAgencyNotFound", err)
	}
}

func TestCreateDraft_ForkSourceNeedsATypeAndAKnownSource(t *testing.T) {
	m, _ := newCoverManager(t)
	ctx := context.Background()
	if _, err := m.CreateAgency(ctx, models.Agency{Name: "A"}); err != nil {
		t.Fatal(err)
	}
	if _, err := m.CreateDraft(ctx, "d", "some-id", ""); !errors.Is(err, ErrInvalidForkSource) {
		t.Errorf("an id with no source type: err = %v, want ErrInvalidForkSource", err)
	}
	if _, err := m.CreateDraft(ctx, "d", "missing", "draft"); !errors.Is(err, ErrDraftNotFound) {
		t.Errorf("an unknown source draft: err = %v, want ErrDraftNotFound", err)
	}
	if _, err := m.CreateDraft(ctx, "d", "v9", "publication"); !errors.Is(err, ErrPublicationNotFound) {
		t.Errorf("an unknown source tag: err = %v, want ErrPublicationNotFound", err)
	}
}

func TestCreateDraft_RefusesTheDraftPastTheAgencyCap(t *testing.T) {
	m, _ := newCoverManager(t)
	ctx := context.Background()
	if _, err := m.CreateAgency(ctx, models.Agency{Name: "A"}); err != nil {
		t.Fatal(err)
	}
	var held int64
	if err := m.db.Table(m.table(roleDraft)).Count(&held).Error; err != nil {
		t.Fatal(err)
	}
	for i := int(held); i < MaxDraftsPerAgency; i++ {
		if _, err := m.CreateDraft(ctx, "d", "", ""); err != nil {
			t.Fatalf("draft %d within the cap was refused: %v", i+1, err)
		}
	}
	_, err := m.CreateDraft(ctx, "one too many", "", "")
	if !errors.Is(err, ErrLimitExceeded) {
		t.Fatalf("draft past the cap: err = %v, want ErrLimitExceeded", err)
	}
	if !strings.Contains(err.Error(), "40 drafts") {
		t.Errorf("refusal %q should name the cap of 40 drafts", err.Error())
	}
}
