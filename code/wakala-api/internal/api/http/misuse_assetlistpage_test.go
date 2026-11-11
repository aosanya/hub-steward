package http

import (
	"fmt"
	"net/http"
	"testing"
	"time"
)

const assetPageSeeded = 5

var assetPageLists = []string{"/assets", "/movements", "/holds", "/locations"}

func newAssetPageWalk(t *testing.T) assetWalk {
	t.Helper()
	w := newAssetWalk(t)
	for i := 1; i < assetPageSeeded; i++ {
		w.post(t, "/assets", map[string]any{"name": fmt.Sprintf("Chair %d", i), "tracking_mode": "fungible"})
		w.post(t, "/locations", map[string]any{"name": fmt.Sprintf("Store %d", i)})
	}
	for i := 0; i < assetPageSeeded; i++ {
		w.arrive(t)
		w.post(t, "/holds", map[string]any{
			"asset_id": w.assetID, "location_id": w.locationID, "quantity": 1,
			"expires_at": time.Now().Add(time.Hour).UTC().Format(time.RFC3339),
		})
	}
	return w
}

func (w assetWalk) assetPageIDs(t *testing.T, list, query string) []string {
	t.Helper()
	rec := w.call(t, "GET", w.base+list+query, nil, w.owner)
	if rec.Code != http.StatusOK {
		t.Fatalf("GET %s%s: %d %s", list, query, rec.Code, rec.Body.String())
	}
	var ids []string
	for _, row := range decodeObjects(t, rec) {
		id, _ := row["id"].(string)
		ids = append(ids, id)
	}
	return ids
}

func TestAssetListPage_ALimitAnswersThatManyRowsOnEveryList(t *testing.T) {
	w := newAssetPageWalk(t)
	for _, list := range assetPageLists {
		if got := len(w.assetPageIDs(t, list, "?limit=2")); got != 2 {
			t.Errorf("GET %s?limit=2 answered %d rows; want 2", list, got)
		}
	}
}

func TestAssetListPage_AnOffsetStepsPastTheFirstRowsOnEveryList(t *testing.T) {
	w := newAssetPageWalk(t)
	for _, list := range assetPageLists {
		all := w.assetPageIDs(t, list, "")
		if len(all) != assetPageSeeded {
			t.Fatalf("GET %s answered %d rows; want the %d seeded", list, len(all), assetPageSeeded)
		}
		second := w.assetPageIDs(t, list, "?limit=2&offset=2")
		if len(second) != 2 || second[0] != all[2] || second[1] != all[3] {
			t.Errorf("GET %s?limit=2&offset=2 answered %v; want rows 3 and 4 of %v", list, second, all)
		}
		last := w.assetPageIDs(t, list, "?limit=2&offset=4")
		if len(last) != 1 || last[0] != all[4] {
			t.Errorf("GET %s?limit=2&offset=4 answered %v; want the last row of %v", list, last, all)
		}
	}
}

func TestAssetListPage_ANegativeLimitOrOffsetIsRefusedOnEveryList(t *testing.T) {
	w := newAssetPageWalk(t)
	for _, list := range assetPageLists {
		for _, query := range []string{"?limit=-1", "?offset=-1"} {
			rec := w.call(t, "GET", w.base+list+query, nil, w.owner)
			if rec.Code != http.StatusBadRequest {
				t.Errorf("GET %s%s: %d; want 400", list, query, rec.Code)
			}
		}
	}
}

func TestAssetListPage_AHugeLimitAndOffsetAreAnsweredNotTrusted(t *testing.T) {
	w := newAssetPageWalk(t)
	for _, list := range assetPageLists {
		if got := len(w.assetPageIDs(t, list, "?limit=2147483648")); got != assetPageSeeded {
			t.Errorf("GET %s?limit=2147483648 answered %d rows; want all %d", list, got, assetPageSeeded)
		}
		if got := len(w.assetPageIDs(t, list, "?limit=2147483648&offset=2147483648")); got != 0 {
			t.Errorf("GET %s with an offset past the end answered %d rows; want none", list, got)
		}
	}
}

func TestAssetListPage_ABalanceStillFoldsTheWholeLedger(t *testing.T) {
	w := newAssetPageWalk(t)
	rec := w.call(t, "GET", w.base+"/assets/"+w.assetID+"/balance?location_id="+w.locationID, nil, w.owner)
	if rec.Code != http.StatusOK {
		t.Fatalf("balance: %d %s", rec.Code, rec.Body.String())
	}
	if got, _ := decodeObject(t, rec)["balance"].(float64); got != assetPageSeeded*5 {
		t.Errorf("balance is %v; want %d from %d arrivals of 5", got, assetPageSeeded*5, assetPageSeeded)
	}
}

func TestAssetListPage_ANoLimitListIsCappedAtFiveHundredRows(t *testing.T) {
	w := newAssetWalk(t)
	for i := 0; i < 505; i++ {
		w.post(t, "/assets", map[string]any{"name": fmt.Sprintf("Bulk %d", i), "tracking_mode": "fungible"})
	}
	if got := len(w.assetPageIDs(t, "/assets", "")); got != 500 {
		t.Errorf("GET /assets with no limit answered %d rows; want the cap of 500", got)
	}
	if got := len(w.assetPageIDs(t, "/assets", "?limit=1000")); got != 500 {
		t.Errorf("GET /assets?limit=1000 answered %d rows; want the cap of 500", got)
	}
	if got := len(w.assetPageIDs(t, "/assets", "?offset=500")); got != 6 {
		t.Errorf("GET /assets?offset=500 answered %d rows; want the remaining 6", got)
	}
}
