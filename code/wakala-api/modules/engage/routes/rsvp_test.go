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

func TestTheResponderComesFromTheCallerAndTheEventFromTheAddress(t *testing.T) {
	pm := newManager(t)
	pm.UseGroups(func(_ context.Context, id string) ([]string, error) {
		return map[string][]string{"p-1": {"g-1"}}[id], nil
	})
	ev, err := pm.CreatePost(context.Background(), engage.Post{Kind: "event", Title: "Meet", GroupIDs: []string{"g-1"}, StartsAt: "2099-01-01T08:00:00Z", EndsAt: "2099-01-01T09:00:00Z", PostedBy: "poster"})
	if err != nil {
		t.Fatal(err)
	}
	mux := http.NewServeMux()
	for _, rt := range routes.RoutesFor(pm, routes.Mount{Caller: callerFrom}) {
		mux.HandleFunc(rt.Pattern(""), rt.Handler)
	}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mux.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), callerKey{}, "p-1")))
	}))
	defer srv.Close()
	raw, _ := json.Marshal(map[string]any{"answer": "going", "participant_id": "someone-else", "post_id": "other"})
	req, _ := http.NewRequest(http.MethodPut, srv.URL+"/posts/"+ev.ID+"/rsvp", bytes.NewReader(raw))
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	var got map[string]any
	_ = json.NewDecoder(resp.Body).Decode(&got)
	if resp.StatusCode != http.StatusOK || got["participant_id"] != "p-1" || got["post_id"] != ev.ID {
		t.Fatalf("status %d, body %v", resp.StatusCode, got)
	}
}
