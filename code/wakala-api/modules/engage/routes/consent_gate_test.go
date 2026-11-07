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
	"wakalaserver/modules/shared/consent"
)

type gateFor map[string]error

func (g gateFor) Check(_ context.Context, actorID string) error { return g[actorID] }

func TestAnAnswerWithoutLiveConsentIsRefusedWith403(t *testing.T) {
	pm := newManager(t)
	pm.UseGroups(func(_ context.Context, id string) ([]string, error) { return []string{"g-1"}, nil })
	pm.UseConsentGate(gateFor{"p-2": consent.ErrRequired, "p-3": consent.ErrWithdrawn})
	ev, err := pm.CreatePost(context.Background(), engage.Post{Kind: "event", Title: "Meet", GroupIDs: []string{"g-1"}, StartsAt: "2099-01-01T08:00:00Z", EndsAt: "2099-01-01T09:00:00Z", PostedBy: "poster"})
	if err != nil {
		t.Fatal(err)
	}
	mux := http.NewServeMux()
	for _, rt := range routes.RoutesFor(pm, routes.Mount{Caller: callerFrom}) {
		mux.HandleFunc(rt.Pattern(""), rt.Handler)
	}
	answer := func(caller string) (int, string) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			mux.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), callerKey{}, caller)))
		}))
		defer srv.Close()
		raw, _ := json.Marshal(map[string]any{"answer": "going"})
		req, _ := http.NewRequest(http.MethodPut, srv.URL+"/posts/"+ev.ID+"/rsvp", bytes.NewReader(raw))
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer resp.Body.Close()
		var out map[string]any
		_ = json.NewDecoder(resp.Body).Decode(&out)
		msg, _ := out["error"].(string)
		return resp.StatusCode, msg
	}
	if status, _ := answer("p-1"); status != http.StatusOK {
		t.Fatalf("consenting answer status = %d, want 200", status)
	}
	for _, caller := range []string{"p-2", "p-3"} {
		if status, msg := answer(caller); status != http.StatusForbidden {
			t.Fatalf("%s answer status = %d (%s), want 403", caller, status, msg)
		}
	}
}
