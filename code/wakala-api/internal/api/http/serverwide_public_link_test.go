package http

import (
	"net/http"
	"strings"
	"testing"
)

func (a twoAgencies) publicFormLinkOfAgencyA(t *testing.T, key string) {
	t.Helper()
	made := a.call(t, "POST", "/forms/forms?instance_id="+a.idA, map[string]any{"title": "Agency A street survey", "audience": "public", "closes_at": "2027-01-01T00:00:00Z"}, a.ownerA)
	if made.Code != http.StatusCreated {
		t.Fatalf("agency A owner creates a public form: got %d %s", made.Code, made.Body.String())
	}
	formID, _ := decodeObject(t, made)["id"].(string)
	published := a.call(t, "POST", "/forms/forms/"+formID+"/publish?instance_id="+a.idA, map[string]any{"candidate_link_key": key}, a.ownerA)
	if published.Code != http.StatusOK {
		t.Fatalf("agency A owner publishes it: got %d %s", published.Code, published.Body.String())
	}
}

func (a twoAgencies) privateCatalogLinkOfAgencyA(t *testing.T) string {
	t.Helper()
	if put := a.call(t, "PUT", "/catalog/entries/lights?instance_id="+a.idA, perAgencyEntryBody("lights", "Agency A lights"), a.ownerA); put.Code != http.StatusOK {
		t.Fatalf("agency A owner writes an entry: got %d %s", put.Code, put.Body.String())
	}
	if set := a.call(t, "POST", "/catalog/entries/lights/visibility?instance_id="+a.idA, map[string]any{"visibility": "private"}, a.ownerA); set.Code != http.StatusOK {
		t.Fatalf("agency A owner makes it private: got %d %s", set.Code, set.Body.String())
	}
	issued := a.call(t, "POST", "/catalog/entries/lights/links?instance_id="+a.idA, map[string]any{"label": "street"}, a.ownerA)
	if issued.Code != http.StatusCreated {
		t.Fatalf("agency A owner issues a share link: got %d %s", issued.Code, issued.Body.String())
	}
	key, _ := decodeObject(t, issued)["key"].(string)
	if key == "" {
		t.Fatalf("share link issue returned no key: %s", issued.Body.String())
	}
	return key
}

func TestPublicFormLink_OpensOnlyItsOwnAgencyWhenNamed(t *testing.T) {
	a := newTwoAgencies(t)
	a.publicFormLinkOfAgencyA(t, "street-survey-key")
	own := publicGet(a.handler, "/forms/public-links/street-survey-key?instance_id="+a.idA)
	if own.Code != http.StatusOK || !strings.Contains(own.Body.String(), "Agency A street survey") {
		t.Errorf("a public link naming agency A: got %d %s, want agency A's form", own.Code, own.Body.String())
	}
	other := publicGet(a.handler, "/forms/public-links/street-survey-key?instance_id="+a.idB)
	if other.Code != http.StatusNotFound {
		t.Errorf("agency A's link naming agency B: got %d %s, want 404", other.Code, other.Body.String())
	}
}

func TestPublicFormLink_AnOldLinkWithoutTheAgencyOpensWhenOneAgencyHoldsTheKey(t *testing.T) {
	a := newTwoAgencies(t)
	a.publicFormLinkOfAgencyA(t, "street-survey-key")
	old := publicGet(a.handler, "/forms/public-links/street-survey-key")
	if old.Code != http.StatusOK || !strings.Contains(old.Body.String(), "Agency A street survey") {
		t.Errorf("an old link without instance_id: got %d %s, want agency A's form", old.Code, old.Body.String())
	}
	unknown := publicGet(a.handler, "/forms/public-links/no-such-key")
	if unknown.Code != http.StatusNotFound {
		t.Errorf("a link no agency holds without instance_id: got %d %s, want 404", unknown.Code, unknown.Body.String())
	}
}

func TestPublicFormLink_AKeyBothAgenciesHoldIsNotGuessed(t *testing.T) {
	a := newTwoAgencies(t)
	a.publicFormLinkOfAgencyA(t, "shared-key")
	made := a.call(t, "POST", "/forms/forms?instance_id="+a.idB, map[string]any{"title": "Agency B survey", "audience": "public", "closes_at": "2027-01-01T00:00:00Z"}, a.ownerB)
	if made.Code != http.StatusCreated {
		t.Fatalf("agency B owner creates a public form: got %d %s", made.Code, made.Body.String())
	}
	formID, _ := decodeObject(t, made)["id"].(string)
	published := a.call(t, "POST", "/forms/forms/"+formID+"/publish?instance_id="+a.idB, map[string]any{"candidate_link_key": "shared-key"}, a.ownerB)
	if published.Code != http.StatusOK {
		t.Fatalf("agency B owner publishes under the same key: got %d %s", published.Code, published.Body.String())
	}
	old := publicGet(a.handler, "/forms/public-links/shared-key")
	if old.Code != http.StatusNotFound {
		t.Errorf("a key two agencies hold, without instance_id: got %d %s, want 404", old.Code, old.Body.String())
	}
	named := publicGet(a.handler, "/forms/public-links/shared-key?instance_id="+a.idB)
	if named.Code != http.StatusOK || !strings.Contains(named.Body.String(), "Agency B survey") {
		t.Errorf("the same key naming agency B: got %d %s, want agency B's form", named.Code, named.Body.String())
	}
}

func TestPublicCatalogShareLink_OpensOnlyItsOwnAgency(t *testing.T) {
	a := newTwoAgencies(t)
	key := a.privateCatalogLinkOfAgencyA(t)
	own := publicGet(a.handler, "/catalog/entries/lights?k="+key+"&instance_id="+a.idA)
	if own.Code != http.StatusOK || !strings.Contains(own.Body.String(), "Agency A lights") {
		t.Errorf("a share link naming agency A: got %d %s, want agency A's entry", own.Code, own.Body.String())
	}
	other := publicGet(a.handler, "/catalog/entries/lights?k="+key+"&instance_id="+a.idB)
	if other.Code != http.StatusNotFound {
		t.Errorf("agency A's share link naming agency B: got %d %s, want 404", other.Code, other.Body.String())
	}
	old := publicGet(a.handler, "/catalog/entries/lights?k="+key)
	if old.Code != http.StatusOK || !strings.Contains(old.Body.String(), "Agency A lights") {
		t.Errorf("an old share link without instance_id: got %d %s, want agency A's entry", old.Code, old.Body.String())
	}
	wrong := publicGet(a.handler, "/catalog/entries/lights?k=wrong")
	if wrong.Code != http.StatusNotFound {
		t.Errorf("a wrong key without instance_id: got %d %s, want 404", wrong.Code, wrong.Body.String())
	}
}
