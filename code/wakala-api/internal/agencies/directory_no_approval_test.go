package agencies

import (
	"context"
	"testing"
)

func TestAPublishedListedAgencyIsFoundByAResidentWithoutAnyApproveCall(t *testing.T) {
	ctx := context.Background()
	reg := approvalRegistry(t)
	inst, err := reg.CreateInstance(ctx, "Zold ward")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := reg.SetListing(ctx, inst.ID, ListingChange{Listed: boolp(true), Place: stringp("Zold")}); err != nil {
		t.Fatal(err)
	}

	byName, err := reg.SearchDirectory(ctx, "zold")
	if err != nil || len(byName) != 1 || byName[0].ID != inst.ID {
		t.Fatalf("search by name: got %+v, %v", byName, err)
	}
	byID, err := reg.SearchDirectory(ctx, inst.ID)
	if err != nil || len(byID) != 1 || byID[0].ID != inst.ID {
		t.Fatalf("search by id: got %+v, %v", byID, err)
	}
	if inst.Approval != ApprovalApproved {
		t.Fatalf("a new agency must not wait for approval, got %q", inst.Approval)
	}
}

func TestAPendingOrDeclinedValueLeftInOldDataDoesNotHideAListedAgency(t *testing.T) {
	ctx := context.Background()
	reg := approvalRegistry(t)
	for _, left := range []string{ApprovalPending, ApprovalDeclined} {
		inst, err := reg.CreateInstance(ctx, "Old data "+left)
		if err != nil {
			t.Fatal(err)
		}
		if err := reg.db.Model(&instanceRow{}).Where("id = ?", inst.ID).
			Updates(map[string]any{"approval": left, "listed": true}).Error; err != nil {
			t.Fatal(err)
		}
		found, err := reg.SearchDirectory(ctx, inst.ID)
		if err != nil || len(found) != 1 {
			t.Fatalf("%s by id: got %+v, %v", left, found, err)
		}
		byName, err := reg.SearchDirectory(ctx, "old data "+left)
		if err != nil || len(byName) != 1 {
			t.Fatalf("%s by name: got %+v, %v", left, byName, err)
		}
	}
}
