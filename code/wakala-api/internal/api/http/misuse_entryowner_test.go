package http

import (
	"context"
	"net/http"
	"testing"

	catalog "wakalaserver/modules/catalog"
	"wakalaserver/modules/shared/spec"

	"wakalaserver/internal/agencies"
)

func entryBody(slug, name string) map[string]any {
	return map[string]any{"slug": slug, "name": name, "summary": "s", "doc": "{}", "visibility": "pending"}
}

func newAgencyOf(t *testing.T, w stepRunWalk, ownerSubject, name string) (string, *http.Cookie) {
	t.Helper()
	cookie := w.cookieFor(t, ownerSubject)
	rec := w.call(t, "POST", "/instances", map[string]any{"name": name}, cookie)
	if rec.Code != http.StatusCreated {
		t.Fatalf("create instance %s: %d %s", name, rec.Code, rec.Body.String())
	}
	id, _ := decodeObject(t, rec)["id"].(string)
	return id, cookie
}

func TestAgencyEntries_OwnerIsAdmittedInTheirOwnAgencyAndRefusedInAnother(t *testing.T) {
	w := newStepRunWalk(t, nil)
	otherAgency, otherOwner := newAgencyOf(t, w, "other-owner", "Farmers")
	own := "/instances/" + w.instance + "/forms-catalog/entries/ward-3"
	foreign := "/instances/" + otherAgency + "/forms-catalog/entries/ward-3"

	if rec := w.call(t, "PUT", own, entryBody("ward-3", "Ward 3"), w.owner); rec.Code != http.StatusOK {
		t.Errorf("owner writes an entry in their own agency: %d %s, want 200", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "PUT", foreign, entryBody("ward-3", "Taken"), w.owner); rec.Code != http.StatusNotFound {
		t.Errorf("owner of one agency writes an entry in another: %d %s, want 404", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "GET", own+"/admin", nil, otherOwner); rec.Code != http.StatusNotFound {
		t.Errorf("owner of another agency reads this agency's entry: %d %s, want 404", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "DELETE", own, nil, otherOwner); rec.Code != http.StatusNotFound {
		t.Errorf("owner of another agency deletes this agency's entry: %d %s, want 404", rec.Code, rec.Body.String())
	}
}

func TestAgencyEntries_AnAgentWithNoAgencyRoleCannotOverwriteOrDeleteTheOwnersEntry(t *testing.T) {
	w := newStepRunWalk(t, nil)
	if err := w.deps.Registry.AddMember(context.Background(), w.instance, "agent-clerk", agencies.RoleAgent); err != nil {
		t.Fatalf("AddMember: %v", err)
	}
	clerk := w.cookieFor(t, "agent-clerk")
	path := "/instances/" + w.instance + "/forms-catalog/entries/"

	if rec := w.call(t, "PUT", path+"mayor", entryBody("mayor", "Mayor"), w.owner); rec.Code != http.StatusOK {
		t.Fatalf("owner writes: %d %s", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "PUT", path+"mayor", entryBody("mayor", "TAKEN"), clerk); rec.Code != http.StatusNotFound {
		t.Errorf("an agent overwrites the owner's entry: %d %s, want 404", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "DELETE", path+"mayor", nil, clerk); rec.Code != http.StatusNotFound {
		t.Errorf("an agent deletes the owner's entry: %d %s, want 404", rec.Code, rec.Body.String())
	}
	read := w.call(t, "GET", path+"mayor/admin", nil, w.owner)
	if read.Code != http.StatusOK || decodeObject(t, read)["name"] != "Mayor" {
		t.Errorf("the owner's entry after the refused acts: %d %s, want it unchanged", read.Code, read.Body.String())
	}

	if rec := w.call(t, "DELETE", path+"mayor", nil, w.owner); rec.Code != http.StatusNoContent {
		t.Errorf("owner deletes their own entry: %d %s, want 204", rec.Code, rec.Body.String())
	}
}

func serverCatalogWalk(t *testing.T) stepRunWalk {
	t.Helper()
	db := gateTestDB(t, "entryowner")
	cs, err := catalog.SpecFor("entryowner", "")
	if err != nil {
		t.Fatalf("catalog SpecFor: %v", err)
	}
	if err := spec.Migrate(db, cs); err != nil {
		t.Fatalf("catalog Migrate: %v", err)
	}
	cm, err := catalog.NewCatalogManager(db, cs)
	if err != nil {
		t.Fatalf("NewCatalogManager: %v", err)
	}
	w := newStepRunWalk(t, nil)
	w.deps.Catalog = cm
	w.deps.Reports = cm
	w.deps.Permissions = everyoneMay{}
	w.handler = NewRouter(w.deps)
	return w
}

func TestServerCatalog_OnlyTheEntrysOwnerOverwritesOrDeletesIt(t *testing.T) {
	for _, door := range []string{"/catalog", "/reports"} {
		t.Run(door, func(t *testing.T) {
			w := serverCatalogWalk(t)
			ctx := context.Background()
			for _, resident := range []string{"resident-anna", "resident-bela"} {
				if err := w.deps.Registry.AddMember(ctx, w.instance, resident, agencies.RoleResident); err != nil {
					t.Fatalf("AddMember %s: %v", resident, err)
				}
			}
			anna := w.cookieFor(t, "resident-anna")
			bela := w.cookieFor(t, "resident-bela")
			entry := door + "/entries/lights"

			if rec := w.call(t, "PUT", entry, entryBody("lights", "Lights"), anna); rec.Code != http.StatusOK {
				t.Fatalf("anna writes: %d %s", rec.Code, rec.Body.String())
			}
			if rec := w.call(t, "PUT", entry, entryBody("lights", "TAKEN"), bela); rec.Code != http.StatusForbidden {
				t.Errorf("bela overwrites anna's entry: %d %s, want 403", rec.Code, rec.Body.String())
			}
			if rec := w.call(t, "DELETE", entry, nil, bela); rec.Code != http.StatusForbidden {
				t.Errorf("bela deletes anna's entry: %d %s, want 403", rec.Code, rec.Body.String())
			}
			read := w.call(t, "GET", entry+"/admin", nil, anna)
			if read.Code != http.StatusOK || decodeObject(t, read)["submitted_by"] != "resident-anna" {
				t.Errorf("anna's entry after the refused acts: %d %s, want it still hers", read.Code, read.Body.String())
			}
			if rec := w.call(t, "PUT", entry, entryBody("lights", "Lights 2"), anna); rec.Code != http.StatusOK {
				t.Errorf("anna rewrites her own entry: %d %s, want 200", rec.Code, rec.Body.String())
			}
			if rec := w.call(t, "DELETE", entry, nil, anna); rec.Code != http.StatusNoContent {
				t.Errorf("anna deletes her own entry: %d %s, want 204", rec.Code, rec.Body.String())
			}
		})
	}
}
