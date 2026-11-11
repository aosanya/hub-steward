package http

import (
	"context"
	"net/http"
	"strings"
	"testing"

	mwanachamaactor "wakalaserver/modules/actor"

	"wakalaserver/internal/agencies"
)

func TestGroupJoin_RemovedMemberCannotBeSeatedFromAPendingRequest(t *testing.T) {
	w := newStepRunWalk(t, nil)
	ctx := context.Background()
	path := "/instances/" + w.instance

	group := w.call(t, "POST", path+"/actor/groups", map[string]any{"name": "Garden circle"}, w.owner)
	if group.Code != http.StatusCreated {
		t.Fatalf("create group: %d %s", group.Code, group.Body.String())
	}
	groupID, _ := decodeObject(t, group)["id"].(string)

	um, err := w.deps.Registry.ActorManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	resident := func(name string) (string, *http.Cookie) {
		actor, err := um.CreateActor(ctx, mwanachamaactor.Actor{DisplayName: name})
		if err != nil {
			t.Fatalf("CreateActor %s: %v", name, err)
		}
		if err := w.deps.Registry.AddMember(ctx, w.instance, actor.ID, agencies.RoleResident); err != nil {
			t.Fatalf("AddMember %s: %v", name, err)
		}
		return actor.ID, w.cookieFor(t, actor.ID)
	}
	ask := func(as *http.Cookie) string {
		rec := w.call(t, "POST", path+"/actor/groups/"+groupID+"/join", map[string]any{}, as)
		if rec.Code >= 300 {
			t.Fatalf("ask to join group: %d %s", rec.Code, rec.Body.String())
		}
		out := decodeObject(t, rec)
		req, _ := out["request"].(map[string]any)
		id, _ := req["id"].(string)
		if id == "" {
			t.Fatalf("ask to join group returned no request id: %s", rec.Body.String())
		}
		return id
	}
	roster := func() string {
		rec := w.call(t, "GET", path+"/actor/groups/"+groupID+"/assignments", nil, w.owner)
		if rec.Code != http.StatusOK {
			t.Fatalf("group roster: %d %s", rec.Code, rec.Body.String())
		}
		return rec.Body.String()
	}

	keptID, kept := resident("resident-kept-kim")
	keptReq := ask(kept)
	if rec := w.call(t, "POST", path+"/actor/join-requests/"+keptReq+"/operator-approve", map[string]any{}, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("owner approving a current member's request: %d %s, want 200", rec.Code, rec.Body.String())
	}
	if !strings.Contains(roster(), keptID) {
		t.Fatalf("approved current member %s missing from roster: %s", keptID, roster())
	}

	goneID, gone := resident("resident-gone-gus")
	goneReq := ask(gone)
	if rec := w.call(t, "DELETE", path+"/members/"+goneID, nil, w.owner); rec.Code >= 300 {
		t.Fatalf("owner removing resident: %d %s", rec.Code, rec.Body.String())
	}
	rec := w.call(t, "POST", path+"/actor/join-requests/"+goneReq+"/operator-approve", map[string]any{}, w.owner)
	if rec.Code < 400 {
		t.Errorf("owner approving a removed member's pending group request: %d %s, want refused (4xx) or request cancelled", rec.Code, rec.Body.String())
	}
	if list := roster(); strings.Contains(list, goneID) {
		t.Errorf("removed member %s seated in group roster: %s", goneID, list)
	}
}
