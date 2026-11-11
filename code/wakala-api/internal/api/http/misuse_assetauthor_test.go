package http

import (
	"net/http"
	"testing"
	"time"
)

const forgedKeeper = "forged-keeper"

type assetWalk struct {
	stepRunWalk
	base, assetID, locationID string
}

func newAssetWalk(t *testing.T) assetWalk {
	t.Helper()
	w := assetWalk{stepRunWalk: newStepRunWalk(t, nil)}
	w.base = "/instances/" + w.instance + "/assetmanager"
	location := w.post(t, "/locations", map[string]any{"code": "store", "name": "Store"})
	w.locationID, _ = location["id"].(string)
	asset := w.post(t, "/assets", map[string]any{"code": "chair", "name": "Chair", "tracking_mode": "fungible"})
	w.assetID, _ = asset["id"].(string)
	return w
}

func (w assetWalk) post(t *testing.T, route string, body map[string]any) map[string]any {
	t.Helper()
	rec := w.call(t, "POST", w.base+route, body, w.owner)
	if rec.Code != http.StatusCreated && rec.Code != http.StatusOK {
		t.Fatalf("POST %s: %d %s", route, rec.Code, rec.Body.String())
	}
	return decodeObject(t, rec)
}

func (w assetWalk) arrive(t *testing.T) map[string]any {
	t.Helper()
	return w.post(t, "/movements", map[string]any{
		"asset_id": w.assetID, "kind": "arrived", "quantity": 5, "to_location_id": w.locationID,
		"performed_by": forgedKeeper,
	})
}

func TestAssetAuthor_AMovementNamesTheSignedInMemberNotTheBody(t *testing.T) {
	w := newAssetWalk(t)
	if by, _ := w.arrive(t)["performed_by"].(string); by != "test-owner" {
		t.Errorf("the entry names %q; want the signed-in test-owner, never the body's %s", by, forgedKeeper)
	}
}

func TestAssetAuthor_AReversalNamesTheSignedInMemberNotTheBody(t *testing.T) {
	w := newAssetWalk(t)
	id, _ := w.arrive(t)["id"].(string)
	reversal := w.post(t, "/movements/"+id+"/reverse", map[string]any{"performed_by": forgedKeeper, "note": "miscounted"})
	if by, _ := reversal["performed_by"].(string); by != "test-owner" {
		t.Errorf("the reversal names %q; want the signed-in test-owner, never the body's %s", by, forgedKeeper)
	}
}

func TestAssetAuthor_AHoldNamesTheSignedInMemberAndItsCommitToo(t *testing.T) {
	w := newAssetWalk(t)
	w.arrive(t)
	hold := w.post(t, "/holds", map[string]any{
		"asset_id": w.assetID, "location_id": w.locationID, "quantity": 2,
		"expires_at": time.Now().Add(time.Hour).UTC().Format(time.RFC3339),
		"placed_by":  forgedKeeper,
	})
	if by, _ := hold["placed_by"].(string); by != "test-owner" {
		t.Errorf("the hold names %q; want the signed-in test-owner, never the body's %s", by, forgedKeeper)
	}
	id, _ := hold["id"].(string)
	committed := w.post(t, "/holds/"+id+"/commit", map[string]any{"quantity": 2, "kind": "departed", "performed_by": forgedKeeper})
	movement, _ := committed["movement"].(map[string]any)
	if by, _ := movement["performed_by"].(string); by != "test-owner" {
		t.Errorf("the commit's entry names %q; want the signed-in test-owner, never the body's %s", by, forgedKeeper)
	}
}
