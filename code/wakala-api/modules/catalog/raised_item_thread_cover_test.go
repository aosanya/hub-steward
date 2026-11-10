package mwanachamacatalog_test

import (
	"context"
	"errors"
	"testing"

	catalog "wakalaserver/modules/catalog"
)

func TestARaisedItemTakesRepliesInOrderAndOnlyItsRaiserReadsThemAsTheirOwn(t *testing.T) {
	cm := entryManager(t)
	ctx := context.Background()
	item := raise(t, cm, "Broken light", true)

	first, err := cm.ReplyToRaisedItem(ctx, catalog.Reply{RaisedItemID: item.ID, Body: "We have logged it", RepliedBy: "clerk-1"})
	if err != nil || first.ID == "" || first.CreatedAt == "" {
		t.Fatalf("reply: %+v %v", first, err)
	}
	if _, err := cm.ReplyToRaisedItem(ctx, catalog.Reply{RaisedItemID: item.ID, Body: "A crew is booked", RepliedBy: "clerk-2"}); err != nil {
		t.Fatal(err)
	}

	all, err := cm.ListReplies(ctx, item.ID)
	if err != nil || len(all) != 2 {
		t.Fatalf("replies: %+v %v", all, err)
	}
	if all[0].CreatedAt > all[1].CreatedAt {
		t.Fatalf("replies are not oldest first: %+v", all)
	}

	mine, err := cm.ListMyReplies(ctx, item.ID, "resident-1")
	if err != nil || len(mine) != 2 {
		t.Fatalf("the raiser reads their replies: %+v %v", mine, err)
	}
	if _, err := cm.ListMyReplies(ctx, item.ID, "resident-9"); !errors.Is(err, catalog.ErrRaisedItemNotFound) {
		t.Fatalf("someone else read another's replies: %v", err)
	}
	if _, err := cm.ListMyReplies(ctx, item.ID, ""); !errors.Is(err, catalog.ErrRaisedItemNotFound) {
		t.Fatalf("an unnamed caller read replies: %v", err)
	}
}

func TestARepliesIsRefusedWithoutABodyARepliesOrAnItemThatIsThere(t *testing.T) {
	cm := entryManager(t)
	ctx := context.Background()
	item := raise(t, cm, "Broken light", true)

	if _, err := cm.ReplyToRaisedItem(ctx, catalog.Reply{RaisedItemID: item.ID, Body: "", RepliedBy: "clerk-1"}); !errors.Is(err, catalog.ErrInvalidReply) {
		t.Fatalf("an empty reply was taken: %v", err)
	}
	if _, err := cm.ReplyToRaisedItem(ctx, catalog.Reply{RaisedItemID: item.ID, Body: "Hello", RepliedBy: ""}); !errors.Is(err, catalog.ErrInvalidReply) {
		t.Fatalf("a reply from nobody was taken: %v", err)
	}
	if _, err := cm.ReplyToRaisedItem(ctx, catalog.Reply{RaisedItemID: "no-such-item", Body: "Hello", RepliedBy: "clerk-1"}); !errors.Is(err, catalog.ErrRaisedItemNotFound) {
		t.Fatalf("a reply to nothing was taken: %v", err)
	}
	if _, err := cm.ListReplies(ctx, ""); !errors.Is(err, catalog.ErrInvalidReply) {
		t.Fatalf("replies of no item were listed: %v", err)
	}
	if _, err := cm.ListMyReplies(ctx, "", "resident-1"); !errors.Is(err, catalog.ErrInvalidReply) {
		t.Fatalf("my replies of no item were listed: %v", err)
	}
}

func TestARaisedItemIsRemovedOnceWithAGroundAndStopsBeingPublishable(t *testing.T) {
	cm := entryManager(t)
	ctx := context.Background()
	item := raise(t, cm, "Noisy bar", true)

	gone, err := cm.RemoveRaisedItem(ctx, catalog.Removal{RaisedItemID: item.ID, Ground: "Names a private person", RemovedBy: "moderator-1"})
	if err != nil || gone.ID == "" || gone.CreatedAt == "" {
		t.Fatalf("removal: %+v %v", gone, err)
	}
	if _, err := cm.RemoveRaisedItem(ctx, catalog.Removal{RaisedItemID: item.ID, Ground: "Again", RemovedBy: "moderator-2"}); !errors.Is(err, catalog.ErrRaisedItemAlreadyRemoved) {
		t.Fatalf("an item was removed twice: %v", err)
	}

	mine, err := cm.ListRemovalsOfMine(ctx, "resident-1")
	if err != nil || len(mine) != 1 || mine[0].RaisedItemID != item.ID || mine[0].Ground != "Names a private person" {
		t.Fatalf("the raiser's removals: %+v %v", mine, err)
	}
	if none, err := cm.ListRemovalsOfMine(ctx, "resident-9"); err != nil || len(none) != 0 {
		t.Fatalf("someone else saw removals: %+v %v", none, err)
	}
	if _, err := cm.ListRemovalsOfMine(ctx, ""); !errors.Is(err, catalog.ErrInvalidRemoval) {
		t.Fatalf("removals of nobody were listed: %v", err)
	}
}

func TestARemovalNeedsAGroundARemoverAndAnItemThatIsThere(t *testing.T) {
	cm := entryManager(t)
	ctx := context.Background()
	item := raise(t, cm, "Noisy bar", true)

	for name, r := range map[string]catalog.Removal{
		"no ground":  {RaisedItemID: item.ID, Ground: "  ", RemovedBy: "moderator-1"},
		"no remover": {RaisedItemID: item.ID, Ground: "Rude", RemovedBy: ""},
	} {
		if _, err := cm.RemoveRaisedItem(ctx, r); !errors.Is(err, catalog.ErrInvalidRemoval) {
			t.Fatalf("%s: removal was taken: %v", name, err)
		}
	}
	if _, err := cm.RemoveRaisedItem(ctx, catalog.Removal{RaisedItemID: "no-such-item", Ground: "Rude", RemovedBy: "moderator-1"}); !errors.Is(err, catalog.ErrRaisedItemNotFound) {
		t.Fatalf("an item that is not there was removed: %v", err)
	}
}

func TestAFileAttachedToARaisedItemIsApprovedWithdrawnAndOnlyDetachedWhileUnapproved(t *testing.T) {
	cm := entryManager(t)
	ctx := context.Background()
	item := raise(t, cm, "Photo of the pothole", true)

	files, err := cm.AttachFiles(ctx, item.ID, "resident-1", []string{"file-a", "file-b", "file-a"})
	if err != nil || len(files) != 2 {
		t.Fatalf("attach, with one id repeated: %+v %v", files, err)
	}
	again, err := cm.AttachFiles(ctx, item.ID, "resident-1", []string{"file-a"})
	if err != nil || len(again) != 2 {
		t.Fatalf("attaching a file twice made a second row: %+v %v", again, err)
	}

	approved, err := cm.ApproveFileForPublishing(ctx, item.ID, "file-a", "moderator-1")
	if err != nil || !approved.ApprovedForPublishing() || approved.ApprovedBy != "moderator-1" {
		t.Fatalf("approve: %+v %v", approved, err)
	}
	same, err := cm.ApproveFileForPublishing(ctx, item.ID, "file-a", "moderator-2")
	if err != nil || same.ApprovedBy != "moderator-1" {
		t.Fatalf("a second approval replaced the first: %+v %v", same, err)
	}

	if err := cm.DetachFile(ctx, item.ID, "resident-1", "file-a"); !errors.Is(err, catalog.ErrAttachmentApproved) {
		t.Fatalf("an approved file was detached: %v", err)
	}
	if err := cm.DetachFile(ctx, item.ID, "resident-1", "file-b"); err != nil {
		t.Fatalf("an unapproved file stayed: %v", err)
	}
	if err := cm.DetachFile(ctx, item.ID, "resident-1", "file-b"); !errors.Is(err, catalog.ErrAttachmentNotFound) {
		t.Fatalf("a file was detached twice: %v", err)
	}

	withdrawn, err := cm.WithdrawFileApproval(ctx, item.ID, "file-a")
	if err != nil || withdrawn.ApprovedForPublishing() || withdrawn.ApprovedBy != "" {
		t.Fatalf("withdraw: %+v %v", withdrawn, err)
	}
	if err := cm.DetachFile(ctx, item.ID, "resident-1", "file-a"); err != nil {
		t.Fatalf("a withdrawn file stayed attached: %v", err)
	}
	left, err := cm.ListRaisedItemFiles(ctx, item.ID)
	if err != nil || len(left) != 0 {
		t.Fatalf("files left: %+v %v", left, err)
	}
}

func TestAttachingAndApprovingFilesRefusesWhatIsNotTheRaisersOrNotPublishable(t *testing.T) {
	cm := entryManager(t)
	ctx := context.Background()
	open := raise(t, cm, "Photo", true)
	private := raise(t, cm, "Private photo", false)

	if _, err := cm.AttachFiles(ctx, open.ID, "", []string{"file-a"}); !errors.Is(err, catalog.ErrInvalidAttachment) {
		t.Fatalf("an unnamed raiser attached: %v", err)
	}
	if _, err := cm.AttachFiles(ctx, open.ID, "resident-1", nil); !errors.Is(err, catalog.ErrInvalidAttachment) {
		t.Fatalf("no files attached: %v", err)
	}
	if _, err := cm.AttachFiles(ctx, open.ID, "resident-1", []string{"file-a", ""}); !errors.Is(err, catalog.ErrInvalidAttachment) {
		t.Fatalf("a blank file id attached: %v", err)
	}
	if left, _ := cm.ListRaisedItemFiles(ctx, open.ID); len(left) != 0 {
		t.Fatalf("a refused batch left files behind: %+v", left)
	}
	if _, err := cm.AttachFiles(ctx, open.ID, "resident-9", []string{"file-a"}); !errors.Is(err, catalog.ErrRaisedItemNotFound) {
		t.Fatalf("someone else attached to another's item: %v", err)
	}

	if _, err := cm.AttachFiles(ctx, private.ID, "resident-1", []string{"file-a"}); err != nil {
		t.Fatal(err)
	}
	if _, err := cm.ApproveFileForPublishing(ctx, private.ID, "file-a", "moderator-1"); !errors.Is(err, catalog.ErrRaisedItemNotPublishable) {
		t.Fatalf("a file of an unpublishable item was approved: %v", err)
	}
	if _, err := cm.ApproveFileForPublishing(ctx, open.ID, "file-a", ""); !errors.Is(err, catalog.ErrInvalidAttachment) {
		t.Fatalf("an approval by nobody: %v", err)
	}
	if _, err := cm.ApproveFileForPublishing(ctx, open.ID, "file-z", "moderator-1"); !errors.Is(err, catalog.ErrAttachmentNotFound) {
		t.Fatalf("a file never attached was approved: %v", err)
	}
	if _, err := cm.ApproveFileForPublishing(ctx, "no-such-item", "file-a", "moderator-1"); !errors.Is(err, catalog.ErrRaisedItemNotFound) {
		t.Fatalf("an item that is not there: %v", err)
	}
	if err := cm.DetachFile(ctx, open.ID, "", "file-a"); !errors.Is(err, catalog.ErrRaisedItemNotFound) {
		t.Fatalf("an unnamed raiser detached: %v", err)
	}
	if _, err := cm.WithdrawFileApproval(ctx, open.ID, "file-z"); !errors.Is(err, catalog.ErrAttachmentNotFound) {
		t.Fatalf("a file never attached was withdrawn: %v", err)
	}
}
