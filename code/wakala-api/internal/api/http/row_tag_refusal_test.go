package http

import (
	"net/http"
	"strings"
	"testing"
)

func requireRefusedSaying(t *testing.T, code int, body, saying string) {
	t.Helper()
	if code != http.StatusForbidden || !strings.Contains(body, saying) {
		t.Fatalf("the add answered %d %s, want 403 saying %q", code, body, saying)
	}
}

func TestAnAddWithNoAssumedGroupIsRefusedOnEveryPath(t *testing.T) {
	const saying = "assume a group"
	t.Run("the generated add step", func(t *testing.T) {
		w := newRowStepWalk(t, nil)
		w.assumeNothing(t, w.owner)
		rec := w.send(t, w.owner, "add", map[string]any{"answers": map[string]string{"Tender": "Road survey"}})
		requireRefusedSaying(t, rec.Code, rec.Body.String(), saying)
		if n := w.storedRowCount(t); n != 0 {
			t.Fatalf("%d rows stored after a refused add, want none", n)
		}
	})
	t.Run("a designed form step", func(t *testing.T) {
		w := newRowStepWalk(t, nil)
		w.assumeNothing(t, w.people["Volunteer"])
		rec := w.reportReferral(t, w.people["Volunteer"])
		if rec.Code == http.StatusCreated || w.storedRowCount(t) != 0 {
			t.Fatalf("a designed step without a group: %d %s, with %d rows stored, want a refusal and none", rec.Code, rec.Body.String(), w.storedRowCount(t))
		}
	})
	t.Run("a direct add", func(t *testing.T) {
		b := businessRegister(t)
		b.assumeNothing(t, b.owner)
		body := map[string]any{"answers": map[string]string{"Business": "Alpha Bakery", "Owner": b.alpha, "Contact": "front desk"}}
		rec := b.call(t, "POST", "/instances/"+b.instance+"/live-records/"+b.register+"/rows", body, b.owner)
		requireRefusedSaying(t, rec.Code, rec.Body.String(), saying)
		if n := b.storedRowCount(t); n != 0 {
			t.Fatalf("%d rows stored after a refused add, want none", n)
		}
	})
}

func TestAnAddByAGroupWithNoTagIsRefusedOnEveryPath(t *testing.T) {
	const saying = "has no tag"
	t.Run("the generated add step", func(t *testing.T) {
		w := newRowStepWalk(t, nil)
		w.untagGroup(t, w.assumedGroupOf(t, w.people["Coordinator"]))
		rec := w.send(t, w.people["Coordinator"], "add", map[string]any{"answers": map[string]string{"Tender": "Road survey"}})
		requireRefusedSaying(t, rec.Code, rec.Body.String(), saying)
		if n := w.storedRowCount(t); n != 0 {
			t.Fatalf("%d rows stored after a refused add, want none", n)
		}
	})
	t.Run("a designed form step", func(t *testing.T) {
		w := newRowStepWalk(t, nil)
		w.untagGroup(t, w.assumedGroupOf(t, w.people["Volunteer"]))
		rec := w.reportReferral(t, w.people["Volunteer"])
		requireRefusedSaying(t, rec.Code, rec.Body.String(), saying)
		if n := w.storedRowCount(t); n != 0 {
			t.Fatalf("%d rows stored after a refused add, want none", n)
		}
	})
	t.Run("a direct add", func(t *testing.T) {
		b := businessRegister(t)
		b.untagGroup(t, b.ownerAssumesItsFirstGroup(t))
		body := map[string]any{"answers": map[string]string{"Business": "Alpha Bakery", "Owner": b.alpha, "Contact": "front desk"}}
		rec := b.call(t, "POST", "/instances/"+b.instance+"/live-records/"+b.register+"/rows", body, b.owner)
		requireRefusedSaying(t, rec.Code, rec.Body.String(), saying)
		if n := b.storedRowCount(t); n != 0 {
			t.Fatalf("%d rows stored after a refused add, want none", n)
		}
	})
}
