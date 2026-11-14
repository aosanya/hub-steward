package mwanachamagit

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"testing"

	"wakalaserver/modules/git/models"
)

func TestGIT011_ConcurrentMerges(t *testing.T) {
	ctx := context.Background()
	m := newTestManager(t)
	repo, err := m.InitRepo(ctx, CreateRepoRequest{Name: "r"})
	if err != nil {
		t.Fatalf("InitRepo: %v", err)
	}
	branchA, err := m.CreateBranch(ctx, CreateBranchRequest{RepositoryID: repo.ID, Name: "concurrent-a"})
	if err != nil {
		t.Fatalf("CreateBranch a: %v", err)
	}
	branchB, err := m.CreateBranch(ctx, CreateBranchRequest{RepositoryID: repo.ID, Name: "concurrent-b"})
	if err != nil {
		t.Fatalf("CreateBranch b: %v", err)
	}
	writeTestFile(t, m, branchA.ID, "a.txt", "branch-a content")
	writeTestFile(t, m, branchB.ID, "b.txt", "branch-b content")

	var wg sync.WaitGroup
	errs := make([]error, 2)
	for i, id := range []string{branchA.ID, branchB.ID} {
		wg.Add(1)
		go func(idx int, branchID string) {
			defer wg.Done()
			_, errs[idx] = m.MergeBranch(ctx, branchID)
		}(i, id)
	}
	wg.Wait()

	for i, err := range errs {
		if err != nil {
			t.Errorf("goroutine %d MergeBranch failed: %v", i, err)
		}
	}
}

func TestBUG09020_ConcurrentWriteFilesAllLand(t *testing.T) {
	ctx := context.Background()
	m := newTestManager(t)
	repo, err := m.InitRepo(ctx, CreateRepoRequest{Name: "r"})
	if err != nil {
		t.Fatalf("InitRepo: %v", err)
	}
	branch, err := m.CreateBranch(ctx, CreateBranchRequest{RepositoryID: repo.ID, Name: "bug09020-concurrent-writes"})
	if err != nil {
		t.Fatalf("CreateBranch: %v", err)
	}

	const n = 10
	paths := make([]string, n)
	for i := range paths {
		paths[i] = fmt.Sprintf("dir/file_%02d.txt", i)
	}

	var wg sync.WaitGroup
	errs := make([]error, n)
	for i := 0; i < n; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			_, errs[idx] = m.WriteFile(ctx, WriteFileRequest{
				BranchID: branch.ID, Path: paths[idx], Content: fmt.Sprintf("content-%02d", idx), AuthorName: "test-author",
			})
		}(i)
	}
	wg.Wait()

	for i, err := range errs {
		if err != nil {
			t.Errorf("WriteFile %d failed: %v", i, err)
		}
	}

	for _, p := range paths {
		blob, err := m.ReadFile(ctx, branch.ID, p)
		if err != nil {
			t.Errorf("ReadFile %q after concurrent writes: %v", p, err)
			continue
		}
		if blob.Path != p {
			t.Errorf("ReadFile %q returned blob with Path=%q", p, blob.Path)
		}
	}
}

func TestGIT011_MergeLockRespectsContextCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	m := newTestManager(t)
	repo, err := m.InitRepo(context.Background(), CreateRepoRequest{Name: "r"})
	if err != nil {
		t.Fatalf("InitRepo: %v", err)
	}
	branch, err := m.CreateBranch(context.Background(), CreateBranchRequest{RepositoryID: repo.ID, Name: "ctx-cancel-001"})
	if err != nil {
		t.Fatalf("CreateBranch: %v", err)
	}
	writeTestFile(t, m, branch.ID, "file.txt", "content")

	_, err = m.MergeBranch(ctx, branch.ID)
	if !errors.Is(err, context.Canceled) {
		t.Errorf("expected context.Canceled, got %v", err)
	}
}

func TestGIT011_AdvanceBranchHead_StaleHeadReturnsConflict(t *testing.T) {
	ctx := context.Background()
	m := newTestManager(t)
	const actualHead = "commit-current"

	branchRow := models.Branch{Name: "stale-head", HeadCommitID: actualHead}
	ensureID(&branchRow)
	if err := m.db.WithContext(ctx).Table(m.tables.Branches).Create(&branchRow).Error; err != nil {
		t.Fatalf("seed branch: %v", err)
	}
	commitRow := models.Commit{SHA: "abc123"}
	ensureID(&commitRow)
	if err := m.db.WithContext(ctx).Table(m.tables.Commits).Create(&commitRow).Error; err != nil {
		t.Fatalf("seed commit: %v", err)
	}

	_, err := m.advanceBranchHead(ctx, branchRow.ID, commitRow.ID, "commit-stale")
	if !errors.Is(err, ErrMergeConcurrencyConflict) {
		t.Fatalf("expected ErrMergeConcurrencyConflict, got %v", err)
	}
}

func TestGIT011_AdvanceBranchHead_MatchingHeadSucceeds(t *testing.T) {
	ctx := context.Background()
	m := newTestManager(t)
	const currentHead = "commit-current2"

	branchRow := models.Branch{Name: "matching-head", HeadCommitID: currentHead}
	ensureID(&branchRow)
	if err := m.db.WithContext(ctx).Table(m.tables.Branches).Create(&branchRow).Error; err != nil {
		t.Fatalf("seed branch: %v", err)
	}
	commitRow := models.Commit{SHA: "def456"}
	ensureID(&commitRow)
	if err := m.db.WithContext(ctx).Table(m.tables.Commits).Create(&commitRow).Error; err != nil {
		t.Fatalf("seed commit: %v", err)
	}

	if _, err := m.advanceBranchHead(ctx, branchRow.ID, commitRow.ID, currentHead); err != nil {
		t.Fatalf("expected success, got %v", err)
	}
}
