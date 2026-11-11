package http

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	catalog "wakalaserver/modules/catalog"
	forms "wakalaserver/modules/forms"
	permissions "wakalaserver/modules/permissions"
	"wakalaserver/modules/shared/spec"
)

type permitEveryone struct{ permissions.PermissionsManager }

func (permitEveryone) MayPerformIn(context.Context, string, string, string, string) (bool, error) {
	return true, nil
}

type twoAgencies struct {
	stepRunWalk
	ownerA, ownerB *http.Cookie
	idA, idB       string
}

func newTwoAgencies(t *testing.T) twoAgencies {
	t.Helper()
	rdb := gateTestDB(t, "reports2")
	rs, err := catalog.SpecFor("sharedreports", "")
	if err != nil {
		t.Fatalf("catalog SpecFor: %v", err)
	}
	if err := spec.Migrate(rdb, rs); err != nil {
		t.Fatalf("catalog Migrate: %v", err)
	}
	cm, err := catalog.NewCatalogManager(rdb, rs)
	if err != nil {
		t.Fatalf("NewCatalogManager: %v", err)
	}
	fdb := gateTestDB(t, "forms2")
	fs, err := forms.SpecFor("sharedforms")
	if err != nil {
		t.Fatalf("forms SpecFor: %v", err)
	}
	if err := forms.Provision(fdb, fs); err != nil {
		t.Fatalf("forms Provision: %v", err)
	}
	fm, err := forms.NewFormManager(fdb, fs)
	if err != nil {
		t.Fatalf("NewFormManager: %v", err)
	}
	w := newStepRunWalk(t, nil)
	w.deps.Reports = cm
	w.deps.Catalog = cm
	w.deps.Forms = fm
	w.deps.Permissions = permitEveryone{}
	w.handler = NewRouter(w.deps)
	ownerB := w.cookieFor(t, "owner-b")
	created := w.call(t, "POST", "/instances", map[string]any{"name": "Other agency"}, ownerB)
	if created.Code != http.StatusCreated {
		t.Fatalf("create second instance: %d %s", created.Code, created.Body.String())
	}
	idB, _ := decodeObject(t, created)["id"].(string)
	return twoAgencies{stepRunWalk: w, ownerA: w.owner, ownerB: ownerB, idA: w.instance, idB: idB}
}

func perAgencyEntryBody(slug, name string) map[string]any {
	return map[string]any{"slug": slug, "name": name, "summary": "s", "doc": "{}", "visibility": "pending"}
}

func TestReportsMount_EachAgencyHasItsOwnEntries(t *testing.T) {
	a := newTwoAgencies(t)
	put := a.call(t, "PUT", "/reports/entries/lights?instance_id="+a.idA, perAgencyEntryBody("lights", "Agency A lights"), a.ownerA)
	if put.Code != http.StatusOK {
		t.Fatalf("agency A owner writes its entry: got %d %s", put.Code, put.Body.String())
	}
	seen := a.call(t, "GET", "/reports/entries/lights/admin?instance_id="+a.idB, nil, a.ownerB)
	if seen.Code != http.StatusNotFound {
		t.Errorf("agency B owner reads agency A's entry in B's own reports: got %d %s, want 404", seen.Code, seen.Body.String())
	}
	reach := a.call(t, "GET", "/reports/entries/lights/admin?instance_id="+a.idA, nil, a.ownerB)
	if reach.Code != http.StatusNotFound {
		t.Errorf("agency B owner names agency A's reports: got %d %s, want 404", reach.Code, reach.Body.String())
	}
	own := a.call(t, "PUT", "/reports/entries/lights?instance_id="+a.idB, perAgencyEntryBody("lights", "Agency B lights"), a.ownerB)
	if own.Code != http.StatusOK {
		t.Fatalf("agency B owner writes the same slug in its own reports: got %d %s", own.Code, own.Body.String())
	}
	back := a.call(t, "GET", "/reports/entries/lights/admin?instance_id="+a.idA, nil, a.ownerA)
	if back.Code != http.StatusOK || !strings.Contains(back.Body.String(), "Agency A lights") {
		t.Errorf("agency A's entry after agency B wrote the same slug: got %d %s, want A's name", back.Code, back.Body.String())
	}
}

func TestReportsMount_AMemberOfOneAgencyNeedsNoInstanceID(t *testing.T) {
	a := newTwoAgencies(t)
	put := a.call(t, "PUT", "/reports/entries/lights", perAgencyEntryBody("lights", "Agency A lights"), a.ownerA)
	if put.Code != http.StatusOK {
		t.Fatalf("agency A owner writes without naming the agency: got %d %s", put.Code, put.Body.String())
	}
	seen := a.call(t, "GET", "/reports/entries/lights/admin", nil, a.ownerB)
	if seen.Code != http.StatusNotFound {
		t.Errorf("agency B owner reads agency A's entry without naming an agency: got %d %s, want 404", seen.Code, seen.Body.String())
	}
}

func TestReportsMount_PublicReadsNameTheAgency(t *testing.T) {
	a := newTwoAgencies(t)
	body := perAgencyEntryBody("lights", "Agency A lights")
	body["visibility"] = "public"
	if put := a.call(t, "PUT", "/reports/entries/lights?instance_id="+a.idA, body, a.ownerA); put.Code != http.StatusOK {
		t.Fatalf("write public entry: %d %s", put.Code, put.Body.String())
	}
	other := publicGet(a.handler, "/reports/public/entries?instance_id="+a.idB)
	if strings.Contains(other.Body.String(), "Agency A lights") {
		t.Errorf("agency B's public list shows agency A's entry: %s", other.Body.String())
	}
	none := publicGet(a.handler, "/reports/public/entries")
	if none.Code != http.StatusNotFound {
		t.Errorf("public list naming no agency: got %d %s, want 404", none.Code, none.Body.String())
	}
}

func TestFormsMount_EachAgencyHasItsOwnForms(t *testing.T) {
	a := newTwoAgencies(t)
	made := a.call(t, "POST", "/forms/forms?instance_id="+a.idA, map[string]any{"title": "Agency A survey", "closes_at": "2027-01-01T00:00:00Z"}, a.ownerA)
	if made.Code != http.StatusCreated {
		t.Fatalf("agency A owner creates a form: got %d %s", made.Code, made.Body.String())
	}
	list := a.call(t, "GET", "/forms/forms?instance_id="+a.idB, nil, a.ownerB)
	if strings.Contains(list.Body.String(), "Agency A survey") {
		t.Errorf("agency B's form list shows agency A's form: %s", list.Body.String())
	}
	reach := a.call(t, "GET", "/forms/forms?instance_id="+a.idA, nil, a.ownerB)
	if reach.Code != http.StatusNotFound {
		t.Errorf("agency B owner names agency A's forms: got %d %s, want 404", reach.Code, reach.Body.String())
	}
}

func TestCatalogMount_EachAgencyHasItsOwnEntries(t *testing.T) {
	a := newTwoAgencies(t)
	put := a.call(t, "PUT", "/catalog/entries/lights?instance_id="+a.idA, perAgencyEntryBody("lights", "Agency A lights"), a.ownerA)
	if put.Code != http.StatusOK {
		t.Fatalf("agency A owner writes a catalog entry: got %d %s", put.Code, put.Body.String())
	}
	reach := a.call(t, "GET", "/catalog/entries/lights/admin?instance_id="+a.idA, nil, a.ownerB)
	if reach.Code != http.StatusNotFound {
		t.Errorf("agency B owner names agency A's catalog: got %d %s, want 404", reach.Code, reach.Body.String())
	}
	seen := a.call(t, "GET", "/catalog/entries/lights/admin?instance_id="+a.idB, nil, a.ownerB)
	if seen.Code != http.StatusNotFound {
		t.Errorf("agency B reads agency A's catalog entry in its own catalog: got %d %s, want 404", seen.Code, seen.Body.String())
	}
}

func publicGet(handler http.Handler, path string) *httptest.ResponseRecorder {
	req := httptest.NewRequest("GET", path, nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}
