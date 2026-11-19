package agencies

import (
	"context"
	"errors"
	"fmt"
	"testing"

	mwanachamacatalog "github.com/aosanya/mwanachama-backend-catalog"
	mwanachamagit "github.com/aosanya/mwanachama-backend-git"
)

func newRepositoryCatalogFixture(t *testing.T) (mwanachamagit.RepositoryCatalog, mwanachamacatalog.CatalogManager, context.Context) {
	t.Helper()
	reg, err := NewRegistry(sharedMemoryDB(t))
	if err != nil {
		t.Fatalf("NewRegistry: %v", err)
	}
	ctx := context.Background()
	inst, err := reg.CreateInstance(ctx, "Agency A")
	if err != nil {
		t.Fatalf("CreateInstance: %v", err)
	}
	manager, err := reg.CatalogManager(ctx, inst.ID, RepositoriesMount)
	if err != nil {
		t.Fatalf("CatalogManager: %v", err)
	}
	return NewRepositoryCatalog(manager), manager, ctx
}

func widgets() mwanachamagit.RepositoryCatalogEntry {
	return mwanachamagit.RepositoryCatalogEntry{ID: "11111111-aaaa-bbbb-cccc-000000000001", Name: "widgets", FileName: "widgets.db", SizeBytes: 4096}
}

func TestRepositoryCatalog_RegistersAndLooksUp(t *testing.T) {
	catalog, _, ctx := newRepositoryCatalogFixture(t)
	if err := catalog.Register(ctx, widgets()); err != nil {
		t.Fatalf("Register: %v", err)
	}
	got, err := catalog.Lookup(ctx, widgets().ID)
	if err != nil {
		t.Fatalf("Lookup: %v", err)
	}
	if got != widgets() {
		t.Fatalf("Lookup = %+v, want %+v", got, widgets())
	}
}

func TestRepositoryCatalog_RefusesASecondRegistrationOfTheSameID(t *testing.T) {
	catalog, _, ctx := newRepositoryCatalogFixture(t)
	if err := catalog.Register(ctx, widgets()); err != nil {
		t.Fatalf("Register: %v", err)
	}
	if err := catalog.Register(ctx, widgets()); !errors.Is(err, mwanachamagit.ErrRepositoryAlreadyCatalogued) {
		t.Fatalf("second Register = %v, want ErrRepositoryAlreadyCatalogued", err)
	}
}

func TestRepositoryCatalog_UpdateSetsSizeAndLastCommit(t *testing.T) {
	catalog, _, ctx := newRepositoryCatalogFixture(t)
	if err := catalog.Register(ctx, widgets()); err != nil {
		t.Fatalf("Register: %v", err)
	}
	if err := catalog.Update(ctx, widgets().ID, 8192, "2026-11-13T10:00:00Z"); err != nil {
		t.Fatalf("Update: %v", err)
	}
	got, err := catalog.Lookup(ctx, widgets().ID)
	if err != nil {
		t.Fatalf("Lookup: %v", err)
	}
	want := widgets()
	want.SizeBytes = 8192
	want.LastCommitAt = "2026-11-13T10:00:00Z"
	if got != want {
		t.Fatalf("after Update = %+v, want %+v", got, want)
	}
}

func TestRepositoryCatalog_UnknownIDIsNotCatalogued(t *testing.T) {
	catalog, _, ctx := newRepositoryCatalogFixture(t)
	if err := catalog.Update(ctx, "missing", 1, ""); !errors.Is(err, mwanachamagit.ErrRepositoryNotCatalogued) {
		t.Fatalf("Update = %v, want ErrRepositoryNotCatalogued", err)
	}
	if _, err := catalog.Lookup(ctx, "missing"); !errors.Is(err, mwanachamagit.ErrRepositoryNotCatalogued) {
		t.Fatalf("Lookup = %v, want ErrRepositoryNotCatalogued", err)
	}
	if err := catalog.Remove(ctx, "missing"); !errors.Is(err, mwanachamagit.ErrRepositoryNotCatalogued) {
		t.Fatalf("Remove = %v, want ErrRepositoryNotCatalogued", err)
	}
}

func TestRepositoryCatalog_ListsEveryEntryByNameWhateverItsVisibility(t *testing.T) {
	catalog, manager, ctx := newRepositoryCatalogFixture(t)
	for _, name := range []string{"zebra", "apple", "mango"} {
		entry := mwanachamagit.RepositoryCatalogEntry{ID: "id-" + name, Name: name, FileName: name + ".db"}
		if err := catalog.Register(ctx, entry); err != nil {
			t.Fatalf("Register %s: %v", name, err)
		}
	}
	if _, err := manager.SetVisibility(ctx, "id-mango", mwanachamacatalog.VisibilityPublic); err != nil {
		t.Fatalf("SetVisibility: %v", err)
	}
	listed, err := catalog.List(ctx)
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	var names []string
	for _, entry := range listed {
		names = append(names, entry.Name)
	}
	if fmt.Sprint(names) != "[apple mango zebra]" {
		t.Fatalf("List names = %v, want [apple mango zebra]", names)
	}
}

func TestRepositoryCatalog_ListsPastOnePage(t *testing.T) {
	catalog, _, ctx := newRepositoryCatalogFixture(t)
	const total = repositoryListPage + 5
	for i := 0; i < total; i++ {
		entry := mwanachamagit.RepositoryCatalogEntry{ID: fmt.Sprintf("repo-%03d", i), Name: fmt.Sprintf("name-%03d", i), FileName: "x.db"}
		if err := catalog.Register(ctx, entry); err != nil {
			t.Fatalf("Register %d: %v", i, err)
		}
	}
	listed, err := catalog.List(ctx)
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(listed) != total {
		t.Fatalf("List returned %d entries, want %d", len(listed), total)
	}
}

func TestRepositoryCatalog_RemoveDropsTheEntryAndFreesTheID(t *testing.T) {
	catalog, _, ctx := newRepositoryCatalogFixture(t)
	if err := catalog.Register(ctx, widgets()); err != nil {
		t.Fatalf("Register: %v", err)
	}
	if err := catalog.Remove(ctx, widgets().ID); err != nil {
		t.Fatalf("Remove: %v", err)
	}
	if _, err := catalog.Lookup(ctx, widgets().ID); !errors.Is(err, mwanachamagit.ErrRepositoryNotCatalogued) {
		t.Fatalf("Lookup after Remove = %v, want ErrRepositoryNotCatalogued", err)
	}
	listed, err := catalog.List(ctx)
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if len(listed) != 0 {
		t.Fatalf("List after Remove = %+v, want empty", listed)
	}
	if err := catalog.Register(ctx, widgets()); err != nil {
		t.Fatalf("Register again after Remove: %v", err)
	}
}

func TestRepositoryCatalog_RefusesAStoredDocumentWithAnExtraKey(t *testing.T) {
	catalog, manager, ctx := newRepositoryCatalogFixture(t)
	if err := catalog.Register(ctx, widgets()); err != nil {
		t.Fatalf("Register: %v", err)
	}
	if _, err := manager.CreateEntry(ctx, mwanachamacatalog.Entry{
		Slug: "stray",
		Name: "stray",
		Doc:  `{"file_name":"stray.db","size_bytes":1,"last_commit_at":"","owner":"someone"}`,
	}); err != nil {
		t.Fatalf("CreateEntry: %v", err)
	}
	if _, err := catalog.Lookup(ctx, "stray"); err == nil || errors.Is(err, mwanachamagit.ErrRepositoryNotCatalogued) {
		t.Fatalf("Lookup of a document with an extra key = %v, want a parse refusal", err)
	}
	if _, err := catalog.List(ctx); err == nil {
		t.Fatal("List accepted a document with an extra key")
	}
	if err := catalog.Update(ctx, "stray", 2, ""); err == nil {
		t.Fatal("Update accepted a document with an extra key")
	}
}
