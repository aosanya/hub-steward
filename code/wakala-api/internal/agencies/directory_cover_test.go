package agencies

import (
	"context"
	"strings"
	"testing"
)

func boolp(b bool) *bool       { return &b }
func stringp(s string) *string { return &s }

func listedAgency(t *testing.T, reg *registry, name, place string) Instance {
	t.Helper()
	ctx := context.Background()
	inst, err := reg.CreateInstance(ctx, name)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := reg.DecideApproval(ctx, inst.ID, true, ""); err != nil {
		t.Fatal(err)
	}
	listed, err := reg.SetListing(ctx, inst.ID, ListingChange{Listed: boolp(true), Place: stringp(place), Purpose: stringp("  Water committee ")})
	if err != nil {
		t.Fatal(err)
	}
	return listed
}

func TestListingChangeOnlyWritesTheFieldsItNamesAndTrimsText(t *testing.T) {
	cols := ListingChange{Listed: boolp(false), Purpose: stringp("  p "), Place: stringp(""), Audience: nil}.columns()
	if len(cols) != 3 || cols["listed"] != false || cols["purpose"] != "p" || cols["place"] != "" {
		t.Fatalf("got %v", cols)
	}
	if got := (ListingChange{}).columns(); len(got) != 0 {
		t.Fatalf("an empty change writes nothing, got %v", got)
	}
}

func TestSetListingPublishesTheAgencyWithTrimmedTextAndLeavesTheRestAlone(t *testing.T) {
	reg, id := registryWithMembers(t, nil)
	ctx := context.Background()
	got, err := reg.SetListing(ctx, id, ListingChange{Listed: boolp(true), Purpose: stringp("  Water committee "), Audience: stringp("Residents")})
	if err != nil || !got.Listed || got.Purpose != "Water committee" || got.Audience != "Residents" || got.Place != "" {
		t.Fatalf("got %+v, %v", got, err)
	}
	same, err := reg.SetListing(ctx, id, ListingChange{})
	if err != nil || !same.Listed || same.Purpose != "Water committee" {
		t.Fatalf("an empty change must change nothing: %+v %v", same, err)
	}
	if _, err := reg.SetListing(ctx, "ghost", ListingChange{Listed: boolp(true)}); err == nil {
		t.Fatal("an unknown agency must be refused")
	}
}

func TestDirectoryShowsOnlyListedApprovedAgenciesSortedByName(t *testing.T) {
	reg, hidden := registryWithMembers(t, nil)
	ctx := context.Background()
	listedAgency(t, reg, "Zebra ward", "Arusha")
	listedAgency(t, reg, "Acacia ward", "Mwanza")
	pending, _ := reg.CreateInstance(ctx, "Pending ward")
	reg.SetListing(ctx, pending.ID, ListingChange{Listed: boolp(true)})
	reg.SetListing(ctx, hidden, ListingChange{Listed: boolp(false)})

	found, err := reg.SearchDirectory(ctx, "")
	if err != nil || len(found) != 2 || found[0].Name != "Acacia ward" || found[1].Name != "Zebra ward" {
		t.Fatalf("got %+v, %v", found, err)
	}
	if found[0].Place != "Mwanza" || found[0].Purpose != "Water committee" || found[0].JoinMode != JoinConfirmed {
		t.Fatalf("entry %+v", found[0])
	}
}

func TestDirectorySearchMatchesNameOrPlaceIgnoringCaseAndTreatsWildcardsAsText(t *testing.T) {
	reg, _ := registryWithMembers(t, nil)
	ctx := context.Background()
	listedAgency(t, reg, "Acacia ward", "Mwanza")
	listedAgency(t, reg, "100%_Honest ward", "Arusha")

	byName, _ := reg.SearchDirectory(ctx, "  ACAC ")
	byPlace, _ := reg.SearchDirectory(ctx, "arusha")
	percent, _ := reg.SearchDirectory(ctx, "100%")
	wildcard, _ := reg.SearchDirectory(ctx, "%")
	underscore, _ := reg.SearchDirectory(ctx, "_h")
	none, _ := reg.SearchDirectory(ctx, "nowhere")
	if len(byName) != 1 || byName[0].Name != "Acacia ward" || len(byPlace) != 1 || byPlace[0].Place != "Arusha" {
		t.Fatalf("name %+v place %+v", byName, byPlace)
	}
	if len(percent) != 1 || len(wildcard) != 1 || len(underscore) != 1 || len(none) != 0 {
		t.Fatalf("percent %d wildcard %d underscore %d none %d: a percent or underscore typed by a person must match itself only", len(percent), len(wildcard), len(underscore), len(none))
	}
}

func TestDirectorySearchByIdFindsOnlyAnApprovedAgency(t *testing.T) {
	reg, pendingID := registryWithMembers(t, nil)
	ctx := context.Background()
	approved := listedAgency(t, reg, "Acacia ward", "Mwanza")

	found, err := reg.SearchDirectory(ctx, " "+strings.ToUpper(approved.ID)+" ")
	if err != nil || len(found) != 1 || found[0].ID != approved.ID {
		t.Fatalf("got %+v, %v", found, err)
	}
	if got, _ := reg.SearchDirectory(ctx, pendingID); got == nil || len(got) != 0 {
		t.Fatalf("a pending agency is not shown by its id: %#v", got)
	}
	if got, err := reg.SearchDirectory(ctx, "00000000-0000-0000-0000-000000000000"); err != nil || got == nil || len(got) != 0 {
		t.Fatalf("an unknown id reads as an empty list: %#v %v", got, err)
	}
}

func TestDirectoryNeverReturnsMoreThanTheLimit(t *testing.T) {
	reg, _ := registryWithMembers(t, nil)
	ctx := context.Background()
	for i := 0; i < DirectoryLimit+3; i++ {
		inst, _ := reg.CreateInstance(ctx, "Ward "+strings.Repeat("x", i%7)+string(rune('a'+i%26)))
		reg.DecideApproval(ctx, inst.ID, true, "")
		reg.SetListing(ctx, inst.ID, ListingChange{Listed: boolp(true)})
	}
	found, err := reg.SearchDirectory(ctx, "")
	if err != nil || len(found) != DirectoryLimit {
		t.Fatalf("got %d, %v", len(found), err)
	}
}
