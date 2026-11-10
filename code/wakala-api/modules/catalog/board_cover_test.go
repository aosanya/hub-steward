package mwanachamacatalog_test

import (
	"context"
	"errors"
	"testing"

	catalog "wakalaserver/modules/catalog"
)

func raise(t *testing.T, cm catalog.CatalogManager, title string, publishable bool) catalog.RaisedItem {
	t.Helper()
	r, err := cm.RaiseItem(context.Background(), catalog.RaisedItem{Title: title, Topic: "Roads", RaisedBy: "resident-1", Publishable: publishable})
	if err != nil {
		t.Fatalf("RaiseItem %q: %v", title, err)
	}
	return r
}

func TestABoardItemGroupsOnlyPublishableRaisedItemsAndStartsOpenAndUnassigned(t *testing.T) {
	cm := entryManager(t)
	ctx := context.Background()
	b, err := cm.PutOnBoard(ctx, catalog.BoardItem{Title: "Potholes on Mill Road", AssigneeKind: "actor", AssigneeID: "sneaky", ClosedAt: "2020-01-01T00:00:00Z", ClosedBy: "sneaky"})
	if err != nil {
		t.Fatal(err)
	}
	if b.ID == "" || b.AssigneeKind != "" || b.AssigneeID != "" || b.ClosedAt != "" || b.ClosedBy != "" {
		t.Fatalf("a board item arrived assigned or closed: %+v", b)
	}
	if _, err := cm.PutOnBoard(ctx, catalog.BoardItem{Title: ""}); !errors.Is(err, catalog.ErrInvalidBoardItem) {
		t.Fatalf("got %v", err)
	}
	private := raise(t, cm, "Pothole outside my door", false)
	public := raise(t, cm, "Pothole at the school", true)
	if err := cm.GroupUnderBoardItem(ctx, private.ID, b.ID); !errors.Is(err, catalog.ErrRaisedItemNotPublishable) {
		t.Fatalf("a private report was put on the public board: %v", err)
	}
	for _, c := range []struct {
		name         string
		raised, item string
		want         error
	}{
		{"no raised item named", "", b.ID, catalog.ErrInvalidBoardItem},
		{"no board item named", public.ID, "", catalog.ErrInvalidBoardItem},
		{"a board item that is not there", public.ID, "nowhere", catalog.ErrBoardItemNotFound},
		{"a raised item that is not there", "nowhere", b.ID, catalog.ErrRaisedItemNotFound},
	} {
		if err := cm.GroupUnderBoardItem(ctx, c.raised, c.item); !errors.Is(err, c.want) {
			t.Fatalf("%s: got %v", c.name, err)
		}
	}
	if err := cm.GroupUnderBoardItem(ctx, public.ID, b.ID); err != nil {
		t.Fatal(err)
	}
}

func TestTheBoardCountsWhoRaisedAndHidesWhatNobodyPublishedAndWhatWasHidden(t *testing.T) {
	cm := entryManager(t)
	ctx := context.Background()
	first, _ := cm.PutOnBoard(ctx, catalog.BoardItem{Title: "Potholes"})
	second, _ := cm.PutOnBoard(ctx, catalog.BoardItem{Title: "Street lights"})
	if _, err := cm.PutOnBoard(ctx, catalog.BoardItem{Title: "Nothing yet"}); err != nil {
		t.Fatal(err)
	}
	a, b, c := raise(t, cm, "Hole one", true), raise(t, cm, "Hole two", true), raise(t, cm, "Lamp out", true)
	for _, g := range []struct{ raised, item string }{{a.ID, first.ID}, {b.ID, first.ID}, {c.ID, second.ID}} {
		if err := cm.GroupUnderBoardItem(ctx, g.raised, g.item); err != nil {
			t.Fatal(err)
		}
	}
	staff, err := cm.ListBoardItems(ctx)
	if err != nil || len(staff) != 3 {
		t.Fatalf("%+v %v", staff, err)
	}
	if staff[0].Title != "Potholes" || staff[0].RaisedBy != 2 || staff[1].RaisedBy != 1 || staff[2].RaisedBy != 0 {
		t.Fatalf("%+v", staff)
	}
	public, err := cm.ListPublicBoardItems(ctx, 0, 0)
	if err != nil || len(public) != 2 {
		t.Fatalf("an empty board item was shown publicly: %+v %v", public, err)
	}
	page, err := cm.ListPublicBoardItems(ctx, 1, 1)
	if err != nil || len(page) != 1 || page[0].Title != "Street lights" {
		t.Fatalf("%+v %v", page, err)
	}
	past, err := cm.ListPublicBoardItems(ctx, 10, 5)
	if err != nil || len(past) != 0 {
		t.Fatalf("%+v %v", past, err)
	}
	negative, err := cm.ListPublicBoardItems(ctx, 10, -3)
	if err != nil || len(negative) != 2 {
		t.Fatalf("%+v %v", negative, err)
	}
	if err := cm.SetBoardItemHidden(ctx, first.ID, true); err != nil {
		t.Fatal(err)
	}
	if staff, _ := cm.ListBoardItems(ctx); len(staff) != 2 {
		t.Fatalf("a hidden item stayed on the board: %+v", staff)
	}
	if err := cm.SetBoardItemHidden(ctx, "nowhere", true); !errors.Is(err, catalog.ErrBoardItemNotFound) {
		t.Fatalf("got %v", err)
	}
	if err := cm.SetBoardItemHidden(ctx, "", true); !errors.Is(err, catalog.ErrInvalidBoardItem) {
		t.Fatalf("got %v", err)
	}
}

func TestAnOutcomeAndAnUngroupChangeWhatTheBoardShowsAndRefuseWhatIsNotThere(t *testing.T) {
	cm := entryManager(t)
	ctx := context.Background()
	b, _ := cm.PutOnBoard(ctx, catalog.BoardItem{Title: "Potholes"})
	r := raise(t, cm, "Hole one", true)
	if err := cm.GroupUnderBoardItem(ctx, r.ID, b.ID); err != nil {
		t.Fatal(err)
	}
	if err := cm.SetBoardItemOutcome(ctx, b.ID, "Resurfaced in June"); err != nil {
		t.Fatal(err)
	}
	if err := cm.SetBoardItemOutcome(ctx, "nowhere", "x"); !errors.Is(err, catalog.ErrBoardItemNotFound) {
		t.Fatalf("got %v", err)
	}
	if err := cm.SetBoardItemOutcome(ctx, "", "x"); !errors.Is(err, catalog.ErrInvalidBoardItem) {
		t.Fatalf("got %v", err)
	}
	board, _ := cm.ListBoardItems(ctx)
	if len(board) != 1 || board[0].Outcome != "Resurfaced in June" || board[0].RaisedBy != 1 {
		t.Fatalf("%+v", board)
	}
	shared, err := cm.OpenSharedBoardItem(ctx, b.ID)
	if err != nil || shared.Title != "Potholes" || shared.Status != "Resurfaced in June" || shared.Theme != "Roads" {
		t.Fatalf("%+v %v", shared, err)
	}
	if err := cm.UngroupFromBoardItem(ctx, r.ID); err != nil {
		t.Fatal(err)
	}
	if err := cm.UngroupFromBoardItem(ctx, "nowhere"); !errors.Is(err, catalog.ErrRaisedItemNotFound) {
		t.Fatalf("got %v", err)
	}
	if err := cm.UngroupFromBoardItem(ctx, ""); !errors.Is(err, catalog.ErrInvalidBoardItem) {
		t.Fatalf("got %v", err)
	}
	if _, err := cm.OpenSharedBoardItem(ctx, b.ID); !errors.Is(err, catalog.ErrBoardItemNotFound) {
		t.Fatalf("an item with nobody grouped under it was shared: %v", err)
	}
}

func TestASharedBoardItemOpensByItsKeyOnlyWhileItIsShownAndHasPublicReports(t *testing.T) {
	cm := entryManager(t)
	ctx := context.Background()
	b, _ := cm.PutOnBoard(ctx, catalog.BoardItem{Title: "Potholes"})
	r := raise(t, cm, "Hole one", true)
	if _, err := cm.OpenSharedBoardItem(ctx, ""); !errors.Is(err, catalog.ErrBoardItemNotFound) {
		t.Fatalf("got %v", err)
	}
	if _, err := cm.OpenSharedBoardItem(ctx, "nowhere"); !errors.Is(err, catalog.ErrBoardItemNotFound) {
		t.Fatalf("got %v", err)
	}
	if err := cm.GroupUnderBoardItem(ctx, r.ID, b.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := cm.OpenSharedBoardItem(ctx, b.ID); err != nil {
		t.Fatal(err)
	}
	if err := cm.SetBoardItemHidden(ctx, b.ID, true); err != nil {
		t.Fatal(err)
	}
	if _, err := cm.OpenSharedBoardItem(ctx, b.ID); !errors.Is(err, catalog.ErrBoardItemNotFound) {
		t.Fatalf("a hidden item was shared: %v", err)
	}
}

func TestABoardItemIsAssignedToAnActorOrARoleAndNothingChangesOnceItIsClosed(t *testing.T) {
	cm := entryManager(t)
	ctx := context.Background()
	b, _ := cm.PutOnBoard(ctx, catalog.BoardItem{Title: "Potholes"})
	for _, c := range []struct {
		name         string
		item, kind   string
		assignee     string
		wantInvalid  bool
		wantNotFound bool
	}{
		{"no item", "", "actor", "u1", true, false},
		{"a kind nobody declared", b.ID, "team", "u1", true, false},
		{"no assignee", b.ID, "actor", "", true, false},
		{"an item that is not there", "nowhere", "actor", "u1", false, true},
	} {
		err := cm.AssignBoardItem(ctx, c.item, c.kind, c.assignee)
		if c.wantInvalid && !errors.Is(err, catalog.ErrInvalidBoardItem) || c.wantNotFound && !errors.Is(err, catalog.ErrBoardItemNotFound) {
			t.Fatalf("%s: got %v", c.name, err)
		}
	}
	if err := cm.AssignBoardItem(ctx, b.ID, "actor", "u1"); err != nil {
		t.Fatal(err)
	}
	if err := cm.AssignBoardItem(ctx, b.ID, "role", "works-crew"); err != nil {
		t.Fatalf("a reassignment: %v", err)
	}
	if err := cm.UnassignBoardItem(ctx, b.ID); err != nil {
		t.Fatal(err)
	}
	if err := cm.UnassignBoardItem(ctx, "nowhere"); !errors.Is(err, catalog.ErrBoardItemNotFound) {
		t.Fatalf("got %v", err)
	}
	if err := cm.UnassignBoardItem(ctx, ""); !errors.Is(err, catalog.ErrInvalidBoardItem) {
		t.Fatalf("got %v", err)
	}
	if err := cm.CloseBoardItem(ctx, b.ID, ""); !errors.Is(err, catalog.ErrInvalidBoardItem) {
		t.Fatalf("got %v", err)
	}
	if err := cm.CloseBoardItem(ctx, "nowhere", "clerk"); !errors.Is(err, catalog.ErrBoardItemNotFound) {
		t.Fatalf("got %v", err)
	}
	if err := cm.CloseBoardItem(ctx, b.ID, "clerk"); err != nil {
		t.Fatal(err)
	}
	if err := cm.CloseBoardItem(ctx, b.ID, "clerk"); !errors.Is(err, catalog.ErrBoardItemClosed) {
		t.Fatalf("a second close: %v", err)
	}
	if err := cm.AssignBoardItem(ctx, b.ID, "actor", "u2"); !errors.Is(err, catalog.ErrBoardItemClosed) {
		t.Fatalf("a closed item was reassigned: %v", err)
	}
}
