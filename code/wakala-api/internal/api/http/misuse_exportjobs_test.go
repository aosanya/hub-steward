package http

import (
	"context"
	"net/http"
	"testing"

	"wakalaserver/internal/agencies"
)

func TestExportJobs_ResidentCannotDoReadAnotherResidentsExportJobs(t *testing.T) {
	w := newStepRunWalk(t, nil)
	ctx := context.Background()
	path := "/instances/" + w.instance + "/custody/actors/"

	for _, id := range []string{"resident-ada", "resident-bo"} {
		if err := w.deps.Registry.AddMember(ctx, w.instance, id, agencies.RoleResident); err != nil {
			t.Fatalf("AddMember %s: %v", id, err)
		}
	}
	ada := w.cookieFor(t, "resident-ada")

	if rec := w.call(t, "GET", path+"resident-bo/export-jobs", nil, ada); rec.Code < 400 {
		t.Fatalf("resident reading a neighbour's export jobs: %d %s, want refused", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "GET", path+"resident-bo/export-jobs", nil, w.owner); rec.Code < 400 {
		t.Fatalf("owner reading a resident's own export jobs: %d %s, want refused", rec.Code, rec.Body.String())
	}

	if rec := w.call(t, "GET", path+"test-owner/export-jobs", nil, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("owner reading own export jobs: %d %s, want 200", rec.Code, rec.Body.String())
	}
}
