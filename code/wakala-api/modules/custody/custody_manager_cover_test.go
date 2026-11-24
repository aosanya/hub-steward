package custody_test

import (
	"context"
	"errors"
	"testing"
	"time"

	custody "wakalaserver/modules/custody"
	"wakalaserver/modules/custody/models"
)

type fixedSubtree map[string][]string

func (f fixedSubtree) Subtree(_ context.Context, id string) ([]string, error) {
	return f[id], nil
}

func newCoverManager(t *testing.T, resolver custody.ScopeResolver) *custody.CustodyManager {
	t.Helper()
	db, sp := newTestDB(t)
	m, err := custody.NewCustodyManager(db, sp, monotonicClock(time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC)), resolver)
	if err != nil {
		t.Fatalf("NewCustodyManager: %v", err)
	}
	return m
}

func appendAct(t *testing.T, m *custody.CustodyManager, structure string, kind models.ActKind) {
	t.Helper()
	_, err := m.Custody().AppendAct(context.Background(), models.StructureActLogEntry{
		StructureID: structure, Kind: kind, ActorLabel: "lead", SubjectRef: "subject",
	})
	if err != nil {
		t.Fatalf("AppendAct %s/%s: %v", structure, kind, err)
	}
}

func appendEvent(t *testing.T, m *custody.CustodyManager, kind models.EventKind) {
	t.Helper()
	_, err := m.Custody().AppendEvent(context.Background(), models.Entry{Kind: kind, ActorLabel: "ops", Detail: "d"})
	if err != nil {
		t.Fatalf("AppendEvent %s: %v", kind, err)
	}
}

func TestListStructureActsRefusesBadInput(t *testing.T) {
	m := newCoverManager(t, nil)
	ctx := context.Background()
	cases := []struct {
		name                         string
		structure, scope, class, lim string
		want                         error
	}{
		{"empty structure", "", "", "", "", custody.ErrStructureIDRequired},
		{"unknown scope", "w1", "galaxy", "", "", custody.ErrUnknownScope},
		{"unknown class", "w1", "", "no_such_class", "", custody.ErrUnknownActClass},
		{"zero limit", "w1", "", "", "0", custody.ErrInvalidLimit},
		{"negative limit", "w1", "", "", "-3", custody.ErrInvalidLimit},
		{"non numeric limit", "w1", "", "", "many", custody.ErrInvalidLimit},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			_, err := m.ListStructureActs(ctx, c.structure, c.scope, c.class, c.lim)
			if !errors.Is(err, c.want) {
				t.Fatalf("got %v, want %v", err, c.want)
			}
		})
	}
}

func TestListStructureActsStructureScopeIgnoresSubtree(t *testing.T) {
	m := newCoverManager(t, fixedSubtree{"parent": {"parent", "child"}})
	appendAct(t, m, "parent", models.ActRoleGranted)
	appendAct(t, m, "child", models.ActRoleRevoked)
	rows, err := m.ListStructureActs(context.Background(), "parent", "structure", "", "")
	if err != nil {
		t.Fatalf("ListStructureActs: %v", err)
	}
	if len(rows) != 1 || rows[0]["structure_id"] != "parent" {
		t.Fatalf("structure scope returned %v, want only the parent's act", rows)
	}
}

func TestListStructureActsSubtreeScopeReachesDescendants(t *testing.T) {
	m := newCoverManager(t, fixedSubtree{"parent": {"parent", "child"}})
	appendAct(t, m, "parent", models.ActRoleGranted)
	appendAct(t, m, "child", models.ActRoleRevoked)
	appendAct(t, m, "elsewhere", models.ActRoleGranted)
	rows, err := m.ListStructureActs(context.Background(), "parent", "subtree", "", "")
	if err != nil {
		t.Fatalf("ListStructureActs: %v", err)
	}
	if len(rows) != 2 {
		t.Fatalf("subtree scope returned %d rows, want 2: %v", len(rows), rows)
	}
	for _, r := range rows {
		if r["structure_id"] == "elsewhere" {
			t.Fatalf("subtree scope leaked a row outside the subtree: %v", r)
		}
	}
}

func TestListStructureActsSubtreeWithoutResolverFallsBackToTheStructure(t *testing.T) {
	m := newCoverManager(t, nil)
	appendAct(t, m, "parent", models.ActRoleGranted)
	appendAct(t, m, "child", models.ActRoleGranted)
	rows, err := m.ListStructureActs(context.Background(), "parent", "subtree", "", "")
	if err != nil {
		t.Fatalf("ListStructureActs: %v", err)
	}
	if len(rows) != 1 || rows[0]["structure_id"] != "parent" {
		t.Fatalf("got %v, want only the parent's act", rows)
	}
}

func TestListStructureActsLimitCapsTheRows(t *testing.T) {
	m := newCoverManager(t, nil)
	for i := 0; i < 3; i++ {
		appendAct(t, m, "w1", models.ActRoleGranted)
	}
	rows, err := m.ListStructureActs(context.Background(), "w1", "", "", "2")
	if err != nil {
		t.Fatalf("ListStructureActs: %v", err)
	}
	if len(rows) != 2 {
		t.Fatalf("limit 2 returned %d rows", len(rows))
	}
}

func TestListStructureActsRowCarriesKindAndClass(t *testing.T) {
	m := newCoverManager(t, nil)
	appendAct(t, m, "w1", models.ActRoleGranted)
	rows, err := m.ListStructureActs(context.Background(), "w1", "", "", "")
	if err != nil || len(rows) != 1 {
		t.Fatalf("ListStructureActs: %v rows=%v", err, rows)
	}
	wantClass, _ := models.ActClassOf(models.ActRoleGranted)
	if rows[0]["act_kind"] != string(models.ActRoleGranted) || rows[0]["act_class"] != string(wantClass) {
		t.Fatalf("row kind/class = %v/%v", rows[0]["act_kind"], rows[0]["act_class"])
	}
}

func TestListStructureActsFiltersByClass(t *testing.T) {
	m := newCoverManager(t, nil)
	appendAct(t, m, "w1", models.ActRoleGranted)
	appendAct(t, m, "w1", models.ActPostWithheld)
	grantClass, _ := models.ActClassOf(models.ActRoleGranted)
	rows, err := m.ListStructureActs(context.Background(), "w1", "", string(grantClass), "")
	if err != nil {
		t.Fatalf("ListStructureActs: %v", err)
	}
	for _, r := range rows {
		if r["act_class"] != string(grantClass) {
			t.Fatalf("class filter returned %v", r)
		}
	}
	if len(rows) == 0 {
		t.Fatal("class filter returned nothing")
	}
}

func TestCountStructureActsTotalsEveryClassIncludingEmpty(t *testing.T) {
	m := newCoverManager(t, nil)
	appendAct(t, m, "w1", models.ActRoleGranted)
	appendAct(t, m, "w1", models.ActRoleRevoked)
	appendAct(t, m, "other", models.ActRoleGranted)
	total, byClass, err := m.CountStructureActs(context.Background(), "w1", "", "")
	if err != nil {
		t.Fatalf("CountStructureActs: %v", err)
	}
	if total != 2 {
		t.Fatalf("total = %d, want 2", total)
	}
	sum := 0
	for _, n := range byClass {
		sum += n
	}
	if sum != total {
		t.Fatalf("byClass sums to %d, total %d", sum, total)
	}
	if len(byClass) < 2 {
		t.Fatalf("byClass should list every declared class, got %v", byClass)
	}
}

func TestCountStructureActsRefusesBadInput(t *testing.T) {
	m := newCoverManager(t, nil)
	ctx := context.Background()
	if _, _, err := m.CountStructureActs(ctx, "", "", ""); !errors.Is(err, custody.ErrStructureIDRequired) {
		t.Fatalf("empty structure: %v", err)
	}
	if _, _, err := m.CountStructureActs(ctx, "w1", "galaxy", ""); !errors.Is(err, custody.ErrUnknownScope) {
		t.Fatalf("bad scope: %v", err)
	}
	if _, _, err := m.CountStructureActs(ctx, "w1", "", "yesterday"); !errors.Is(err, custody.ErrInvalidSince) {
		t.Fatalf("bad since: %v", err)
	}
}

func TestCountStructureActsSinceExcludesEarlierActs(t *testing.T) {
	m := newCoverManager(t, nil)
	appendAct(t, m, "w1", models.ActRoleGranted)
	total, _, err := m.CountStructureActs(context.Background(), "w1", "", "2999-01-01T00:00:00Z")
	if err != nil {
		t.Fatalf("CountStructureActs: %v", err)
	}
	if total != 0 {
		t.Fatalf("since in the future counted %d acts", total)
	}
}

func TestListCustodyEventsRefusesBadInput(t *testing.T) {
	m := newCoverManager(t, nil)
	ctx := context.Background()
	if _, err := m.ListCustodyEvents(ctx, "no_such_chip", ""); !errors.Is(err, custody.ErrUnknownEventChip) {
		t.Fatalf("unknown chip: %v", err)
	}
	if _, err := m.ListCustodyEvents(ctx, "", "0"); !errors.Is(err, custody.ErrInvalidLimit) {
		t.Fatalf("zero limit: %v", err)
	}
}

func TestListCustodyEventsFiltersByChip(t *testing.T) {
	m := newCoverManager(t, nil)
	appendEvent(t, m, models.EventKeysRotated)
	appendEvent(t, m, models.EventExportStarted)
	rows, err := m.ListCustodyEvents(context.Background(), string(models.ChipKeys), "")
	if err != nil {
		t.Fatalf("ListCustodyEvents: %v", err)
	}
	if len(rows) != 1 || rows[0]["event_kind"] != string(models.EventKeysRotated) {
		t.Fatalf("chip filter returned %v", rows)
	}
	all, err := m.ListCustodyEvents(context.Background(), "", "")
	if err != nil || len(all) != 2 {
		t.Fatalf("unfiltered returned %d rows, err %v", len(all), err)
	}
}

func TestCountCustodyEventsGroupsByChip(t *testing.T) {
	m := newCoverManager(t, nil)
	appendEvent(t, m, models.EventKeysRotated)
	appendEvent(t, m, models.EventIDKeyGenerated)
	appendEvent(t, m, models.EventExportStarted)
	total, byChip, err := m.CountCustodyEvents(context.Background(), "")
	if err != nil {
		t.Fatalf("CountCustodyEvents: %v", err)
	}
	if total != 3 || byChip[string(models.ChipKeys)] != 2 || byChip[string(models.ChipExports)] != 1 {
		t.Fatalf("total=%d byChip=%v", total, byChip)
	}
	if _, _, err := m.CountCustodyEvents(context.Background(), "not-a-time"); !errors.Is(err, custody.ErrInvalidSince) {
		t.Fatalf("bad since: %v", err)
	}
}

func TestSelfOnlyReadsRefuseAnotherCaller(t *testing.T) {
	m := newCoverManager(t, nil)
	ctx := context.Background()
	if _, err := m.ListActorExports(ctx, "actor-1", "actor-2"); !errors.Is(err, custody.ErrNotSelf) {
		t.Fatalf("ListActorExports other caller: %v", err)
	}
	if _, err := m.ListContactReads(ctx, "actor-1", "actor-2"); !errors.Is(err, custody.ErrNotSelf) {
		t.Fatalf("ListContactReads other caller: %v", err)
	}
	if _, err := m.ListActorExports(ctx, "actor-1", "actor-1"); err != nil {
		t.Fatalf("ListActorExports self: %v", err)
	}
	if _, err := m.ListContactReads(ctx, "actor-1", "actor-1"); err != nil {
		t.Fatalf("ListContactReads self: %v", err)
	}
}

func TestConsentVersionLifecycleThroughTheManager(t *testing.T) {
	m := newCoverManager(t, nil)
	ctx := context.Background()
	created, err := m.CreateConsentVersion(ctx, custody.ConsentVersionInput{
		Scope: models.ScopeMechanics, Version: "v1", Language: models.LanguageEnglish,
	})
	if err != nil {
		t.Fatalf("CreateConsentVersion: %v", err)
	}
	if _, err := m.GetConsentVersionInForce(ctx, string(models.ScopeMechanics), string(models.LanguageEnglish)); err == nil {
		t.Fatal("an unpublished version must not be in force")
	}
	if _, err := m.PublishConsentVersion(ctx, created.ID, "admin-1"); err != nil {
		t.Fatalf("PublishConsentVersion: %v", err)
	}
	inForce, err := m.GetConsentVersionInForce(ctx, string(models.ScopeMechanics), string(models.LanguageEnglish))
	if err != nil || inForce.ID != created.ID {
		t.Fatalf("in force = %v, %v; want %s", inForce.ID, err, created.ID)
	}
	got, err := m.GetConsentVersion(ctx, created.ID)
	if err != nil || got.PublishedBy != "admin-1" {
		t.Fatalf("GetConsentVersion = %+v, %v", got, err)
	}
}

func TestListVersionsOrdersNewestPublishedFirstAndUnpublishedLast(t *testing.T) {
	db, sp := newTestDB(t)
	s, err := custody.NewConsentStore(db, sp)
	if err != nil {
		t.Fatalf("NewConsentStore: %v", err)
	}
	ctx := context.Background()
	mk := func(v string) models.TextVersion {
		out, err := s.CreateVersion(ctx, models.TextVersion{Scope: models.ScopeMechanics, Version: v, Language: models.LanguageEnglish})
		if err != nil {
			t.Fatalf("CreateVersion %s: %v", v, err)
		}
		return out
	}
	older, newer, draft := mk("v1"), mk("v2"), mk("v3")
	at := func(d int) string { return models.FormatTime(time.Date(2026, 1, d, 0, 0, 0, 0, time.UTC)) }
	if _, err := s.PublishVersion(ctx, older.ID, "a", at(1)); err != nil {
		t.Fatal(err)
	}
	if _, err := s.PublishVersion(ctx, newer.ID, "a", at(2)); err != nil {
		t.Fatal(err)
	}
	list, err := s.ListVersions(ctx, models.ScopeMechanics, models.LanguageEnglish)
	if err != nil {
		t.Fatalf("ListVersions: %v", err)
	}
	if len(list) != 3 || list[0].ID != newer.ID || list[1].ID != older.ID || list[2].ID != draft.ID {
		t.Fatalf("order = %v, want newer, older, draft", ids(list))
	}
}

func ids(vs []models.TextVersion) []string {
	out := make([]string, len(vs))
	for i, v := range vs {
		out[i] = v.ID
	}
	return out
}

func TestVocabularyHelpersAgreeWithTheModels(t *testing.T) {
	if len(custody.ActKinds()) == 0 || len(custody.EventKinds()) == 0 {
		t.Fatal("kind lists are empty")
	}
	class, err := custody.ActClassOf(custody.ActRoleGranted)
	want, _ := models.ActClassOf(models.ActRoleGranted)
	if err != nil || class != want {
		t.Fatalf("ActClassOf = %v, %v", class, err)
	}
	if _, err := custody.ActClassOf(custody.ActKind("nope")); !errors.Is(err, models.ErrUnknownActKind) {
		t.Fatalf("unknown kind: %v", err)
	}
}
