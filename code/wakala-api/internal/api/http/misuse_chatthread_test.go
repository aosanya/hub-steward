package http

import (
	"context"
	"net/http"
	"testing"

	mwanachamaactor "wakalaserver/modules/actor"

	"wakalaserver/internal/agencies"
)

func TestChatThread_GroupMemberCannotDoReadAnotherMembersPrivateThread(t *testing.T) {
	w := newStepRunWalk(t, nil)
	ctx := context.Background()

	groups := w.call(t, "GET", "/instances/"+w.instance+"/actor/groups", nil, w.owner)
	if groups.Code != http.StatusOK {
		t.Fatalf("owner lists groups: %d %s", groups.Code, groups.Body.String())
	}
	list := decodeObjects(t, groups)
	if len(list) == 0 {
		t.Fatalf("no group for a room")
	}
	groupID, _ := list[0]["id"].(string)

	um, err := w.deps.Registry.ActorManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	member := func(name string) *http.Cookie {
		actor, err := um.CreateActor(ctx, mwanachamaactor.Actor{DisplayName: name})
		if err != nil {
			t.Fatalf("CreateActor %s: %v", name, err)
		}
		if err := w.deps.Registry.AddMember(ctx, w.instance, actor.ID, agencies.RoleResident); err != nil {
			t.Fatalf("AddMember %s: %v", name, err)
		}
		if _, err := um.AssignGroup(ctx, mwanachamaactor.ActorGroupAssignment{ActorID: actor.ID, GroupID: groupID}); err != nil {
			t.Fatalf("AssignGroup %s: %v", name, err)
		}
		return w.cookieFor(t, actor.ID)
	}
	requester := member("Resident Wren")
	neighbour := member("Resident Lark")

	room := "/instances/" + w.instance + "/comm/groups/" + groupID + "/chat/threads"
	started := w.call(t, "POST", room, map[string]any{"label": "Rent arrears question"}, requester)
	if started.Code != http.StatusCreated && started.Code != http.StatusOK {
		t.Fatalf("requester starts a private thread: %d %s", started.Code, started.Body.String())
	}
	threadID, _ := decodeObject(t, started)["id"].(string)
	if threadID == "" {
		t.Fatalf("no thread id in %s", started.Body.String())
	}
	messages := room + "/" + threadID + "/messages"

	if rec := w.call(t, "GET", messages, nil, neighbour); rec.Code != http.StatusNotFound {
		t.Fatalf("other group member reading the private thread: %d %s, want 404", rec.Code, rec.Body.String())
	}

	if rec := w.call(t, "GET", messages, nil, requester); rec.Code != http.StatusOK {
		t.Fatalf("requester reading own private thread: %d %s, want 200", rec.Code, rec.Body.String())
	}
}
