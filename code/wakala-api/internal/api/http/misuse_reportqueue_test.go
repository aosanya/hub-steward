package http

import (
	"context"
	"net/http"
	"testing"

	mwanachamaactor "wakalaserver/modules/actor"

	"wakalaserver/internal/agencies"
)

func TestReportQueue_ResidentCannotDoReadAGroupsModerationQueue(t *testing.T) {
	w := newStepRunWalk(t, nil)
	ctx := context.Background()
	path := "/instances/" + w.instance

	group := w.call(t, "POST", path+"/actor/groups", map[string]any{"name": "Elm street"}, w.owner)
	if group.Code != http.StatusCreated {
		t.Fatalf("create group: %d %s", group.Code, group.Body.String())
	}
	groupID, _ := decodeObject(t, group)["id"].(string)

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

	queue := path + "/comm/groups/" + groupID + "/moderation/reports"
	if rec := w.call(t, "GET", queue, nil, resident); rec.Code < 400 {
		t.Fatalf("resident reading the group's moderation queue: %d %s, want refused", rec.Code, rec.Body.String())
	}

	if rec := w.call(t, "GET", queue, nil, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("owner reading the group's moderation queue: %d %s, want 200", rec.Code, rec.Body.String())
	}
}
