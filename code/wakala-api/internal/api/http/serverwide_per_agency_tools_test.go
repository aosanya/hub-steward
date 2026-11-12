package http

import (
	"net/http"
	"strings"
	"testing"

	ratings "wakalaserver/modules/ratings"

	"wakalaserver/internal/specs"
)

func newTwoAgenciesWithRatings(t *testing.T) twoAgencies {
	t.Helper()
	a := newTwoAgencies(t)
	raw, err := specs.For(ratings.Module, "sharedratings")
	if err != nil {
		t.Fatalf("ratings spec: %v", err)
	}
	rs, err := ratings.ParseSpec(raw)
	if err != nil {
		t.Fatalf("ratings ParseSpec: %v", err)
	}
	db := gateTestDB(t, "ratings2")
	if err := ratings.Provision(db, rs); err != nil {
		t.Fatalf("ratings Provision: %v", err)
	}
	rm, err := ratings.NewRatingsManager(db, rs)
	if err != nil {
		t.Fatalf("NewRatingsManager: %v", err)
	}
	a.deps.Ratings = rm
	a.handler = NewRouter(a.deps)
	return a
}

func TestRatingsRoutes_EachAgencyHasItsOwnRatings(t *testing.T) {
	a := newTwoAgenciesWithRatings(t)
	put := a.call(t, "PUT", "/catalog/ratings/lights?instance_id="+a.idA, map[string]any{"value": 0.8}, a.ownerA)
	if put.Code != http.StatusOK {
		t.Fatalf("agency A owner rates an item in A: got %d %s", put.Code, put.Body.String())
	}
	reach := a.call(t, "GET", "/catalog/ratings?item=lights&instance_id="+a.idA, nil, a.ownerB)
	if reach.Code != http.StatusNotFound {
		t.Errorf("agency B owner names agency A's ratings: got %d %s, want 404", reach.Code, reach.Body.String())
	}
	seen := a.call(t, "GET", "/catalog/ratings?item=lights&instance_id="+a.idB, nil, a.ownerB)
	if seen.Code != http.StatusOK {
		t.Fatalf("agency B owner lists its own ratings: got %d %s", seen.Code, seen.Body.String())
	}
	if strings.Contains(seen.Body.String(), "0.8") {
		t.Errorf("agency B's ratings show agency A's rating: %s", seen.Body.String())
	}
	back := a.call(t, "GET", "/catalog/ratings?item=lights&instance_id="+a.idA, nil, a.ownerA)
	if back.Code != http.StatusOK || !strings.Contains(back.Body.String(), "0.8") {
		t.Errorf("agency A's own ratings: got %d %s, want the 0.8 rating", back.Code, back.Body.String())
	}
}

func TestRatingsRoutes_AMemberOfOneAgencyNeedsNoInstanceID(t *testing.T) {
	a := newTwoAgenciesWithRatings(t)
	put := a.call(t, "PUT", "/catalog/ratings/lights", map[string]any{"value": 0.8}, a.ownerA)
	if put.Code != http.StatusOK {
		t.Fatalf("agency A owner rates without naming the agency: got %d %s", put.Code, put.Body.String())
	}
	seen := a.call(t, "GET", "/catalog/ratings?item=lights", nil, a.ownerB)
	if strings.Contains(seen.Body.String(), "0.8") {
		t.Errorf("agency B owner sees agency A's rating without naming an agency: %d %s", seen.Code, seen.Body.String())
	}
}

func TestCatalogAndReportsTools_EachAgencyHasItsOwnEntries(t *testing.T) {
	for _, prefix := range []string{"catalog", "reports"} {
		t.Run(prefix, func(t *testing.T) {
			a := newTwoAgencies(t)
			peerA := a.openMCP(t, a.subjectOf(t, a.ownerA))
			peerB := a.openMCP(t, a.subjectOf(t, a.ownerB))
			entry := func(instance, name string) map[string]any {
				return map[string]any{"slug": "lights", "name": name, "summary": "s", "doc": "{}", "instance_id": instance}
			}
			if failed, text := peerA.call(t, prefix+"_entry_upsert", entry(a.idA, "Agency A lights")); failed {
				t.Fatalf("agency A owner writes its entry: %s", text)
			}
			if failed, text := peerB.call(t, prefix+"_entry_upsert", entry(a.idA, "Taken over")); !failed {
				t.Errorf("agency B owner writes into agency A's %s: succeeded: %s", prefix, text)
			}
			failed, text := peerB.call(t, prefix+"_entry_read_private", map[string]any{"slug": "lights", "instance_id": a.idA})
			if !failed || strings.Contains(text, "Agency A lights") {
				t.Errorf("agency B owner reads agency A's entry: failed=%v %s", failed, text)
			}
			failed, text = peerB.call(t, prefix+"_entry_read_private", map[string]any{"slug": "lights", "instance_id": a.idB})
			if strings.Contains(text, "Agency A lights") {
				t.Errorf("agency B's own %s shows agency A's entry: failed=%v %s", prefix, failed, text)
			}
			failed, text = peerA.call(t, prefix+"_entry_read_private", map[string]any{"slug": "lights", "instance_id": a.idA})
			if failed || !strings.Contains(text, "Agency A lights") {
				t.Errorf("agency A reads its own entry: failed=%v %s", failed, text)
			}
		})
	}
}
