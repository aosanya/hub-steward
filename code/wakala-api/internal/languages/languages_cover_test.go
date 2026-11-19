package languages

import (
	"context"
	"errors"
	"reflect"
	"testing"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func newStore(t *testing.T) *Store {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(1)
	s, err := NewStore(db)
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func TestNormalizeAcceptsCaseAndSpaces(t *testing.T) {
	got, err := Normalize("  sw ")
	if err != nil || got != "SW" {
		t.Fatalf("got %q, %v", got, err)
	}
}

func TestNormalizeRefusesUnknownAndEmpty(t *testing.T) {
	for _, code := range []string{"", "  ", "XX", "ENG", "e n"} {
		if _, err := Normalize(code); !errors.Is(err, ErrUnknownLanguage) {
			t.Errorf("%q: got %v", code, err)
		}
	}
}

func TestValidateOrdersContentByOfferedListAndUppercases(t *testing.T) {
	got, err := Validate(Agency{StudioDefault: "sw", Content: []string{"ja", "en", "de"}, ContentDefault: " ja "})
	if err != nil {
		t.Fatal(err)
	}
	want := Agency{StudioDefault: "SW", Content: []string{"DE", "EN", "JA"}, ContentDefault: "JA"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got %+v want %+v", got, want)
	}
}

func TestValidateRefusals(t *testing.T) {
	cases := []struct {
		name string
		in   Agency
		want error
	}{
		{"unknown studio default", Agency{StudioDefault: "XX", Content: []string{"EN"}, ContentDefault: "EN"}, ErrUnknownLanguage},
		{"no content", Agency{StudioDefault: "EN", ContentDefault: "EN"}, ErrNoContent},
		{"unknown content language", Agency{StudioDefault: "EN", Content: []string{"EN", "XX"}, ContentDefault: "EN"}, ErrUnknownLanguage},
		{"content repeated across case", Agency{StudioDefault: "EN", Content: []string{"EN", "en"}, ContentDefault: "EN"}, ErrRepeated},
		{"unknown content default", Agency{StudioDefault: "EN", Content: []string{"EN"}, ContentDefault: "XX"}, ErrUnknownLanguage},
		{"default not listed", Agency{StudioDefault: "EN", Content: []string{"EN"}, ContentDefault: "FR"}, ErrDefaultNotListed},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got, err := Validate(c.in)
			if !errors.Is(err, c.want) {
				t.Fatalf("got %v want %v", err, c.want)
			}
			if !reflect.DeepEqual(got, Agency{}) {
				t.Fatalf("a refusal must return the zero agency, got %+v", got)
			}
		})
	}
}

func TestDefaultAgencyIsEnglishOnlyAndValid(t *testing.T) {
	d := DefaultAgency()
	got, err := Validate(d)
	if err != nil || !reflect.DeepEqual(got, d) {
		t.Fatalf("got %+v, %v", got, err)
	}
	if d.StudioDefault != Fallback || d.ContentDefault != Fallback {
		t.Fatalf("defaults %+v", d)
	}
}

func TestStoreAgencyDefaultsWhenNothingSaved(t *testing.T) {
	s := newStore(t)
	got, err := s.Agency(context.Background(), "inst-1")
	if err != nil || !reflect.DeepEqual(got, DefaultAgency()) {
		t.Fatalf("got %+v, %v", got, err)
	}
}

func TestStorePutAgencyRoundTripsAndReplaces(t *testing.T) {
	s := newStore(t)
	ctx := context.Background()
	saved, err := s.PutAgency(ctx, "inst-1", Agency{StudioDefault: "fr", Content: []string{"sw", "en"}, ContentDefault: "sw"})
	if err != nil {
		t.Fatal(err)
	}
	want := Agency{StudioDefault: "FR", Content: []string{"EN", "SW"}, ContentDefault: "SW"}
	if !reflect.DeepEqual(saved, want) {
		t.Fatalf("saved %+v", saved)
	}
	read, err := s.Agency(ctx, "inst-1")
	if err != nil || !reflect.DeepEqual(read, want) {
		t.Fatalf("read %+v, %v", read, err)
	}
	if _, err := s.PutAgency(ctx, "inst-1", Agency{StudioDefault: "DE", Content: []string{"DE"}, ContentDefault: "DE"}); err != nil {
		t.Fatal(err)
	}
	read, _ = s.Agency(ctx, "inst-1")
	if !reflect.DeepEqual(read, Agency{StudioDefault: "DE", Content: []string{"DE"}, ContentDefault: "DE"}) {
		t.Fatalf("second save did not replace: %+v", read)
	}
}

func TestStoreAgencyIsPerInstance(t *testing.T) {
	s := newStore(t)
	ctx := context.Background()
	if _, err := s.PutAgency(ctx, "a", Agency{StudioDefault: "HU", Content: []string{"HU"}, ContentDefault: "HU"}); err != nil {
		t.Fatal(err)
	}
	other, err := s.Agency(ctx, "b")
	if err != nil || !reflect.DeepEqual(other, DefaultAgency()) {
		t.Fatalf("instance b saw %+v, %v", other, err)
	}
}

func TestStorePutAgencyRefusals(t *testing.T) {
	s := newStore(t)
	ctx := context.Background()
	good := Agency{StudioDefault: "EN", Content: []string{"EN"}, ContentDefault: "EN"}
	for _, id := range []string{"", "   "} {
		if _, err := s.PutAgency(ctx, id, good); !errors.Is(err, ErrNoInstance) {
			t.Errorf("%q: got %v", id, err)
		}
	}
	if _, err := s.PutAgency(ctx, "a", Agency{StudioDefault: "EN", Content: []string{"EN"}, ContentDefault: "FR"}); !errors.Is(err, ErrDefaultNotListed) {
		t.Fatalf("got %v", err)
	}
	read, _ := s.Agency(ctx, "a")
	if !reflect.DeepEqual(read, DefaultAgency()) {
		t.Fatalf("a refused save must store nothing, got %+v", read)
	}
}

func TestStorePersonLifecycle(t *testing.T) {
	s := newStore(t)
	ctx := context.Background()
	if got, err := s.Person(ctx, "acc"); err != nil || got != "" {
		t.Fatalf("unset person: %q, %v", got, err)
	}
	if got, err := s.PutPerson(ctx, "acc", " ja "); err != nil || got != "JA" {
		t.Fatalf("put: %q, %v", got, err)
	}
	if got, _ := s.Person(ctx, "acc"); got != "JA" {
		t.Fatalf("read %q", got)
	}
	if got, err := s.PutPerson(ctx, "acc", "zh"); err != nil || got != "ZH" {
		t.Fatalf("replace: %q, %v", got, err)
	}
	if got, _ := s.Person(ctx, "acc"); got != "ZH" {
		t.Fatalf("read after replace %q", got)
	}
	if got, err := s.PutPerson(ctx, "acc", "  "); err != nil || got != "" {
		t.Fatalf("clear: %q, %v", got, err)
	}
	if got, _ := s.Person(ctx, "acc"); got != "" {
		t.Fatalf("cleared person still reads %q", got)
	}
}

func TestStorePutPersonRefusals(t *testing.T) {
	s := newStore(t)
	ctx := context.Background()
	if _, err := s.PutPerson(ctx, " ", "EN"); !errors.Is(err, ErrNoPerson) {
		t.Fatalf("got %v", err)
	}
	if _, err := s.PutPerson(ctx, "acc", "XX"); !errors.Is(err, ErrUnknownLanguage) {
		t.Fatalf("got %v", err)
	}
	if got, _ := s.Person(ctx, "acc"); got != "" {
		t.Fatalf("refused language was stored: %q", got)
	}
}

func TestStorePersonIsPerAccount(t *testing.T) {
	s := newStore(t)
	ctx := context.Background()
	s.PutPerson(ctx, "one", "FR")
	s.PutPerson(ctx, "two", "RU")
	a, _ := s.Person(ctx, "one")
	b, _ := s.Person(ctx, "two")
	if a != "FR" || b != "RU" {
		t.Fatalf("got %q %q", a, b)
	}
}
