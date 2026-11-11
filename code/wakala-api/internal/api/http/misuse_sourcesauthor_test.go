package http

import (
	"net/http"
	"testing"
)

const forgedSourcesAuthor = "C-forged-clerk-1"

func fileSource(t *testing.T, w stepRunWalk, body map[string]any) map[string]any {
	t.Helper()
	rec := w.call(t, "POST", "/instances/"+w.instance+"/sources/sources", body, w.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("file source: %d %s", rec.Code, rec.Body.String())
	}
	return decodeObject(t, rec)
}

func TestSourceFiledByIsTheCallerNotTheBody(t *testing.T) {
	w := referral(t)
	source := fileSource(t, w, map[string]any{"title": "Housing act", "created_by": forgedSourcesAuthor})
	if author, _ := source["created_by"].(string); author != "test-owner" {
		t.Errorf("the stored source names %q; want the caller's own id test-owner, never the body's %q", author, forgedSourcesAuthor)
	}
}

func TestAnnotationMadeByIsTheCallerNotTheBody(t *testing.T) {
	w := referral(t)
	source := fileSource(t, w, map[string]any{"title": "Housing act"})
	rec := w.call(t, "POST", "/instances/"+w.instance+"/sources/annotations", map[string]any{
		"source_id": source["id"], "target_module": "forms", "target_id": "q-1", "created_by": forgedSourcesAuthor,
	}, w.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("annotate: %d %s", rec.Code, rec.Body.String())
	}
	if author, _ := decodeObject(t, rec)["created_by"].(string); author != "test-owner" {
		t.Errorf("the stored annotation names %q; want the caller's own id test-owner, never the body's %q", author, forgedSourcesAuthor)
	}
}

func TestVerificationVouchedByIsTheCallerNotTheBody(t *testing.T) {
	w := referral(t)
	source := fileSource(t, w, map[string]any{"title": "Housing act"})
	rec := w.call(t, "POST", "/instances/"+w.instance+"/sources/verifications", map[string]any{
		"subject_role": "source", "subject_id": source["id"], "status": "verified", "verified_by": forgedSourcesAuthor,
	}, w.owner)
	if rec.Code != http.StatusCreated {
		t.Fatalf("verify: %d %s", rec.Code, rec.Body.String())
	}
	if voucher, _ := decodeObject(t, rec)["verified_by"].(string); voucher != "test-owner" {
		t.Errorf("the stored verification names %q; want the caller's own id test-owner, never the body's %q", voucher, forgedSourcesAuthor)
	}
}
