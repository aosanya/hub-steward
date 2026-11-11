package routes_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	engage "wakalaserver/modules/engage"
	"wakalaserver/modules/engage/routes"
)

func sendAs(t *testing.T, pm engage.PostManager, caller, method, path string, body map[string]any) (int, map[string]any) {
	t.Helper()
	mux := http.NewServeMux()
	for _, rt := range routes.RoutesFor(pm, routes.Mount{Caller: callerFrom}) {
		mux.HandleFunc(rt.Pattern(""), rt.Handler)
	}
	raw, _ := json.Marshal(body)
	req := httptest.NewRequest(method, path, bytes.NewReader(raw))
	req = req.WithContext(context.WithValue(req.Context(), callerKey{}, caller))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)
	var out map[string]any
	_ = json.NewDecoder(rec.Body).Decode(&out)
	return rec.Code, out
}

func aVolunteerCallWithOneOffer(t *testing.T) (engage.PostManager, engage.Post, engage.Offer) {
	t.Helper()
	pm := newManager(t)
	pm.UseGroups(func(_ context.Context, id string) ([]string, error) {
		return map[string][]string{"p-1": {"g-1"}}[id], nil
	})
	call, err := pm.CreatePost(context.Background(), engage.Post{Kind: "volunteer_call", Title: "Help", GroupIDs: []string{"g-1"}, Task: "Carry", StartsAt: "2030-06-01T09:00:00Z", NeededCount: 1, PostedBy: "poster"})
	if err != nil {
		t.Fatal(err)
	}
	offer, err := pm.OfferHelp(context.Background(), call.ID, "p-1")
	if err != nil {
		t.Fatal(err)
	}
	return pm, call, offer
}

func TestAForgedPickerCannotStandInForThePoster(t *testing.T) {
	pm, call, offer := aVolunteerCallWithOneOffer(t)
	code, _ := sendAs(t, pm, "p-1", http.MethodPost, "/posts/"+call.ID+"/picks", map[string]any{"offer_id": offer.ID, "picked_by": "poster"})
	if code != http.StatusForbidden {
		t.Fatalf("a pick by p-1 naming the poster in the body = %d, want 403", code)
	}
}

func TestThePickerOnRecordIsTheCallerNotTheBody(t *testing.T) {
	pm, call, offer := aVolunteerCallWithOneOffer(t)
	code, got := sendAs(t, pm, "poster", http.MethodPost, "/posts/"+call.ID+"/picks", map[string]any{"offer_id": offer.ID, "picked_by": "someone-else"})
	pick, _ := got["pick"].(map[string]any)
	if code != http.StatusCreated || pick["picked_by"] != "poster" {
		t.Fatalf("pick = %d %v, want 201 with picked_by poster", code, got)
	}
}

func TestAForgedChangerCannotStandInForTheSession(t *testing.T) {
	pm := newManager(t)
	ev, err := pm.CreatePost(context.Background(), engage.Post{Kind: "event", Title: "Meet", GroupIDs: []string{"g-1"}, StartsAt: "2099-01-01T08:00:00Z", EndsAt: "2099-01-01T09:00:00Z", PostedBy: "poster"})
	if err != nil {
		t.Fatal(err)
	}
	code, _ := sendAs(t, pm, "", http.MethodPatch, "/posts/"+ev.ID+"/event", map[string]any{"place": "Back alley", "changed_by": "poster"})
	if code != http.StatusUnauthorized {
		t.Fatalf("a change with no session naming the poster in the body = %d, want 401", code)
	}
	after, err := pm.GetPost(context.Background(), ev.ID)
	if err != nil {
		t.Fatal(err)
	}
	if after.Place == "Back alley" {
		t.Fatalf("the event was changed without a session")
	}
}
