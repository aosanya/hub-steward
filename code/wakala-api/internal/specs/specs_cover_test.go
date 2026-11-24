package specs

import (
	"encoding/json"
	"sort"
	"strings"
	"testing"
)

func TestDeclarationsAreSortedAndDropTheJSONSuffix(t *testing.T) {
	got := Declarations()
	if len(got) == 0 {
		t.Fatal("no declarations embedded")
	}
	if !sort.StringsAreSorted(got) {
		t.Fatalf("declarations not sorted: %v", got)
	}
	for _, name := range got {
		if strings.HasSuffix(name, ".json") {
			t.Fatalf("declaration %q still carries its suffix", name)
		}
	}
	found := false
	for _, name := range got {
		if name == "wakala.auth" {
			found = true
		}
	}
	if !found {
		t.Fatalf("wakala.auth missing from %v", got)
	}
}

func TestModuleOfNamesTheModuleADeclarationFills(t *testing.T) {
	module, err := ModuleOf("wakala.reports")
	if err != nil {
		t.Fatal(err)
	}
	if module != "catalog" {
		t.Fatalf("wakala.reports fills %q, want catalog", module)
	}
}

func TestModuleOfRefusesAnUnknownDeclaration(t *testing.T) {
	_, err := ModuleOf("wakala.nothing")
	if err == nil || !strings.Contains(err.Error(), `no declaration named "wakala.nothing"`) {
		t.Fatalf("got %v", err)
	}
}

func TestModulesListsEachModuleOnceInOrder(t *testing.T) {
	got := Modules()
	if !sort.StringsAreSorted(got) {
		t.Fatalf("modules not sorted: %v", got)
	}
	seen := map[string]int{}
	for _, m := range got {
		seen[m]++
	}
	for m, n := range seen {
		if n != 1 {
			t.Fatalf("module %q listed %d times", m, n)
		}
	}
	if seen["catalog"] != 1 || seen["auth"] != 1 {
		t.Fatalf("expected catalog and auth in %v", got)
	}
	if len(got) >= len(Declarations()) {
		t.Fatalf("two declarations fill catalog, so %d modules must be fewer than %d declarations", len(got), len(Declarations()))
	}
}

func TestRawByDeclarationNameReturnsThatFile(t *testing.T) {
	raw, err := Raw("wakala.reports")
	if err != nil {
		t.Fatal(err)
	}
	var doc struct {
		Module string `json:"module"`
	}
	if err := json.Unmarshal(raw, &doc); err != nil || doc.Module != "catalog" {
		t.Fatalf("module %q err %v", doc.Module, err)
	}
}

func TestRawByModuleNameReturnsTheOnlyDeclaration(t *testing.T) {
	byModule, err := Raw("workspace")
	if err != nil {
		t.Fatal(err)
	}
	byName, err := Raw("wakala.workspace")
	if err != nil {
		t.Fatal(err)
	}
	if string(byModule) != string(byName) {
		t.Fatal("module name and declaration name returned different documents")
	}
}

func TestRawRefusesAModuleWithSeveralDeclarationsAndNamesThem(t *testing.T) {
	_, err := Raw("catalog")
	if err == nil {
		t.Fatal("expected an ambiguity error")
	}
	for _, want := range []string{`"catalog"`, "2 declarations", "wakala.catalog", "wakala.reports", "name the one you mean"} {
		if !strings.Contains(err.Error(), want) {
			t.Fatalf("error %q lacks %q", err.Error(), want)
		}
	}
}

func TestRawRefusesAnUnknownModule(t *testing.T) {
	_, err := Raw("ghost")
	if err == nil || !strings.Contains(err.Error(), `no declaration for the module "ghost"`) {
		t.Fatalf("got %v", err)
	}
}

func decodeObject(t *testing.T, raw []byte) map[string]any {
	t.Helper()
	var doc map[string]any
	if err := json.Unmarshal(raw, &doc); err != nil {
		t.Fatal(err)
	}
	return doc
}

func TestForStampsTheRequestedInstance(t *testing.T) {
	raw, err := For("wakala.auth", "agy1f2e3d4c")
	if err != nil {
		t.Fatal(err)
	}
	doc := decodeObject(t, raw)
	if doc["instance"] != "agy1f2e3d4c" || doc["module"] != "auth" {
		t.Fatalf("instance %v module %v", doc["instance"], doc["module"])
	}
}

func TestForWithNoInstanceKeepsTheDeclaredOne(t *testing.T) {
	raw, err := For("wakala.auth", "")
	if err != nil {
		t.Fatal(err)
	}
	if got := decodeObject(t, raw)["instance"]; got != "wakala" {
		t.Fatalf("instance %v, want wakala", got)
	}
}

func TestForDoesNotChangeTheEmbeddedDeclaration(t *testing.T) {
	if _, err := For("wakala.auth", "other"); err != nil {
		t.Fatal(err)
	}
	instance, err := DeclaredInstance("wakala.auth")
	if err != nil {
		t.Fatal(err)
	}
	if instance != "wakala" {
		t.Fatalf("declared instance became %q", instance)
	}
}

func TestForPropagatesLookupRefusals(t *testing.T) {
	if _, err := For("catalog", "x"); err == nil {
		t.Fatal("an ambiguous module must be refused")
	}
	if _, err := For("ghost", "x"); err == nil {
		t.Fatal("an unknown module must be refused")
	}
}

func TestDeclaredInstanceReadsTheInstanceOfEveryDeclaration(t *testing.T) {
	for _, name := range Declarations() {
		instance, err := DeclaredInstance(name)
		if err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		if instance == "" {
			t.Fatalf("%s declares no instance", name)
		}
	}
}

func TestDeclaredInstanceRefusesAnUnknownName(t *testing.T) {
	if _, err := DeclaredInstance("ghost"); err == nil {
		t.Fatal("expected an error")
	}
}
