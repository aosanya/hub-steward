package http

import (
	"net/http"
	"testing"
)

func (w assetWalk) movementCount(t *testing.T) int {
	t.Helper()
	rec := w.call(t, "GET", w.base+"/movements?asset_id="+w.assetID, nil, w.owner)
	if rec.Code != http.StatusOK {
		t.Fatalf("GET /movements: %d %s", rec.Code, rec.Body.String())
	}
	return len(decodeObjects(t, rec))
}

func (w assetWalk) postMovement(t *testing.T, body map[string]any) int {
	t.Helper()
	return w.call(t, "POST", w.base+"/movements", body, w.owner).Code
}

func TestDepartBelowZero_ADepartureAboveTheBalanceIsRefusedWith409(t *testing.T) {
	w := newAssetWalk(t)
	w.arrive(t)
	code := w.postMovement(t, map[string]any{"asset_id": w.assetID, "kind": "departed", "quantity": 50, "from_location_id": w.locationID})
	if code != http.StatusConflict {
		t.Errorf("departing 50 from a balance of 5 answers %d, want 409", code)
	}
	if n := w.movementCount(t); n != 1 {
		t.Errorf("%d movements on the ledger, want only the arrival", n)
	}
}

func TestDepartBelowZero_ATransferAboveTheBalanceIsRefusedWith409(t *testing.T) {
	w := newAssetWalk(t)
	w.arrive(t)
	shelf := w.post(t, "/locations", map[string]any{"code": "shelf", "name": "Shelf"})
	shelfID, _ := shelf["id"].(string)
	code := w.postMovement(t, map[string]any{"asset_id": w.assetID, "kind": "transferred", "quantity": 6, "from_location_id": w.locationID, "to_location_id": shelfID})
	if code != http.StatusConflict {
		t.Errorf("transferring 6 from a balance of 5 answers %d, want 409", code)
	}
}

func TestDepartBelowZero_ADepartureOfTheWholeBalancePasses(t *testing.T) {
	w := newAssetWalk(t)
	w.arrive(t)
	code := w.postMovement(t, map[string]any{"asset_id": w.assetID, "kind": "departed", "quantity": 5, "from_location_id": w.locationID})
	if code != http.StatusCreated && code != http.StatusOK {
		t.Errorf("departing 5 from a balance of 5 answers %d, want it posted", code)
	}
}
