package main

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"

	"github.com/aosanya/mwanachama-backend-shared/spec"

	"wakalaserver/internal/agencies"
)

func TestDeclarationNameFallsBackToModuleOnlyWhenNoneIsGiven(t *testing.T) {
	if got := (specMount{module: "ratings"}).declarationName(); got != "ratings" {
		t.Fatalf("got %q, want the module name", got)
	}
	if got := (specMount{module: "catalog", declaration: "storefront"}).declarationName(); got != "storefront" {
		t.Fatalf("got %q, want the declared name", got)
	}
}

func TestMountIsConfiguredByEitherSpecPathOrInstance(t *testing.T) {
	m := specMount{prefix: "COVERMOUNT"}
	if m.configured() {
		t.Fatal("a mount with neither variable set must not be configured")
	}
	t.Setenv("COVERMOUNT_INSTANCE", "agy1")
	if !m.configured() {
		t.Fatal("an instance alone configures the mount")
	}
	t.Setenv("COVERMOUNT_INSTANCE", "")
	t.Setenv("COVERMOUNT_SPEC", "/some/spec.json")
	if !m.configured() {
		t.Fatal("a spec path alone configures the mount")
	}
}

func TestResolveReadsTheSpecPathThroughTheLoaderAndNamesIt(t *testing.T) {
	t.Setenv("COVERMOUNT_SPEC", "/etc/spec.json")
	t.Setenv("COVERMOUNT_INSTANCE", "ignored")
	want := &spec.Spec{Instance: "from-file"}
	var loaded string
	m := specMount{
		prefix: "COVERMOUNT",
		load:   func(p string) (*spec.Spec, error) { loaded = p; return want, nil },
		parse:  func([]byte) (*spec.Spec, error) { t.Fatal("parse must not run when a path is set"); return nil, nil },
	}
	got, from, err := m.resolve()
	if err != nil || got != want {
		t.Fatalf("got %v, %v", got, err)
	}
	if loaded != "/etc/spec.json" || from != "/etc/spec.json" {
		t.Fatalf("loaded %q, from %q", loaded, from)
	}
}

func TestResolveReturnsTheLoaderError(t *testing.T) {
	t.Setenv("COVERMOUNT_SPEC", "/missing.json")
	boom := errors.New("no such file")
	m := specMount{prefix: "COVERMOUNT", load: func(string) (*spec.Spec, error) { return nil, boom }}
	if _, _, err := m.resolve(); !errors.Is(err, boom) {
		t.Fatalf("got %v", err)
	}
}

func TestResolveStampsTheInstanceIntoTheEmbeddedDeclaration(t *testing.T) {
	t.Setenv("COVERMOUNT_SPEC", "")
	t.Setenv("COVERMOUNT_INSTANCE", "agy9z")
	var raw []byte
	m := specMount{
		module: "ratings",
		prefix: "COVERMOUNT",
		parse:  func(b []byte) (*spec.Spec, error) { raw = b; return &spec.Spec{Instance: "agy9z"}, nil },
	}
	_, from, err := m.resolve()
	if err != nil {
		t.Fatal(err)
	}
	if from != "embedded ratings declaration" {
		t.Fatalf("from = %q", from)
	}
	var doc map[string]any
	if err := json.Unmarshal(raw, &doc); err != nil {
		t.Fatal(err)
	}
	if doc["instance"] != "agy9z" {
		t.Fatalf("instance in the parsed document = %v", doc["instance"])
	}
}

func TestResolveRefusesAnUnknownDeclarationByName(t *testing.T) {
	t.Setenv("COVERMOUNT_SPEC", "")
	t.Setenv("COVERMOUNT_INSTANCE", "agy1")
	m := specMount{module: "no-such-module", prefix: "COVERMOUNT", parse: func([]byte) (*spec.Spec, error) { t.Fatal("parse must not run"); return nil, nil }}
	_, from, err := m.resolve()
	if err == nil {
		t.Fatal("an unknown declaration must be refused")
	}
	if from != "no-such-module" {
		t.Fatalf("from = %q", from)
	}
}

func TestResolveReturnsTheParseError(t *testing.T) {
	t.Setenv("COVERMOUNT_SPEC", "")
	t.Setenv("COVERMOUNT_INSTANCE", "agy1")
	boom := errors.New("bad declaration")
	m := specMount{module: "ratings", prefix: "COVERMOUNT", parse: func([]byte) (*spec.Spec, error) { return nil, boom }}
	if _, _, err := m.resolve(); !errors.Is(err, boom) {
		t.Fatalf("got %v", err)
	}
}

func TestHoldsMatchesOnlyAnExactPermissionCode(t *testing.T) {
	granted := []string{"agency.goal.create", "forms.form.publish"}
	if !holds(granted, "forms.form.publish") {
		t.Fatal("a granted code must be held")
	}
	if holds(granted, "forms.form") || holds(granted, "FORMS.FORM.PUBLISH") || holds(nil, "forms.form.publish") {
		t.Fatal("a prefix, a different case or an empty grant must not be held")
	}
}

func TestFirstCharsCutsOnlyWhatIsLongerThanTheLimit(t *testing.T) {
	if got := firstChars("abcdef", 3); got != "abc" {
		t.Fatalf("got %q", got)
	}
	if got := firstChars("abc", 3); got != "abc" {
		t.Fatalf("a string at the limit is kept whole, got %q", got)
	}
	if got := firstChars("", 3); got != "" {
		t.Fatalf("got %q", got)
	}
	if got := firstChars(strings.Repeat("x", 700), 600); len(got) != 600 {
		t.Fatalf("length %d", len(got))
	}
}

type registryStub struct {
	agencies.Registry
	instances []agencies.Instance
	listErr   error
	getErr    error
}

func (r registryStub) ListInstances(context.Context) ([]agencies.Instance, error) {
	return r.instances, r.listErr
}

func (r registryStub) GetInstance(_ context.Context, id string) (agencies.Instance, error) {
	for _, i := range r.instances {
		if i.ID == id {
			return i, r.getErr
		}
	}
	return agencies.Instance{}, r.getErr
}

func TestInstanceIDsOfListsEveryRegisteredAgencyInOrder(t *testing.T) {
	registry := registryStub{instances: []agencies.Instance{{ID: "b"}, {ID: "a"}, {ID: "c"}}}
	ids, err := instanceIDsOf(registry)(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if strings.Join(ids, ",") != "b,a,c" {
		t.Fatalf("ids = %v", ids)
	}
}

func TestInstanceIDsOfIsEmptyNotNilForNoAgenciesAndPassesTheErrorOn(t *testing.T) {
	ids, err := instanceIDsOf(registryStub{})(context.Background())
	if err != nil || ids == nil || len(ids) != 0 {
		t.Fatalf("got %v, %v", ids, err)
	}
	boom := errors.New("registry down")
	if _, err := instanceIDsOf(registryStub{listErr: boom})(context.Background()); !errors.Is(err, boom) {
		t.Fatalf("got %v", err)
	}
}

func TestInstanceKindOfReadsTheKindAndPassesTheLookupErrorOn(t *testing.T) {
	registry := registryStub{instances: []agencies.Instance{{ID: "a", Kind: "sacco"}}}
	kind, err := instanceKindOf(registry)(context.Background(), "a")
	if err != nil || kind != "sacco" {
		t.Fatalf("got %q, %v", kind, err)
	}
	boom := errors.New("gone")
	registry.getErr = boom
	if _, err := instanceKindOf(registry)(context.Background(), "a"); !errors.Is(err, boom) {
		t.Fatalf("got %v", err)
	}
}
