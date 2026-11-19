package agencies

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"

	mwanachamagit "github.com/aosanya/mwanachama-backend-git"
	"github.com/aosanya/mwanachama-backend-git/models"
)

type gitFolderFixture struct {
	reg     *registry
	inst    Instance
	root    string
	folder  string
	catalog mwanachamagit.RepositoryCatalog
	manager mwanachamagit.GitManager
	routed  *mwanachamagit.RoutedGitManager
	ctx     context.Context
}

func newGitFolderFixture(t *testing.T, maxOpen int) *gitFolderFixture {
	t.Helper()
	root := t.TempDir()
	built, err := NewRegistry(sharedMemoryDB(t), WithGitRepositoryFolder(root, maxOpen))
	if err != nil {
		t.Fatalf("NewRegistry: %v", err)
	}
	reg := built.(*registry)
	ctx := context.Background()
	inst, err := reg.CreateInstance(ctx, "Agency A")
	if err != nil {
		t.Fatalf("CreateInstance: %v", err)
	}
	manager, err := reg.GitManager(ctx, inst.ID)
	if err != nil {
		t.Fatalf("GitManager: %v", err)
	}
	routed, ok := manager.(*mwanachamagit.RoutedGitManager)
	if !ok {
		t.Fatalf("GitManager is %T, want the routed folder manager", manager)
	}
	catalogManager, err := reg.CatalogManager(ctx, inst.ID, RepositoriesMount)
	if err != nil {
		t.Fatalf("CatalogManager: %v", err)
	}
	t.Cleanup(func() { _ = routed.Close() })
	return &gitFolderFixture{
		reg: reg, inst: inst, root: root, folder: filepath.Join(root, inst.TableSlug),
		catalog: NewRepositoryCatalog(catalogManager), manager: manager, routed: routed, ctx: ctx,
	}
}

func (f *gitFolderFixture) reopened(t *testing.T) *mwanachamagit.RoutedGitManager {
	t.Helper()
	s, err := gitSpecOf(f.inst)
	if err != nil {
		t.Fatalf("gitSpecOf: %v", err)
	}
	again, err := mwanachamagit.NewRoutedGitManager(f.folder, 4, s, f.catalog)
	if err != nil {
		t.Fatalf("NewRoutedGitManager: %v", err)
	}
	t.Cleanup(func() { _ = again.Close() })
	return again
}

func (f *gitFolderFixture) initRepo(t *testing.T, name string) (models.Repository, models.Branch) {
	t.Helper()
	repo, err := f.manager.InitRepo(f.ctx, mwanachamagit.CreateRepoRequest{Name: name})
	if err != nil {
		t.Fatalf("InitRepo %s: %v", name, err)
	}
	main, err := f.manager.GetBranchByName(f.ctx, repo.ID, repo.DefaultBranch)
	if err != nil {
		t.Fatalf("GetBranchByName %s: %v", name, err)
	}
	return repo, main
}

func (f *gitFolderFixture) writeAndMerge(t *testing.T, repo models.Repository, main models.Branch, path, content string) {
	t.Helper()
	work, err := f.manager.CreateBranch(f.ctx, mwanachamagit.CreateBranchRequest{RepositoryID: repo.ID, Name: "work-" + path, FromBranchID: main.ID})
	if err != nil {
		t.Fatalf("CreateBranch: %v", err)
	}
	if _, err := f.manager.WriteFile(f.ctx, mwanachamagit.WriteFileRequest{BranchID: work.ID, Path: path, Content: content}); err != nil {
		t.Fatalf("WriteFile: %v", err)
	}
	if _, err := f.manager.MergeBranch(f.ctx, work.ID); err != nil {
		t.Fatalf("MergeBranch: %v", err)
	}
}

func TestGitFolder_UnsetFolderKeepsTheSharedDatabaseManager(t *testing.T) {
	t.Setenv(gitFolderVariable, "")
	reg, err := NewRegistry(sharedMemoryDB(t))
	if err != nil {
		t.Fatalf("NewRegistry: %v", err)
	}
	ctx := context.Background()
	inst, err := reg.CreateInstance(ctx, "Agency A")
	if err != nil {
		t.Fatalf("CreateInstance: %v", err)
	}
	manager, err := reg.GitManager(ctx, inst.ID)
	if err != nil {
		t.Fatalf("GitManager: %v", err)
	}
	if _, routed := manager.(*mwanachamagit.RoutedGitManager); routed {
		t.Fatal("an unset GIT_REPOSITORY_FOLDER must keep the shared-database manager")
	}
	if _, err := manager.InitRepo(ctx, mwanachamagit.CreateRepoRequest{Name: "widgets"}); err != nil {
		t.Fatalf("InitRepo: %v", err)
	}
}

func TestGitFolder_EnvironmentSelectsTheFolderAndBoundsOpenFiles(t *testing.T) {
	env := func(values map[string]string) func(string) string {
		return func(name string) string { return values[name] }
	}
	cases := []struct {
		name       string
		values     map[string]string
		wantFolder string
		wantOpen   int
	}{
		{"nothing set", map[string]string{}, "", 32},
		{"folder only", map[string]string{gitFolderVariable: "/data/git"}, "/data/git", 32},
		{"open files set", map[string]string{gitFolderVariable: "/data/git", gitOpenFilesVariable: "7"}, "/data/git", 7},
		{"open files zero is lifted to one", map[string]string{gitFolderVariable: "/data/git", gitOpenFilesVariable: "0"}, "/data/git", 1},
		{"open files negative is lifted to one", map[string]string{gitFolderVariable: "/data/git", gitOpenFilesVariable: "-4"}, "/data/git", 1},
		{"open files not a number falls back to the default", map[string]string{gitFolderVariable: "/data/git", gitOpenFilesVariable: "many"}, "/data/git", 32},
	}
	for _, c := range cases {
		folder, open := gitFolderFromEnv(env(c.values))
		if folder != c.wantFolder || open != c.wantOpen {
			t.Errorf("%s: got %q, %d; want %q, %d", c.name, folder, open, c.wantFolder, c.wantOpen)
		}
	}
}

func TestGitFolder_TheRegistryReadsTheEnvironmentWhenNoOptionIsGiven(t *testing.T) {
	root := t.TempDir()
	t.Setenv(gitFolderVariable, root)
	t.Setenv(gitOpenFilesVariable, "2")
	reg, err := NewRegistry(sharedMemoryDB(t))
	if err != nil {
		t.Fatalf("NewRegistry: %v", err)
	}
	ctx := context.Background()
	inst, err := reg.CreateInstance(ctx, "Agency A")
	if err != nil {
		t.Fatalf("CreateInstance: %v", err)
	}
	manager, err := reg.GitManager(ctx, inst.ID)
	if err != nil {
		t.Fatalf("GitManager: %v", err)
	}
	if _, routed := manager.(*mwanachamagit.RoutedGitManager); !routed {
		t.Fatalf("GitManager is %T, want the routed folder manager", manager)
	}
}

func TestGitFolder_TwoRepositoriesAreBothListedFromTheCatalog(t *testing.T) {
	f := newGitFolderFixture(t, 4)
	f.initRepo(t, "widgets")
	f.initRepo(t, "reports")
	listed, err := f.manager.ListRepositories(f.ctx)
	if err != nil {
		t.Fatalf("ListRepositories: %v", err)
	}
	if len(listed) != 2 || listed[0].Name != "reports" || listed[1].Name != "widgets" {
		t.Fatalf("ListRepositories = %+v, want reports then widgets", listed)
	}
	summaries, err := f.manager.ListRepositorySummaries(f.ctx)
	if err != nil {
		t.Fatalf("ListRepositorySummaries: %v", err)
	}
	if len(summaries) != 2 || summaries[0].Name != "reports" || summaries[0].DefaultBranchID == "" || summaries[1].DefaultBranchID == "" {
		t.Fatalf("ListRepositorySummaries = %+v, want both with a default branch id", summaries)
	}
	entries, err := f.catalog.List(f.ctx)
	if err != nil || len(entries) != 2 {
		t.Fatalf("catalog = %+v, %v; want two entries", entries, err)
	}
	for _, entry := range entries {
		if _, err := os.Stat(filepath.Join(f.folder, entry.FileName)); err != nil {
			t.Errorf("file of %s: %v", entry.Name, err)
		}
	}
}

func TestGitFolder_RepositoriesAreFoundByIDAndByName(t *testing.T) {
	f := newGitFolderFixture(t, 4)
	widgets, _ := f.initRepo(t, "widgets")
	f.initRepo(t, "reports")
	byID, err := f.manager.GetRepository(f.ctx, widgets.ID)
	if err != nil || byID.Name != "widgets" {
		t.Fatalf("GetRepository = %+v, %v", byID, err)
	}
	byName, err := f.manager.GetRepositoryByName(f.ctx, "widgets")
	if err != nil || byName.ID != widgets.ID {
		t.Fatalf("GetRepositoryByName = %+v, %v", byName, err)
	}
	if _, err := f.manager.GetRepository(f.ctx, "no-such-id"); !errors.Is(err, mwanachamagit.ErrRepoNotInitialised) {
		t.Fatalf("unknown id = %v, want ErrRepoNotInitialised", err)
	}
	if _, err := f.manager.GetRepositoryByName(f.ctx, "no-such-name"); !errors.Is(err, mwanachamagit.ErrRepoNotInitialised) {
		t.Fatalf("unknown name = %v, want ErrRepoNotInitialised", err)
	}
}

func TestGitFolder_ASecondRepositoryWithTheSameNameIsRefused(t *testing.T) {
	f := newGitFolderFixture(t, 4)
	f.initRepo(t, "widgets")
	if _, err := f.manager.InitRepo(f.ctx, mwanachamagit.CreateRepoRequest{Name: "widgets"}); !errors.Is(err, mwanachamagit.ErrRepoAlreadyExists) {
		t.Fatalf("duplicate InitRepo = %v, want ErrRepoAlreadyExists", err)
	}
}

func TestGitFolder_AFileWrittenOnABranchIsReadBackFromTheDefaultBranchAfterTheMerge(t *testing.T) {
	f := newGitFolderFixture(t, 4)
	repo, main := f.initRepo(t, "widgets")
	f.writeAndMerge(t, repo, main, "notes/plan.md", "first plan")
	blob, err := f.manager.ReadFile(f.ctx, main.ID, "notes/plan.md")
	if err != nil {
		t.Fatalf("ReadFile: %v", err)
	}
	if blob.Content != "first plan" {
		t.Fatalf("content = %q, want first plan", blob.Content)
	}
	log, err := f.manager.Log(f.ctx, main.ID, mwanachamagit.LogFilter{})
	if err != nil || len(log) == 0 {
		t.Fatalf("Log = %+v, %v; want the commit", log, err)
	}
	dir, err := f.manager.ListDirectory(f.ctx, main.ID, "notes")
	if err != nil || len(dir) != 1 {
		t.Fatalf("ListDirectory = %+v, %v; want plan.md", dir, err)
	}
}

func TestGitFolder_TheSecondRepositoryDoesNotSeeTheFirstOnesFile(t *testing.T) {
	f := newGitFolderFixture(t, 4)
	widgets, widgetsMain := f.initRepo(t, "widgets")
	_, reportsMain := f.initRepo(t, "reports")
	f.writeAndMerge(t, widgets, widgetsMain, "secret.md", "widgets only")
	if _, err := f.manager.ReadFile(f.ctx, reportsMain.ID, "secret.md"); !errors.Is(err, mwanachamagit.ErrFileNotFound) {
		t.Fatalf("reports reading widgets' file = %v, want ErrFileNotFound", err)
	}
	if _, err := f.manager.ReadFile(f.ctx, widgetsMain.ID, "secret.md"); err != nil {
		t.Fatalf("widgets reading its own file: %v", err)
	}
}

func TestGitFolder_AnIdIsFoundInWhicheverFileOwnsItInEitherOrder(t *testing.T) {
	f := newGitFolderFixture(t, 4)
	_, aMain := f.initRepo(t, "aaa")
	_, zMain := f.initRepo(t, "zzz")
	for _, want := range []models.Branch{zMain, aMain, zMain, aMain} {
		got, err := f.manager.GetBranch(f.ctx, want.ID)
		if err != nil || got.ID != want.ID || got.RepositoryID != want.RepositoryID {
			t.Fatalf("GetBranch(%s) = %+v, %v", want.ID, got, err)
		}
	}
	if _, err := f.manager.GetBranch(f.ctx, "no-such-branch"); !errors.Is(err, mwanachamagit.ErrBranchNotFound) {
		t.Fatalf("unknown branch = %v, want ErrBranchNotFound", err)
	}
}

func TestGitFolder_MergeRequestsAndTagsAreRoutedToTheirFile(t *testing.T) {
	f := newGitFolderFixture(t, 4)
	_, _ = f.initRepo(t, "aaa")
	repo, main := f.initRepo(t, "zzz")
	work, err := f.manager.CreateBranch(f.ctx, mwanachamagit.CreateBranchRequest{RepositoryID: repo.ID, Name: "work", FromBranchID: main.ID})
	if err != nil {
		t.Fatalf("CreateBranch: %v", err)
	}
	if _, err := f.manager.WriteFile(f.ctx, mwanachamagit.WriteFileRequest{BranchID: work.ID, Path: "a.md", Content: "a"}); err != nil {
		t.Fatalf("WriteFile: %v", err)
	}
	mr, err := f.manager.CreateMergeRequest(f.ctx, mwanachamagit.CreateMergeRequestRequest{RepositoryID: repo.ID, SourceBranchID: work.ID, Title: "work"})
	if err != nil {
		t.Fatalf("CreateMergeRequest: %v", err)
	}
	got, err := f.manager.GetMergeRequest(f.ctx, mr.ID)
	if err != nil || got.ID != mr.ID {
		t.Fatalf("GetMergeRequest = %+v, %v", got, err)
	}
	all, err := f.manager.ListMergeRequests(f.ctx, mwanachamagit.MergeRequestFilter{})
	if err != nil || len(all) != 1 {
		t.Fatalf("ListMergeRequests across files = %+v, %v; want the one", all, err)
	}
	scoped, err := f.manager.ListMergeRequests(f.ctx, mwanachamagit.MergeRequestFilter{RepositoryID: repo.ID})
	if err != nil || len(scoped) != 1 {
		t.Fatalf("ListMergeRequests of the repository = %+v, %v; want the one", scoped, err)
	}
	if _, err := f.manager.GetMergeRequest(f.ctx, "no-such-mr"); !errors.Is(err, mwanachamagit.ErrMergeRequestNotFound) {
		t.Fatalf("unknown merge request = %v, want ErrMergeRequestNotFound", err)
	}
	if _, err := f.manager.CloseMergeRequest(f.ctx, mr.ID); err != nil {
		t.Fatalf("CloseMergeRequest: %v", err)
	}
}

func TestGitFolder_KeywordsLiveInTheFileOfTheirParent(t *testing.T) {
	f := newGitFolderFixture(t, 4)
	f.initRepo(t, "aaa")
	f.initRepo(t, "zzz")
	root, err := f.manager.CreateKeyword(f.ctx, mwanachamagit.CreateKeywordRequest{Name: "topic"})
	if err != nil {
		t.Fatalf("CreateKeyword root: %v", err)
	}
	child, err := f.manager.CreateKeyword(f.ctx, mwanachamagit.CreateKeywordRequest{Name: "sub", ParentID: root.ID})
	if err != nil {
		t.Fatalf("CreateKeyword child: %v", err)
	}
	roots, err := f.manager.ListKeywords(f.ctx, mwanachamagit.KeywordFilter{})
	if err != nil || len(roots) != 1 || roots[0].ID != root.ID {
		t.Fatalf("root keywords = %+v, %v", roots, err)
	}
	children, err := f.manager.ListKeywords(f.ctx, mwanachamagit.KeywordFilter{ParentID: root.ID})
	if err != nil || len(children) != 1 || children[0].ID != child.ID {
		t.Fatalf("child keywords = %+v, %v", children, err)
	}
	tree, err := f.manager.GetKeywordTree(f.ctx, root.ID)
	if err != nil || len(tree) == 0 {
		t.Fatalf("GetKeywordTree = %+v, %v", tree, err)
	}
}

func TestGitFolder_ACreatedKeywordWithNoRepositoryIsRefused(t *testing.T) {
	f := newGitFolderFixture(t, 4)
	if _, err := f.manager.CreateKeyword(f.ctx, mwanachamagit.CreateKeywordRequest{Name: "topic"}); !errors.Is(err, mwanachamagit.ErrRepoNotInitialised) {
		t.Fatalf("CreateKeyword with no repository = %v, want ErrRepoNotInitialised", err)
	}
}

func TestGitFolder_ReopeningOverTheSameFolderAndCatalogKeepsTheFile(t *testing.T) {
	f := newGitFolderFixture(t, 4)
	repo, main := f.initRepo(t, "widgets")
	f.writeAndMerge(t, repo, main, "plan.md", "kept")
	again := f.reopened(t)
	blob, err := again.ReadFile(f.ctx, main.ID, "plan.md")
	if err != nil || blob.Content != "kept" {
		t.Fatalf("ReadFile after reopen = %+v, %v", blob, err)
	}
	listed, err := again.ListRepositories(f.ctx)
	if err != nil || len(listed) != 1 || listed[0].Name != "widgets" {
		t.Fatalf("ListRepositories after reopen = %+v, %v", listed, err)
	}
}

func TestGitFolder_AFileCopiedIntoTheFolderWithNoCatalogEntryIsIgnored(t *testing.T) {
	f := newGitFolderFixture(t, 4)
	repo, main := f.initRepo(t, "widgets")
	f.writeAndMerge(t, repo, main, "plan.md", "real")
	entry, err := f.catalog.Lookup(f.ctx, repo.ID)
	if err != nil {
		t.Fatalf("Lookup: %v", err)
	}
	if err := f.routed.Close(); err != nil {
		t.Fatalf("Close: %v", err)
	}
	raw, err := os.ReadFile(filepath.Join(f.folder, entry.FileName))
	if err != nil {
		t.Fatalf("ReadFile: %v", err)
	}
	if err := os.WriteFile(filepath.Join(f.folder, "stray.db"), raw, 0o644); err != nil {
		t.Fatalf("WriteFile: %v", err)
	}
	again := f.reopened(t)
	listed, err := again.ListRepositories(f.ctx)
	if err != nil || len(listed) != 1 {
		t.Fatalf("ListRepositories = %+v, %v; want only the catalogued repository", listed, err)
	}
	spec, err := gitSpecOf(f.inst)
	if err != nil {
		t.Fatalf("gitSpecOf: %v", err)
	}
	files, err := mwanachamagit.NewRepoFiles(f.folder, 4, mwanachamagit.RegistrationCheckFromCatalog(f.catalog), func(path string) (*mwanachamagit.RepoFile, error) {
		return mwanachamagit.OpenRepoFile(path, spec, nil, nil, nil)
	})
	if err != nil {
		t.Fatalf("NewRepoFiles: %v", err)
	}
	t.Cleanup(func() { _ = files.Close() })
	opened := files.With(f.ctx, "stray.db", func(*mwanachamagit.RepoFile) error { return nil })
	if !errors.Is(opened, mwanachamagit.ErrRepositoryNotRegistered) {
		t.Fatalf("opening the stray file = %v, want ErrRepositoryNotRegistered", opened)
	}
}

func TestGitFolder_DeletingARepositoryRemovesItsFileAndItsEntry(t *testing.T) {
	f := newGitFolderFixture(t, 4)
	repo, main := f.initRepo(t, "widgets")
	f.initRepo(t, "reports")
	f.writeAndMerge(t, repo, main, "plan.md", "gone soon")
	entry, err := f.catalog.Lookup(f.ctx, repo.ID)
	if err != nil {
		t.Fatalf("Lookup: %v", err)
	}
	if err := f.manager.DeleteRepo(f.ctx, repo.ID); err != nil {
		t.Fatalf("DeleteRepo: %v", err)
	}
	if _, err := os.Stat(filepath.Join(f.folder, entry.FileName)); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("file after delete: %v, want not exist", err)
	}
	if _, err := f.catalog.Lookup(f.ctx, repo.ID); !errors.Is(err, mwanachamagit.ErrRepositoryNotCatalogued) {
		t.Fatalf("entry after delete: %v, want not catalogued", err)
	}
	listed, err := f.manager.ListRepositories(f.ctx)
	if err != nil || len(listed) != 1 || listed[0].Name != "reports" {
		t.Fatalf("ListRepositories = %+v, %v; want only reports", listed, err)
	}
	if _, err := f.manager.GetBranch(f.ctx, main.ID); !errors.Is(err, mwanachamagit.ErrBranchNotFound) {
		t.Fatalf("GetBranch of the deleted repository = %v, want ErrBranchNotFound", err)
	}
	if err := f.manager.DeleteRepo(f.ctx, repo.ID); !errors.Is(err, mwanachamagit.ErrRepoNotInitialised) {
		t.Fatalf("second DeleteRepo = %v, want ErrRepoNotInitialised", err)
	}
	if err := f.manager.PurgeRepo(f.ctx, "no-such-id"); !errors.Is(err, mwanachamagit.ErrRepoNotInitialised) {
		t.Fatalf("PurgeRepo of an unknown id = %v, want ErrRepoNotInitialised", err)
	}
}

func TestGitFolder_ACommitUpdatesTheCatalogEntrySizeAndLastCommitTime(t *testing.T) {
	f := newGitFolderFixture(t, 4)
	repo, main := f.initRepo(t, "widgets")
	before, err := f.catalog.Lookup(f.ctx, repo.ID)
	if err != nil {
		t.Fatalf("Lookup: %v", err)
	}
	if before.LastCommitAt != "" {
		t.Fatalf("a fresh repository has last commit %q, want none", before.LastCommitAt)
	}
	work, err := f.manager.CreateBranch(f.ctx, mwanachamagit.CreateBranchRequest{RepositoryID: repo.ID, Name: "work", FromBranchID: main.ID})
	if err != nil {
		t.Fatalf("CreateBranch: %v", err)
	}
	big := make([]byte, 200000)
	for i := range big {
		big[i] = byte('a' + i%23)
	}
	if _, err := f.manager.WriteFile(f.ctx, mwanachamagit.WriteFileRequest{BranchID: work.ID, Path: "big.txt", Content: string(big)}); err != nil {
		t.Fatalf("WriteFile: %v", err)
	}
	after, err := f.catalog.Lookup(f.ctx, repo.ID)
	if err != nil {
		t.Fatalf("Lookup: %v", err)
	}
	if after.LastCommitAt == "" {
		t.Fatal("last commit time not recorded after a commit")
	}
	if after.SizeBytes <= before.SizeBytes {
		t.Fatalf("size %d after the commit, %d before; want it to grow", after.SizeBytes, before.SizeBytes)
	}
	listed, err := f.manager.ListRepositories(f.ctx)
	if err != nil || len(listed) != 1 || listed[0].UpdatedAt != after.LastCommitAt {
		t.Fatalf("ListRepositories = %+v, %v; want UpdatedAt %q", listed, err, after.LastCommitAt)
	}
}

func TestGitFolder_ManyRepositoriesShareAFewOpenFiles(t *testing.T) {
	f := newGitFolderFixture(t, 1)
	names := []string{"one", "two", "three", "four"}
	branches := map[string]models.Branch{}
	for _, name := range names {
		repo, main := f.initRepo(t, name)
		f.writeAndMerge(t, repo, main, name+".md", name)
		branches[name] = main
	}
	for round := 0; round < 2; round++ {
		for _, name := range names {
			blob, err := f.manager.ReadFile(f.ctx, branches[name].ID, name+".md")
			if err != nil || blob.Content != name {
				t.Fatalf("ReadFile %s round %d = %+v, %v", name, round, blob, err)
			}
		}
	}
}

func TestGitFolder_AnInstanceKeepsItsFilesInItsOwnSubfolder(t *testing.T) {
	root := t.TempDir()
	reg, err := NewRegistry(sharedMemoryDB(t), WithGitRepositoryFolder(root, 4))
	if err != nil {
		t.Fatalf("NewRegistry: %v", err)
	}
	ctx := context.Background()
	var folders []string
	for _, name := range []string{"Agency A", "Agency B"} {
		inst, err := reg.CreateInstance(ctx, name)
		if err != nil {
			t.Fatalf("CreateInstance: %v", err)
		}
		manager, err := reg.GitManager(ctx, inst.ID)
		if err != nil {
			t.Fatalf("GitManager: %v", err)
		}
		if _, err := manager.InitRepo(ctx, mwanachamagit.CreateRepoRequest{Name: "widgets"}); err != nil {
			t.Fatalf("InitRepo in %s: %v", name, err)
		}
		folders = append(folders, filepath.Join(root, inst.TableSlug))
	}
	for _, folder := range folders {
		files, err := filepath.Glob(filepath.Join(folder, "*.db"))
		if err != nil || len(files) != 1 {
			t.Fatalf("%s holds %v, %v; want exactly its own one file", folder, files, err)
		}
	}
}

func TestGitFolder_ImportingARepositoryIsRefusedOnFiles(t *testing.T) {
	f := newGitFolderFixture(t, 4)
	if _, err := f.manager.ImportRepo(f.ctx, mwanachamagit.ImportRepoRequest{Name: "x", SourceURL: "https://example.invalid/x.git"}); !errors.Is(err, mwanachamagit.ErrImportNeedsRepositoryFile) {
		t.Fatalf("ImportRepo = %v, want ErrImportNeedsRepositoryFile", err)
	}
}
