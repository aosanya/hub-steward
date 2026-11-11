package mwanachamacatalog_test

import (
	"context"
	"errors"
	"testing"

	catalog "wakalaserver/modules/catalog"
)

func ownerTestEntry(by string) catalog.Entry {
	return catalog.Entry{Slug: "lights", Name: "Lights", Summary: "s", Doc: "{}", SubmittedBy: by}
}

func TestEntryOverwriteAndDelete_RefuseAnyoneButTheWriterAndTheAgencyOwner(t *testing.T) {
	cm := entryManager(t)
	ctx := context.Background()
	if _, err := cm.UpsertEntry(ctx, ownerTestEntry("anna")); err != nil {
		t.Fatalf("anna writes: %v", err)
	}
	if _, err := cm.UpsertEntry(ctx, ownerTestEntry("bela")); !errors.Is(err, catalog.ErrNotEntryOwner) {
		t.Errorf("bela overwrites anna's entry: %v, want ErrNotEntryOwner", err)
	}
	if err := cm.DeleteEntry(ctx, "lights", "bela"); !errors.Is(err, catalog.ErrNotEntryOwner) {
		t.Errorf("bela deletes anna's entry: %v, want ErrNotEntryOwner", err)
	}
	if _, err := cm.UpsertEntry(ctx, ownerTestEntry("anna")); err != nil {
		t.Errorf("anna rewrites her own entry: %v", err)
	}
	if _, err := cm.UpsertEntry(catalog.AsAgencyOwner(ctx), ownerTestEntry("owner")); err != nil {
		t.Errorf("the agency owner overwrites anna's entry: %v", err)
	}
	if err := cm.DeleteEntry(catalog.AsAgencyOwner(ctx), "lights", "owner"); err != nil {
		t.Errorf("the agency owner deletes the entry: %v", err)
	}
}
