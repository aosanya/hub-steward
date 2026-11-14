package notifyrules

import (
	"context"
	"errors"
	"fmt"
	"reflect"
	"testing"

	commmodels "wakalaserver/modules/comm/models"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func newCoverStore(t *testing.T) *Store {
	t.Helper()
	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", t.Name())
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(1)
	t.Cleanup(func() { sqlDB.Close() })
	s, err := NewStore(db)
	if err != nil {
		t.Fatalf("new store: %v", err)
	}
	return s
}

func TestStoreWithNothingSavedReadsEveryEventAsItsDefault(t *testing.T) {
	s := newCoverStore(t)
	all, err := s.All(context.Background(), "inst1")
	if err != nil {
		t.Fatal(err)
	}
	if len(all) != len(Events) {
		t.Fatalf("want %d rules, got %d", len(Events), len(all))
	}
	for i, e := range Events {
		def, _ := Default(e)
		if all[i].Event != e || !reflect.DeepEqual(all[i].Told, def.Told) {
			t.Fatalf("%s: want default %+v, got %+v", e, def, all[i])
		}
	}
}

func TestPutWithoutAnInstanceIsRefused(t *testing.T) {
	s := newCoverStore(t)
	for _, id := range []string{"", "   "} {
		if _, err := s.Put(context.Background(), id, Rule{Event: JoinAsked, Told: []Audience{Owners}, Mutable: true}); !errors.Is(err, ErrNoInstance) {
			t.Fatalf("%q: want ErrNoInstance, got %v", id, err)
		}
	}
}

func TestPutRefusesAnAudienceTheEventCannotTellAndStoresNothing(t *testing.T) {
	s := newCoverStore(t)
	ctx := context.Background()
	_, err := s.Put(ctx, "inst1", Rule{Event: JoinApproved, Told: []Audience{Thread}, Mutable: true})
	if !errors.Is(err, ErrAudienceRefused) {
		t.Fatalf("want ErrAudienceRefused, got %v", err)
	}
	stored, err := s.Stored(ctx, "inst1")
	if err != nil || len(stored) != 0 {
		t.Fatalf("want nothing stored, got %v, %v", stored, err)
	}
}

func TestPutRefusesAnUnknownEventAndAChangedFixedMute(t *testing.T) {
	s := newCoverStore(t)
	ctx := context.Background()
	if _, err := s.Put(ctx, "inst1", Rule{Event: Event("nothing"), Told: []Audience{Owners}}); !errors.Is(err, ErrUnknownEvent) {
		t.Fatalf("want ErrUnknownEvent, got %v", err)
	}
	if _, err := s.Put(ctx, "inst1", Rule{Event: FormSent, Told: []Audience{Group}, Mutable: true}); !errors.Is(err, ErrMuteFixed) {
		t.Fatalf("want ErrMuteFixed, got %v", err)
	}
}

func TestPutThenReadReturnsTheSavedRuleWithFixedMuteFromTheDefault(t *testing.T) {
	s := newCoverStore(t)
	ctx := context.Background()
	saved, err := s.Put(ctx, "inst1", Rule{Event: FormSent, Told: []Audience{Owners, Agents}, Fallback: []Audience{Group}, Mutable: false})
	if err != nil {
		t.Fatal(err)
	}
	if !saved.FixedMute || !reflect.DeepEqual(saved.Told, []Audience{Owners, Agents}) || !reflect.DeepEqual(saved.Fallback, []Audience{Group}) {
		t.Fatalf("unexpected saved rule %+v", saved)
	}
	got, err := s.Rule(ctx, "inst1", FormSent)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(got, saved) {
		t.Fatalf("read %+v differs from saved %+v", got, saved)
	}
}

func TestPutTwiceReplacesTheRuleInsteadOfAddingARow(t *testing.T) {
	s := newCoverStore(t)
	ctx := context.Background()
	if _, err := s.Put(ctx, "inst1", Rule{Event: JoinAsked, Told: []Audience{Owners}, Mutable: true}); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Put(ctx, "inst1", Rule{Event: JoinAsked, Told: []Audience{Agents}, Mutable: false}); err != nil {
		t.Fatal(err)
	}
	stored, err := s.Stored(ctx, "inst1")
	if err != nil {
		t.Fatal(err)
	}
	if len(stored) != 1 {
		t.Fatalf("want one stored rule, got %d", len(stored))
	}
	r := stored[JoinAsked]
	if !reflect.DeepEqual(r.Told, []Audience{Agents}) || r.Mutable {
		t.Fatalf("second save did not win: %+v", r)
	}
}

func TestPutWithNoAudiencesReadsBackAsEmptyListsNotNull(t *testing.T) {
	s := newCoverStore(t)
	ctx := context.Background()
	got, err := s.Put(ctx, "inst1", Rule{Event: ThreadStarted, Mutable: true})
	if err != nil {
		t.Fatal(err)
	}
	if got.Told == nil || got.Fallback == nil || len(got.Told) != 0 || len(got.Fallback) != 0 {
		t.Fatalf("want empty non-nil lists, got %+v", got)
	}
}

func TestRulesSavedForOneInstanceDoNotReachAnother(t *testing.T) {
	s := newCoverStore(t)
	ctx := context.Background()
	if _, err := s.Put(ctx, "inst1", Rule{Event: JoinAsked, Told: []Audience{Owners}, Mutable: false}); err != nil {
		t.Fatal(err)
	}
	other, err := s.Rule(ctx, "inst2", JoinAsked)
	if err != nil {
		t.Fatal(err)
	}
	def, _ := Default(JoinAsked)
	if !reflect.DeepEqual(other.Told, def.Told) || !other.Mutable {
		t.Fatalf("inst2 should read the default, got %+v", other)
	}
}

func TestAllShowsASavedRuleInTheEventsOwnPosition(t *testing.T) {
	s := newCoverStore(t)
	ctx := context.Background()
	if _, err := s.Put(ctx, "inst1", Rule{Event: Invited, Told: []Audience{Owners}, Mutable: false}); err != nil {
		t.Fatal(err)
	}
	all, err := s.All(ctx, "inst1")
	if err != nil {
		t.Fatal(err)
	}
	for i, e := range Events {
		if all[i].Event != e {
			t.Fatalf("position %d: want %s, got %s", i, e, all[i].Event)
		}
		if e == Invited && !reflect.DeepEqual(all[i].Told, []Audience{Owners}) {
			t.Fatalf("saved rule missing: %+v", all[i])
		}
	}
}

func TestResetDropsTheSavedRuleAndReturnsTheDefault(t *testing.T) {
	s := newCoverStore(t)
	ctx := context.Background()
	if _, err := s.Put(ctx, "inst1", Rule{Event: JoinAsked, Told: []Audience{Owners}, Mutable: false}); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Put(ctx, "inst1", Rule{Event: JoinDeclined, Told: []Audience{Owners}, Mutable: true}); err != nil {
		t.Fatal(err)
	}
	got, err := s.Reset(ctx, "inst1", JoinAsked)
	if err != nil {
		t.Fatal(err)
	}
	def, _ := Default(JoinAsked)
	if !reflect.DeepEqual(got, def) {
		t.Fatalf("want default %+v, got %+v", def, got)
	}
	stored, _ := s.Stored(ctx, "inst1")
	if _, ok := stored[JoinAsked]; ok || len(stored) != 1 {
		t.Fatalf("only JoinDeclined should remain, got %v", stored)
	}
}

func TestResetOfAnUnknownEventIsRefused(t *testing.T) {
	s := newCoverStore(t)
	if _, err := s.Reset(context.Background(), "inst1", Event("nothing")); !errors.Is(err, ErrUnknownEvent) {
		t.Fatalf("want ErrUnknownEvent, got %v", err)
	}
}

func TestMutableAnswersFromTheSavedRuleForAMappedCommEvent(t *testing.T) {
	s := newCoverStore(t)
	ctx := context.Background()
	mutable, known := s.Mutable(ctx, "inst1", commmodels.EventJoinRequested)
	if !known || !mutable {
		t.Fatalf("default: want mutable and known, got %v %v", mutable, known)
	}
	if _, err := s.Put(ctx, "inst1", Rule{Event: JoinAsked, Told: []Audience{Owners}, Mutable: false}); err != nil {
		t.Fatal(err)
	}
	mutable, known = s.Mutable(ctx, "inst1", commmodels.EventJoinRequested)
	if !known || mutable {
		t.Fatalf("saved: want not mutable and known, got %v %v", mutable, known)
	}
}

func TestMutableForACommEventNoRuleCoversIsNotKnown(t *testing.T) {
	s := newCoverStore(t)
	mutable, known := s.Mutable(context.Background(), "inst1", commmodels.NotificationEvent("no_such_event"))
	if mutable || known {
		t.Fatalf("want false false, got %v %v", mutable, known)
	}
}

func TestMutableFormSentIsFixedAsNotMutable(t *testing.T) {
	s := newCoverStore(t)
	mutable, known := s.Mutable(context.Background(), "inst1", commmodels.EventSurveyReached)
	if !known || mutable {
		t.Fatalf("want known and not mutable, got %v %v", mutable, known)
	}
}

func TestStoredReadFailsWhenARowNamesAnEventNoLongerKnown(t *testing.T) {
	s := newCoverStore(t)
	ctx := context.Background()
	if err := s.db.Create(&ruleRow{InstanceID: "inst1", Event: "retired_event", Told: "[]", Fallback: "[]"}).Error; err != nil {
		t.Fatal(err)
	}
	if _, err := s.Stored(ctx, "inst1"); !errors.Is(err, ErrUnknownEvent) {
		t.Fatalf("want ErrUnknownEvent, got %v", err)
	}
	if _, err := s.All(ctx, "inst1"); !errors.Is(err, ErrUnknownEvent) {
		t.Fatalf("All: want ErrUnknownEvent, got %v", err)
	}
	if _, known := s.Mutable(ctx, "inst1", commmodels.EventJoinRequested); known {
		t.Fatal("a failing read must not report a known answer")
	}
}

func TestStoredReadFailsWhenARowHoldsBrokenAudienceJSON(t *testing.T) {
	s := newCoverStore(t)
	ctx := context.Background()
	if err := s.db.Create(&ruleRow{InstanceID: "inst1", Event: string(JoinAsked), Told: "not json", Fallback: "[]"}).Error; err != nil {
		t.Fatal(err)
	}
	if _, err := s.Rule(ctx, "inst1", JoinAsked); err == nil {
		t.Fatal("want a decode error")
	}
	if err := s.db.Where("instance_id = ?", "inst1").Delete(&ruleRow{}).Error; err != nil {
		t.Fatal(err)
	}
	if err := s.db.Create(&ruleRow{InstanceID: "inst1", Event: string(JoinAsked), Told: "[]", Fallback: "{"}).Error; err != nil {
		t.Fatal(err)
	}
	if _, err := s.Rule(ctx, "inst1", JoinAsked); err == nil {
		t.Fatal("want a decode error for the fallback")
	}
}
