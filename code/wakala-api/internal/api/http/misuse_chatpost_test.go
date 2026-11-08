package http

import (
	"context"
	"net/http"
	"testing"

	mwanachamaactor "wakalaserver/modules/actor"

	"wakalaserver/internal/agencies"
)

func TestChatMessage_AgentWithoutChatPostCannotDoPostToGroupThread(t *testing.T) {
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
	actor, err := um.CreateActor(ctx, mwanachamaactor.Actor{DisplayName: "Resident Wren"})
	if err != nil {
		t.Fatalf("CreateActor: %v", err)
	}
	if err := w.deps.Registry.AddMember(ctx, w.instance, actor.ID, agencies.RoleResident); err != nil {
		t.Fatalf("AddMember resident: %v", err)
	}
	if _, err := um.AssignGroup(ctx, mwanachamaactor.ActorGroupAssignment{ActorID: actor.ID, GroupID: groupID}); err != nil {
		t.Fatalf("AssignGroup resident: %v", err)
	}
	resident := w.cookieFor(t, actor.ID)

	if err := w.deps.Registry.AddMember(ctx, w.instance, "agent-draft", agencies.RoleAgent); err != nil {
		t.Fatalf("AddMember agent: %v", err)
	}
	agent := w.cookieFor(t, "agent-draft")

	room := "/instances/" + w.instance + "/comm/groups/" + groupID + "/chat/threads"
	started := w.call(t, "POST", room, map[string]any{"label": "Ward notice"}, resident)
	if started.Code != http.StatusCreated && started.Code != http.StatusOK {
		t.Fatalf("resident starts a thread: %d %s", started.Code, started.Body.String())
	}
	threadID, _ := decodeObject(t, started)["id"].(string)
	if threadID == "" {
		t.Fatalf("no thread id in %s", started.Body.String())
	}
	messages := room + "/" + threadID + "/messages"

	if rec := w.call(t, "POST", messages, map[string]any{"body": "draft agent post"}, agent); rec.Code < 400 {
		t.Fatalf("agent without chat.post posting to the group thread: %d %s, want refused", rec.Code, rec.Body.String())
	}

	if rec := w.call(t, "POST", messages, map[string]any{"body": "resident post"}, resident); rec.Code != http.StatusCreated && rec.Code != http.StatusOK {
		t.Fatalf("seated resident posting to the group thread: %d %s, want admitted", rec.Code, rec.Body.String())
	}
}
