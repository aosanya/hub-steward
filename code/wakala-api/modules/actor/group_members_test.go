package mwanachamaactor_test

import (
	"context"
	"fmt"
	"testing"

	actor "wakalaserver/modules/actor"
)

func mustActor(t *testing.T, mgr actor.UserManager, name string) actor.Actor {
	t.Helper()
	a, err := mgr.CreateActor(context.Background(), actor.Actor{DisplayName: name})
	if err != nil {
		t.Fatalf("CreateActor: %v", err)
	}
	return a
}

func mustGroup(t *testing.T, mgr actor.UserManager, name string) actor.Group {
	t.Helper()
	g, err := mgr.CreateGroup(context.Background(), actor.Group{Name: name})
	if err != nil {
		t.Fatalf("CreateGroup: %v", err)
	}
	return g
}

func rosterOf(t *testing.T, mgr actor.UserManager, size int) (actor.Group, []string) {
	t.Helper()
	ctx := context.Background()
	g := mustGroup(t, mgr, "Ward A")
	ids := make([]string, 0, size)
	for i := 0; i < size; i++ {
		a := mustActor(t, mgr, fmt.Sprintf("Member %03d", i))
		if _, err := mgr.AssignGroup(ctx, actor.ActorGroupAssignment{ActorID: a.ID, GroupID: g.ID}); err != nil {
			t.Fatalf("AssignGroup: %v", err)
		}
		ids = append(ids, a.ID)
	}
	return g, ids
}

func TestAGroupsMembersComeByNameWithTheTotal(t *testing.T) {
	mgr := newManager(t)
	ctx := context.Background()
	g, _ := rosterOf(t, mgr, 200)
	other := mustGroup(t, mgr, "Ward B")
	stranger := mustActor(t, mgr, "Aaa Stranger")
	if _, err := mgr.AssignGroup(ctx, actor.ActorGroupAssignment{ActorID: stranger.ID, GroupID: other.ID}); err != nil {
		t.Fatalf("AssignGroup: %v", err)
	}

	page, err := mgr.ListGroupMembers(ctx, g.ID, 0, 3, "")
	if err != nil {
		t.Fatalf("ListGroupMembers: %v", err)
	}
	if page.Total != 200 {
		t.Fatalf("total = %d, want 200", page.Total)
	}
	for i, item := range page.Items {
		if want := fmt.Sprintf("Member %03d", i); item.DisplayName != want || item.ActorID == "" {
			t.Fatalf("item %d = %+v, want %q with an actor id", i, item, want)
		}
	}
	if len(page.Items) != 3 {
		t.Fatalf("items = %d, want 3", len(page.Items))
	}
}

func TestAGroupsMembersPageByOffset(t *testing.T) {
	mgr := newManager(t)
	g, _ := rosterOf(t, mgr, 120)

	page, err := mgr.ListGroupMembers(context.Background(), g.ID, 100, 50, "")
	if err != nil {
		t.Fatalf("ListGroupMembers: %v", err)
	}
	if len(page.Items) != 20 || page.Items[0].DisplayName != "Member 100" || page.Items[19].DisplayName != "Member 119" || page.Total != 120 {
		t.Fatalf("page = %d items from %q, total %d, want the last 20 from Member 100 of 120", len(page.Items), page.Items[0].DisplayName, page.Total)
	}
}

func TestAGroupsMembersSearchCountsOnlyTheMatches(t *testing.T) {
	mgr := newManager(t)
	g, _ := rosterOf(t, mgr, 120)

	page, err := mgr.ListGroupMembers(context.Background(), g.ID, 0, 5, "member 05")
	if err != nil {
		t.Fatalf("ListGroupMembers: %v", err)
	}
	if page.Total != 10 || len(page.Items) != 5 || page.Items[0].DisplayName != "Member 050" {
		t.Fatalf("search = %d items first %q, total %d, want 5 items from Member 050 of 10", len(page.Items), page.Items[0].DisplayName, page.Total)
	}
}

func TestAGroupsMembersAreCappedAndAnUnknownGroupIsEmpty(t *testing.T) {
	mgr := newManager(t)
	g, _ := rosterOf(t, mgr, actor.MaxRosterPageSize+5)

	page, err := mgr.ListGroupMembers(context.Background(), g.ID, 0, 10000, "")
	if err != nil || len(page.Items) != actor.MaxRosterPageSize || page.Total != actor.MaxRosterPageSize+5 {
		t.Fatalf("page = %d items, total %d, err %v, want the cap of %d of %d", len(page.Items), page.Total, err, actor.MaxRosterPageSize, actor.MaxRosterPageSize+5)
	}
	none, err := mgr.ListGroupMembers(context.Background(), "no-such-group", 0, 3, "")
	if err != nil || len(none.Items) != 0 || none.Total != 0 {
		t.Fatalf("unknown group = %+v, err %v, want empty", none, err)
	}
}
