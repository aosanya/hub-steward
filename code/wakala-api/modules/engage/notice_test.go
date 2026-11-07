package engage_test

import (
	"context"
	"errors"
	"testing"

	engage "wakalaserver/modules/engage"
)

func groupsFixed(byCaller map[string][]string) engage.Groups {
	return func(_ context.Context, callerID string) ([]string, error) { return byCaller[callerID], nil }
}

func aNoticeTo(groups ...string) engage.Post {
	return engage.Post{Kind: "notice", Title: "Water off", GroupIDs: groups, PostedBy: "poster"}
}

func TestUnreadCountsSentNoticesToTheCallersGroupsUntilRead(t *testing.T) {
	ctx := context.Background()
	pm := newTestManager(t)
	pm.UseGroups(groupsFixed(map[string][]string{"p-1": {"g-1", "g-2"}}))
	a, _ := pm.CreatePost(ctx, aNoticeTo("g-1"))
	if _, err := pm.CreatePost(ctx, aNoticeTo("g-2", "g-1")); err != nil {
		t.Fatal(err)
	}
	if _, err := pm.CreatePost(ctx, aNoticeTo("g-9")); err != nil {
		t.Fatal(err)
	}
	if _, err := pm.CreatePost(ctx, anEvent()); err != nil {
		t.Fatal(err)
	}
	got, err := pm.CountUnread(ctx, "p-1")
	if err != nil || got.Count != 2 {
		t.Fatalf("CountUnread = %+v, %v; want 2", got, err)
	}
	first, err := pm.MarkRead(ctx, a.ID, "p-1")
	if err != nil {
		t.Fatalf("MarkRead: %v", err)
	}
	again, err := pm.MarkRead(ctx, a.ID, "p-1")
	if err != nil || again.ID != first.ID || again.ReadAt != first.ReadAt {
		t.Fatalf("second MarkRead = %+v, %v; want the first marker", again, err)
	}
	if got, _ := pm.CountUnread(ctx, "p-1"); got.Count != 1 {
		t.Fatalf("after reading, count = %d, want 1", got.Count)
	}
}

func TestAMountWithNoGroupsCountsNothing(t *testing.T) {
	ctx := context.Background()
	pm := newTestManager(t)
	if _, err := pm.CreatePost(ctx, aNoticeTo("g-1")); err != nil {
		t.Fatal(err)
	}
	if got, err := pm.CountUnread(ctx, "p-1"); err != nil || got.Count != 0 {
		t.Fatalf("CountUnread = %+v, %v; want 0", got, err)
	}
}

func TestMarkingReadIsRefusedWhereItDoesNotHold(t *testing.T) {
	ctx := context.Background()
	pm := newTestManager(t)
	pm.UseGroups(groupsFixed(map[string][]string{"p-1": {"g-1"}}))
	n, _ := pm.CreatePost(ctx, aNoticeTo("g-1"))
	other, _ := pm.CreatePost(ctx, aNoticeTo("g-9"))
	ev, _ := pm.CreatePost(ctx, anEvent())
	if _, err := pm.MarkRead(ctx, n.ID, ""); !errors.Is(err, engage.ErrNoReader) {
		t.Errorf("no caller: err = %v", err)
	}
	if _, err := pm.MarkRead(ctx, other.ID, "p-1"); !errors.Is(err, engage.ErrPostNotFound) {
		t.Errorf("another group's notice: err = %v, want ErrPostNotFound", err)
	}
	if _, err := pm.MarkRead(ctx, ev.ID, "p-1"); !errors.Is(err, engage.ErrNotANotice) {
		t.Errorf("an event: err = %v, want ErrNotANotice", err)
	}
}
