package http

import (
	"context"
	"net/http"
	"testing"
	"time"

	mwanachamaactor "wakalaserver/modules/actor"

	"wakalaserver/internal/agencies"
)

func TestAttendanceTick_ResidentCannotDoTickAnotherResidentsAttendance(t *testing.T) {
	w := newStepRunWalk(t, nil)
	path := "/instances/" + w.instance
	ctx := context.Background()

	group := w.call(t, "POST", path+"/actor/groups", map[string]any{"name": "Elm street"}, w.owner)
	if group.Code != http.StatusCreated {
		t.Fatalf("create group: %d %s", group.Code, group.Body.String())
	}
	groupID, _ := decodeObject(t, group)["id"].(string)

	um, err := w.deps.Registry.ActorManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("ActorManager: %v", err)
	}
	neighbour := func(name string) (string, *http.Cookie) {
		actor, err := um.CreateActor(ctx, mwanachamaactor.Actor{DisplayName: name})
		if err != nil {
			t.Fatalf("CreateActor: %v", err)
		}
		if err := w.deps.Registry.AddMember(ctx, w.instance, actor.ID, agencies.RoleResident); err != nil {
			t.Fatalf("AddMember: %v", err)
		}
		if _, err := um.AssignGroup(ctx, mwanachamaactor.ActorGroupAssignment{ActorID: actor.ID, GroupID: groupID}); err != nil {
			t.Fatalf("AssignGroup: %v", err)
		}
		return actor.ID, w.cookieFor(t, actor.ID)
	}
	_, ada := neighbour("Ada")
	boID, _ := neighbour("Bo")

	start := time.Now().UTC().Truncate(time.Second)
	event := map[string]any{"kind": "event", "title": "Street cleanup", "group_ids": []string{groupID},
		"starts_at": start.Format(time.RFC3339), "ends_at": start.Add(time.Hour).Format(time.RFC3339), "time_zone": "UTC", "place": "Elm street"}
	created := w.call(t, "POST", path+"/engage/posts", event, w.owner)
	if created.Code != http.StatusCreated {
		t.Fatalf("owner posting an event: %d %s, want 201", created.Code, created.Body.String())
	}
	postID, _ := decodeObject(t, created)["id"].(string)
	tick := path + "/engage/posts/" + postID + "/attendance/" + boID

	if rec := w.call(t, "PUT", tick, nil, ada); rec.Code < 400 {
		t.Fatalf("resident ticking a neighbour's attendance: %d %s, want refused", rec.Code, rec.Body.String())
	}
	if rec := w.call(t, "PUT", tick, nil, w.owner); rec.Code != http.StatusOK {
		t.Fatalf("owner ticking the attendance: %d %s, want 200", rec.Code, rec.Body.String())
	}
}
