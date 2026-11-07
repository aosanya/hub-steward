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

func TestOnlyThePosterPicksAndThePickerComesFromTheCaller(t *testing.T) {
	pm := newManager(t)
	pm.UseGroups(func(_ context.Context, id string) ([]string, error) {
		return map[string][]string{"p-1": {"g-1"}}[id], nil
	})
	ctx := context.Background()
	call, err := pm.CreatePost(ctx, engage.Post{Kind: "volunteer_call", Title: "Help", GroupIDs: []string{"g-1"}, Task: "Carry", StartsAt: "2030-06-01T09:00:00Z", NeededCount: 1, PostedBy: "poster"})
	if err != nil {
		t.Fatal(err)
	}
	offer, err := pm.OfferHelp(ctx, call.ID, "p-1")
	if err != nil {
		t.Fatal(err)
	}
	mux := http.NewServeMux()
	for _, rt := range routes.RoutesFor(pm, routes.Mount{Caller: callerFrom}) {
		mux.HandleFunc(rt.Pattern(""), rt.Handler)
	}
	as := func(caller string) int {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			mux.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), callerKey{}, caller)))
		}))
		defer srv.Close()
		raw, _ := json.Marshal(map[string]any{"offer_id": offer.ID, "picked_by": caller, "post_id": "other"})
		resp, err := http.Post(srv.URL+"/posts/"+call.ID+"/picks", "application/json", bytes.NewReader(raw))
		if err != nil {
			t.Fatal(err)
		}
		resp.Body.Close()
		return resp.StatusCode
	}
	if got := as("p-1"); got != http.StatusForbidden {
		t.Fatalf("a pick by someone else = %d, want 403", got)
	}
	if got := as("poster"); got != http.StatusCreated {
		t.Fatalf("a pick by the poster = %d, want 201", got)
	}
}

func TestWithdrawingTakesTheCallersOwnOfferOnly(t *testing.T) {
	pm := newManager(t)
	pm.UseGroups(func(_ context.Context, id string) ([]string, error) {
		return map[string][]string{"p-1": {"g-1"}, "p-2": {"g-1"}}[id], nil
	})
	ctx := context.Background()
	call, err := pm.CreatePost(ctx, engage.Post{Kind: "volunteer_call", Title: "Help", GroupIDs: []string{"g-1"}, Task: "Carry", StartsAt: "2030-06-01T09:00:00Z", NeededCount: 1, PostedBy: "poster"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := pm.OfferHelp(ctx, call.ID, "p-1"); err != nil {
		t.Fatal(err)
	}
	mux := http.NewServeMux()
	for _, rt := range routes.RoutesFor(pm, routes.Mount{Caller: callerFrom}) {
		mux.HandleFunc(rt.Pattern(""), rt.Handler)
	}
	as := func(caller string) int {
		req := httptest.NewRequest(http.MethodDelete, "/posts/"+call.ID+"/offers/mine", nil)
		req = req.WithContext(context.WithValue(req.Context(), callerKey{}, caller))
		rec := httptest.NewRecorder()
		mux.ServeHTTP(rec, req)
		return rec.Code
	}
	if got := as("p-2"); got != http.StatusNotFound {
		t.Fatalf("withdrawing as someone with no offer = %d, want 404", got)
	}
	if got := as("p-1"); got != http.StatusOK {
		t.Fatalf("withdrawing as the offerer = %d, want 200", got)
	}
}
