package http

import (
	"context"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	assetmodels "github.com/aosanya/mwanachama-backend-assetmanager/models"
)

func (b businessRegisterWalk) addBusinessWithAsset(t *testing.T, business, asset string) *httptest.ResponseRecorder {
	t.Helper()
	body := map[string]any{"answers": map[string]string{"Business": business, "Owner": b.alpha, "Asset": asset}}
	return b.call(t, "POST", "/instances/"+b.instance+"/live-records/"+b.register+"/rows", body, b.owner)
}

func (b businessRegisterWalk) createAsset(t *testing.T, name string) string {
	t.Helper()
	ctx := context.Background()
	am, err := b.deps.Registry.AssetManager(ctx, b.instance)
	if err != nil {
		t.Fatalf("AssetManager: %v", err)
	}
	asset, err := am.CreateAsset(ctx, assetmodels.Asset{Name: name, TrackingMode: assetmodels.AssetTrackingModeSerialized, SerialTag: "SN-" + name})
	if err != nil {
		t.Fatalf("CreateAsset %s: %v", name, err)
	}
	return asset.ID
}

func TestLiveRecordRowsAssetPick_ARealAssetIdIsAccepted(t *testing.T) {
	b := businessRegister(t)
	asset := b.createAsset(t, "Mill pump")
	rec := b.addBusinessWithAsset(t, "Alpha Bakery", asset)
	if rec.Code != http.StatusCreated {
		t.Fatalf("a row naming a real asset: %d %s, want 201", rec.Code, rec.Body.String())
	}
}

func TestLiveRecordRowsAssetPick_AnUnknownAssetIdIsRefused(t *testing.T) {
	b := businessRegister(t)
	rec := b.addBusinessWithAsset(t, "Alpha Bakery", "no-such-asset")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("a row naming an unknown asset: %d %s, want 400", rec.Code, rec.Body.String())
	}
	if !strings.Contains(rec.Body.String(), "Asset is not an asset of this agency") {
		t.Errorf("the refusal reads %q, want it to say Asset is not an asset of this agency", rec.Body.String())
	}
}

func TestLiveRecordRowsAssetPick_APersonIdIsNotAnAsset(t *testing.T) {
	b := businessRegister(t)
	rec := b.addBusinessWithAsset(t, "Alpha Bakery", b.beta)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("a row naming a person as its asset: %d %s, want 400", rec.Code, rec.Body.String())
	}
}

func TestLiveRecordRowsAssetPick_AnEmptyAssetIsAccepted(t *testing.T) {
	b := businessRegister(t)
	rec := b.addBusinessWithAsset(t, "Alpha Bakery", "")
	if rec.Code != http.StatusCreated {
		t.Fatalf("a row with no asset: %d %s, want 201", rec.Code, rec.Body.String())
	}
}

func TestLiveRecordRowsAssetPick_AnAssetIdDoesNotMakeARowVisibleToAPerson(t *testing.T) {
	b := businessRegister(t)
	asset := b.createAsset(t, "Mill pump")
	if rec := b.addBusinessWithAsset(t, "Alpha Bakery", asset); rec.Code != http.StatusCreated {
		t.Fatalf("adding: %d %s", rec.Code, rec.Body.String())
	}
	expectBusinesses(t, "rows naming the asset id as an actor filter", b.businessesOverHTTP(t, b.owner, url.Values{"answer_actor_id": {asset}}))
}
