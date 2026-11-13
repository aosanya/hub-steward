package notifyrules

import (
	"errors"
	"reflect"
	"slices"
	"testing"

	commmodels "wakalaserver/modules/comm/models"
)

func TestEveryListedEventHasADefaultThatItsOwnValidationAccepts(t *testing.T) {
	for _, e := range Events {
		def, err := Default(e)
		if err != nil {
			t.Fatalf("%s: no default: %v", e, err)
		}
		if def.Event != e {
			t.Fatalf("%s: default names event %s", e, def.Event)
		}
		if len(def.Told) == 0 {
			t.Fatalf("%s: default tells nobody", e)
		}
		if _, err := Validate(def); err != nil {
			t.Fatalf("%s: default refused by Validate: %v", e, err)
		}
	}
}

func TestEveryListedEventHasAnAllowedAudienceList(t *testing.T) {
	for _, e := range Events {
		if len(Allowed(e)) == 0 {
			t.Fatalf("%s: no audience may be told", e)
		}
	}
}

func TestDefaultForAnUnknownEventIsRefused(t *testing.T) {
	_, err := Default(Event("nothing"))
	if !errors.Is(err, ErrUnknownEvent) {
		t.Fatalf("want ErrUnknownEvent, got %v", err)
	}
}

func TestAllowedReturnsACopyTheCallerCannotUseToWidenTheList(t *testing.T) {
	got := Allowed(FormSent)
	got[0] = Subject
	if slices.Contains(Allowed(FormSent), Subject) {
		t.Fatal("changing the returned slice changed what FormSent may tell")
	}
}

func TestAllowedForAnUnknownEventIsEmpty(t *testing.T) {
	if got := Allowed(Event("nothing")); len(got) != 0 {
		t.Fatalf("want none, got %v", got)
	}
}

func TestEffectivePrefersTheStoredRuleOverTheDefault(t *testing.T) {
	stored := map[Event]Rule{JoinAsked: {Event: JoinAsked, Told: []Audience{Owners}, Mutable: false}}
	got, err := Effective(stored, JoinAsked)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(got.Told, []Audience{Owners}) || got.Mutable {
		t.Fatalf("stored rule not used: %+v", got)
	}
}

func TestEffectiveFallsBackToTheDefaultWhenNothingIsStored(t *testing.T) {
	got, err := Effective(nil, JoinApproved)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(got.Told, []Audience{Subject}) {
		t.Fatalf("want the default audience, got %v", got.Told)
	}
}

func TestEffectiveForAnUnknownEventWithNothingStoredIsRefused(t *testing.T) {
	_, err := Effective(map[Event]Rule{}, Event("nothing"))
	if !errors.Is(err, ErrUnknownEvent) {
		t.Fatalf("want ErrUnknownEvent, got %v", err)
	}
}

func TestValidateRefusesAnUnknownEvent(t *testing.T) {
	_, err := Validate(Rule{Event: Event("nothing"), Told: []Audience{Subject}})
	if !errors.Is(err, ErrUnknownEvent) {
		t.Fatalf("want ErrUnknownEvent, got %v", err)
	}
}

func TestValidateRefusesAnAudienceTheEventCannotTell(t *testing.T) {
	cases := []Rule{
		{Event: JoinAsked, Told: []Audience{Group}},
		{Event: AskAnswered, Told: []Audience{GroupLeaders}},
		{Event: ThreadReply, Told: []Audience{Group}},
		{Event: FormSent, Told: []Audience{Subject}},
	}
	for _, r := range cases {
		if _, err := Validate(r); !errors.Is(err, ErrAudienceRefused) {
			t.Fatalf("%s told %v: want ErrAudienceRefused, got %v", r.Event, r.Told, err)
		}
	}
}

func TestValidateRefusesABadAudienceInTheFallbackToo(t *testing.T) {
	r := Rule{Event: ThreadStarted, Told: []Audience{GroupLeaders}, Fallback: []Audience{Thread}, Mutable: true}
	if _, err := Validate(r); !errors.Is(err, ErrAudienceRefused) {
		t.Fatalf("want ErrAudienceRefused, got %v", err)
	}
}

func TestValidateRefusesMakingAFixedEventMutable(t *testing.T) {
	r := Rule{Event: FormSent, Told: []Audience{Group}, Mutable: true}
	if _, err := Validate(r); !errors.Is(err, ErrMuteFixed) {
		t.Fatalf("want ErrMuteFixed, got %v", err)
	}
}

func TestValidateAcceptsAFixedEventStayingFixedAndMarksIt(t *testing.T) {
	got, err := Validate(Rule{Event: FormSent, Told: []Audience{Owners}, Mutable: false})
	if err != nil {
		t.Fatal(err)
	}
	if !got.FixedMute {
		t.Fatal("a fixed event's validated rule should carry FixedMute")
	}
}

func TestValidateIgnoresAFixedMuteClaimedByTheCaller(t *testing.T) {
	got, err := Validate(Rule{Event: JoinAsked, Told: []Audience{Owners}, Mutable: false, FixedMute: true})
	if err != nil {
		t.Fatal(err)
	}
	if got.FixedMute {
		t.Fatal("a caller must not be able to fix the mute of a mutable event")
	}
	if got.Mutable {
		t.Fatal("the caller's Mutable=false on a mutable event should be kept")
	}
}

func TestValidateKeepsTheToldAndFallbackLists(t *testing.T) {
	r := Rule{Event: ThreadStarted, Told: []Audience{Owners}, Fallback: []Audience{Agents}, Mutable: true}
	got, err := Validate(r)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(got.Told, r.Told) || !reflect.DeepEqual(got.Fallback, r.Fallback) {
		t.Fatalf("lists changed: %+v", got)
	}
}

func TestResolveTellsTheFirstListWhenItHasAnyone(t *testing.T) {
	r := Rule{Told: []Audience{GroupLeaders}, Fallback: []Audience{Owners}}
	got := Resolve(r, Roster{GroupLeaders: {"l1", "l2"}, Owners: {"o1"}})
	if !reflect.DeepEqual(got, []string{"l1", "l2"}) {
		t.Fatalf("got %v", got)
	}
}

func TestResolveUsesTheFallbackOnlyWhenTheToldAudiencesAreEmpty(t *testing.T) {
	r := Rule{Told: []Audience{GroupLeaders}, Fallback: []Audience{Owners, Agents}}
	got := Resolve(r, Roster{Owners: {"o1"}, Agents: {"a1"}})
	if !reflect.DeepEqual(got, []string{"o1", "a1"}) {
		t.Fatalf("got %v", got)
	}
}

func TestResolveDropsBlankIdsAndRepeatsAcrossAudiences(t *testing.T) {
	r := Rule{Told: []Audience{Owners, Agents}}
	got := Resolve(r, Roster{Owners: {"", "x", "y"}, Agents: {"y", "z", "x"}})
	if !reflect.DeepEqual(got, []string{"x", "y", "z"}) {
		t.Fatalf("got %v", got)
	}
}

func TestResolveWithOnlyBlankIdsFallsBack(t *testing.T) {
	r := Rule{Told: []Audience{Subject}, Fallback: []Audience{Owners}}
	got := Resolve(r, Roster{Subject: {""}, Owners: {"o1"}})
	if !reflect.DeepEqual(got, []string{"o1"}) {
		t.Fatalf("got %v", got)
	}
}

func TestResolveWithNobodyAnywhereIsAnEmptyNonNilList(t *testing.T) {
	got := Resolve(Rule{Told: []Audience{Subject}, Fallback: []Audience{Owners}}, Roster{})
	if got == nil || len(got) != 0 {
		t.Fatalf("want empty non-nil list, got %#v", got)
	}
}

func TestForCommEventMapsKnownEvents(t *testing.T) {
	cases := map[commmodels.NotificationEvent]Event{
		commmodels.EventJoinRequested:     JoinAsked,
		commmodels.EventThreadRequested:   ThreadStarted,
		commmodels.EventSurveyReached:     FormSent,
		commmodels.EventGroupInvited:      Invited,
		commmodels.EventAskClosed:         AskClosed,
		commmodels.EventGroupJoinApproved: JoinApproved,
	}
	for in, want := range cases {
		got, ok := ForCommEvent(in)
		if !ok || got != want {
			t.Fatalf("%s: got %s %v, want %s", in, got, ok, want)
		}
	}
}

func TestForCommEventRefusesAnEventTheRulesDoNotKnow(t *testing.T) {
	if _, ok := ForCommEvent(commmodels.NotificationEvent("never_heard_of_it")); ok {
		t.Fatal("an unknown comm event should not map")
	}
}

func TestEveryMappedCommEventLandsOnAnEventWithADefault(t *testing.T) {
	for in, ev := range commEvents {
		if _, err := Default(ev); err != nil {
			t.Fatalf("%s maps to %s with no default: %v", in, ev, err)
		}
	}
}
