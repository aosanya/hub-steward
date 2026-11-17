package mwanachamaaudit

import (
	"context"
	"errors"
	"reflect"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func newTestManager(t *testing.T, clock Clock) AuditManager {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	s, err := SpecFor("test")
	if err != nil {
		t.Fatal(err)
	}
	if err := Provision(db, s); err != nil {
		t.Fatal(err)
	}
	am, err := NewAuditManagerWithClock(db, s, clock)
	if err != nil {
		t.Fatal(err)
	}
	return am
}

func tickingClock() Clock {
	at := time.Date(2026, 11, 16, 9, 0, 0, 0, time.UTC)
	return func() time.Time {
		at = at.Add(time.Second)
		return at
	}
}

func TestListReturnsExactlyWhatWasRecordedNewestFirst(t *testing.T) {
	am := newTestManager(t, tickingClock())
	ctx := context.Background()
	var recorded []Entry
	for _, in := range [][3]string{
		{"owner", "renamed the agency", "Alpha"},
		{"owner", "renamed the agency", "Beta"},
		{"agent-1", "set the join mode", "open"},
	} {
		e, err := am.Record(ctx, "agency-1", in[0], in[1], in[2])
		if err != nil {
			t.Fatal(err)
		}
		recorded = append(recorded, e)
	}

	got, err := am.ListEntries(ctx, EntryFilter{InstanceID: "agency-1"})
	if err != nil {
		t.Fatal(err)
	}

	want := []Entry{recorded[2], recorded[1], recorded[0]}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("list = %+v, want %+v", got, want)
	}
}

func TestRecordStampsTheClockAsRFC3339AndFillsAnID(t *testing.T) {
	am := newTestManager(t, tickingClock())

	e, err := am.Record(context.Background(), "agency-1", "owner", "renamed the agency", "Alpha")
	if err != nil {
		t.Fatal(err)
	}

	if e.ID == "" || e.InstanceID != "agency-1" || e.Actor != "owner" || e.Action != "renamed the agency" || e.Subject != "Alpha" {
		t.Fatalf("entry = %+v", e)
	}
	at, err := time.Parse(time.RFC3339, e.At)
	if err != nil {
		t.Fatalf("at %q is not RFC 3339: %v", e.At, err)
	}
	if want := time.Date(2026, 11, 16, 9, 0, 1, 0, time.UTC); !at.Equal(want) {
		t.Fatalf("at = %v, want the injected clock's %v", at, want)
	}
}

func TestEntriesRecordedInOneInstantStillListNewestFirst(t *testing.T) {
	frozen := time.Date(2026, 11, 16, 9, 0, 0, 0, time.UTC)
	am := newTestManager(t, func() time.Time { return frozen })
	ctx := context.Background()
	for _, subject := range []string{"First", "Second", "Third"} {
		if _, err := am.Record(ctx, "agency-1", "owner", "renamed the agency", subject); err != nil {
			t.Fatal(err)
		}
	}

	got, err := am.ListEntries(ctx, EntryFilter{InstanceID: "agency-1"})
	if err != nil {
		t.Fatal(err)
	}

	var subjects []string
	for _, e := range got {
		subjects = append(subjects, e.Subject)
	}
	if want := []string{"Third", "Second", "First"}; !reflect.DeepEqual(subjects, want) {
		t.Fatalf("subjects = %v, want %v", subjects, want)
	}
}

func TestListIsScopedToTheInstance(t *testing.T) {
	am := newTestManager(t, tickingClock())
	ctx := context.Background()
	for _, instance := range []string{"agency-1", "agency-2", "agency-1"} {
		if _, err := am.Record(ctx, instance, "owner", "renamed the agency", instance); err != nil {
			t.Fatal(err)
		}
	}

	one, err := am.ListEntries(ctx, EntryFilter{InstanceID: "agency-1"})
	if err != nil {
		t.Fatal(err)
	}
	two, err := am.ListEntries(ctx, EntryFilter{InstanceID: "agency-2"})
	if err != nil {
		t.Fatal(err)
	}
	none, err := am.ListEntries(ctx, EntryFilter{InstanceID: "agency-3"})
	if err != nil {
		t.Fatal(err)
	}

	if len(one) != 2 || len(two) != 1 || len(none) != 0 {
		t.Fatalf("agency-1 has %d, agency-2 has %d, agency-3 has %d; want 2, 1, 0", len(one), len(two), len(none))
	}
	for _, e := range one {
		if e.InstanceID != "agency-1" {
			t.Fatalf("agency-1's log holds %+v", e)
		}
	}
}

func TestRecordRefusesAnEntryWithoutWhoWhatOrWhere(t *testing.T) {
	am := newTestManager(t, tickingClock())
	ctx := context.Background()
	for name, in := range map[string][4]string{
		"no instance": {"", "owner", "renamed", "x"},
		"no actor":    {"agency-1", " ", "renamed", "x"},
		"no action":   {"agency-1", "owner", "", "x"},
	} {
		if _, err := am.Record(ctx, in[0], in[1], in[2], in[3]); !errors.Is(err, ErrInvalidEntry) {
			t.Errorf("%s: err = %v, want ErrInvalidEntry", name, err)
		}
	}
	if _, err := am.Record(ctx, "agency-1", "owner", "renamed", ""); err != nil {
		t.Errorf("an entry with no subject is refused: %v", err)
	}
}

func TestListRefusesNoInstance(t *testing.T) {
	am := newTestManager(t, tickingClock())

	if _, err := am.ListEntries(context.Background(), EntryFilter{}); !errors.Is(err, ErrInvalidEntry) {
		t.Fatalf("err = %v, want ErrInvalidEntry", err)
	}
}

func TestNewManagerRefusesNoDatabaseAndNoClock(t *testing.T) {
	s, err := SpecFor("test")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := NewAuditManager(nil, s); err == nil {
		t.Fatal("a manager without a database was made")
	}
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := NewAuditManagerWithClock(db, s, nil); err == nil {
		t.Fatal("a manager without a clock was made")
	}
}

func filterOf(t *testing.T, instanceID, actor, subject string) EntryFilter {
	t.Helper()
	f := EntryFilter{InstanceID: instanceID}
	v := reflect.ValueOf(&f).Elem()
	for field, value := range map[string]string{"Actor": actor, "Subject": subject} {
		if value == "" {
			continue
		}
		target := v.FieldByName(field)
		if !target.IsValid() {
			t.Fatalf("EntryFilter has no %s field", field)
		}
		target.SetString(value)
	}
	return f
}

func subjectsOf(entries []Entry) []string {
	out := make([]string, 0, len(entries))
	for _, e := range entries {
		out = append(out, e.Actor+"/"+e.Subject)
	}
	return out
}

func TestListNarrowsByActorBySubjectAndByBothWithoutLeavingTheInstance(t *testing.T) {
	am := newTestManager(t, tickingClock())
	ctx := context.Background()
	for _, in := range [][4]string{
		{"agency-1", "owner", "renamed the agency", "Alpha"},
		{"agency-1", "agent-1", "set the join mode", "open"},
		{"agency-1", "owner", "set the join mode", "open"},
		{"agency-1", "agent-2", "renamed the agency", "Alpha"},
		{"agency-2", "owner", "renamed the agency", "Alpha"},
	} {
		if _, err := am.Record(ctx, in[0], in[1], in[2], in[3]); err != nil {
			t.Fatal(err)
		}
	}

	cases := []struct {
		name           string
		actor, subject string
		want           []string
	}{
		{"by actor alone", "owner", "", []string{"owner/open", "owner/Alpha"}},
		{"by subject alone", "", "Alpha", []string{"agent-2/Alpha", "owner/Alpha"}},
		{"by both", "owner", "Alpha", []string{"owner/Alpha"}},
		{"by an actor nobody is", "stranger", "", []string{}},
		{"by a subject nobody touched", "", "Gamma", []string{}},
		{"by an actor and a subject that never met", "agent-1", "Alpha", []string{}},
	}
	for _, c := range cases {
		got, err := am.ListEntries(ctx, filterOf(t, "agency-1", c.actor, c.subject))
		if err != nil {
			t.Fatalf("%s: %v", c.name, err)
		}
		if gotNames := subjectsOf(got); !reflect.DeepEqual(gotNames, c.want) {
			t.Errorf("%s: got %v, want %v", c.name, gotNames, c.want)
		}
	}

	other, err := am.ListEntries(ctx, filterOf(t, "agency-2", "owner", ""))
	if err != nil || len(other) != 1 || other[0].InstanceID != "agency-2" {
		t.Fatalf("the other agency's owner entries: %+v %v", other, err)
	}
}
