package mwanachamagit

import (
	"context"
	"testing"

	"wakalaserver/modules/git/models"
)

func countTaggedWith(t *testing.T, m *gitManager, blobID, targetBranchID string) int64 {
	t.Helper()
	var count int64
	if err := m.db.WithContext(context.Background()).Table(m.tables.BlobKeywordTags).
		Where("blob_id = ? AND branch_id = ?", blobID, targetBranchID).Count(&count).Error; err != nil {
		t.Fatalf("countTaggedWith: %v", err)
	}
	return count
}

func countReferences(t *testing.T, m *gitManager, blobID, targetBranchID string) int64 {
	t.Helper()
	var count int64
	if err := m.db.WithContext(context.Background()).Table(m.tables.BlobReferences).
		Where("from_blob_id = ? AND branch_id = ? AND name = ?", blobID, targetBranchID, "references").
		Count(&count).Error; err != nil {
		t.Fatalf("countReferences: %v", err)
	}
	return count
}

func writeTestFile(t *testing.T, m *gitManager, branchID, path, content string) string {
	t.Helper()
	ctx := context.Background()
	if _, err := m.WriteFile(ctx, WriteFileRequest{
		BranchID:   branchID,
		Path:       path,
		Content:    content,
		AuthorName: "test-author",
	}); err != nil {
		t.Fatalf("WriteFile %q on branch %q: %v", path, branchID, err)
	}
	blob, err := m.ReadFile(ctx, branchID, path)
	if err != nil {
		t.Fatalf("ReadFile %q after WriteFile: %v", path, err)
	}
	return blob.ID
}

func TestEdgeLifecycle_022a_TaggedWith(t *testing.T) {
	ctx := context.Background()
	m := newTestManager(t)
	repo, err := m.InitRepo(ctx, CreateRepoRequest{Name: "testrepo"})
	if err != nil {
		t.Fatalf("InitRepo: %v", err)
	}
	branches, _ := m.ListBranches(ctx, repo.ID)
	defaultBranchID := branches[0].ID

	taskBranch, err := m.CreateBranch(ctx, CreateBranchRequest{RepositoryID: repo.ID, Name: "task-kw-001"})
	if err != nil {
		t.Fatalf("CreateBranch: %v", err)
	}
	blobID := writeTestFile(t, m, taskBranch.ID, "docs/readme.md", "# Hello")

	kw, err := m.CreateKeyword(ctx, CreateKeywordRequest{Name: "docs"})
	if err != nil {
		t.Fatalf("CreateKeyword: %v", err)
	}
	if err := m.CreateEdge(ctx, CreateEdgeRequest{
		BranchID: taskBranch.ID, FromEntityID: blobID, ToEntityID: kw.ID, RelationshipName: "tagged_with",
	}); err != nil {
		t.Fatalf("CreateEdge tagged_with: %v", err)
	}

	if got := countTaggedWith(t, m, blobID, taskBranch.ID); got != 1 {
		t.Fatalf("before merge: want 1 tagged_with on task branch, got %d", got)
	}
	if got := countTaggedWith(t, m, blobID, defaultBranchID); got != 0 {
		t.Fatalf("before merge: want 0 tagged_with on default branch, got %d", got)
	}

	if _, err := m.MergeBranch(ctx, taskBranch.ID); err != nil {
		t.Fatalf("MergeBranch: %v", err)
	}

	if got := countTaggedWith(t, m, blobID, defaultBranchID); got != 1 {
		t.Fatalf("after merge: want 1 tagged_with on default branch, got %d", got)
	}
	if got := countTaggedWith(t, m, blobID, taskBranch.ID); got != 1 {
		t.Fatalf("after merge: task-branch tagged_with should still exist, got %d", got)
	}
}

func TestEdgeLifecycle_022a_References(t *testing.T) {
	ctx := context.Background()
	m := newTestManager(t)
	repo, err := m.InitRepo(ctx, CreateRepoRequest{Name: "testrepo"})
	if err != nil {
		t.Fatalf("InitRepo: %v", err)
	}

	branches, _ := m.ListBranches(ctx, repo.ID)
	defaultBranchID := branches[0].ID

	taskBranch, err := m.CreateBranch(ctx, CreateBranchRequest{RepositoryID: repo.ID, Name: "task-ref-001"})
	if err != nil {
		t.Fatalf("CreateBranch: %v", err)
	}
	blobA := writeTestFile(t, m, taskBranch.ID, "src/a.go", "package a")
	blobB := writeTestFile(t, m, taskBranch.ID, "src/b.go", "package b")

	if err := m.CreateEdge(ctx, CreateEdgeRequest{
		BranchID: taskBranch.ID, FromEntityID: blobB, ToEntityID: blobA,
		RelationshipName: "references", Properties: map[string]any{"descriptor": "depends_on"},
	}); err != nil {
		t.Fatalf("CreateEdge references: %v", err)
	}

	if got := countReferences(t, m, blobB, defaultBranchID); got != 0 {
		t.Fatalf("before merge: want 0 references on default branch, got %d", got)
	}

	if _, err := m.MergeBranch(ctx, taskBranch.ID); err != nil {
		t.Fatalf("MergeBranch: %v", err)
	}

	var rows []models.BlobReference
	if err := m.db.WithContext(ctx).Table(m.tables.BlobReferences).
		Where("from_blob_id = ? AND name = ?", blobB, "references").Find(&rows).Error; err != nil {
		t.Fatalf("query BlobReferences: %v", err)
	}
	var found bool
	for _, r := range rows {
		if r.BranchID == defaultBranchID {
			found = true
			if r.Descriptor != "depends_on" {
				t.Errorf("replicated references edge: descriptor = %q, want %q", r.Descriptor, "depends_on")
			}
		}
	}
	if !found {
		t.Fatal("after merge: no references edge found scoped to default branch")
	}
}

func TestEdgeLifecycle_022a_NoEdges(t *testing.T) {
	ctx := context.Background()
	m := newTestManager(t)
	repo, err := m.InitRepo(ctx, CreateRepoRequest{Name: "testrepo"})
	if err != nil {
		t.Fatalf("InitRepo: %v", err)
	}
	taskBranch, err := m.CreateBranch(ctx, CreateBranchRequest{RepositoryID: repo.ID, Name: "task-noedge-001"})
	if err != nil {
		t.Fatalf("CreateBranch: %v", err)
	}
	writeTestFile(t, m, taskBranch.ID, "docs/readme.md", "# Hello")

	if _, err := m.MergeBranch(ctx, taskBranch.ID); err != nil {
		t.Fatalf("MergeBranch (no edges): %v", err)
	}
}

func TestEdgeLifecycle_022b_DeleteBranchCleansEdges(t *testing.T) {
	ctx := context.Background()
	m := newTestManager(t)
	repo, err := m.InitRepo(ctx, CreateRepoRequest{Name: "testrepo"})
	if err != nil {
		t.Fatalf("InitRepo: %v", err)
	}
	taskBranch, err := m.CreateBranch(ctx, CreateBranchRequest{RepositoryID: repo.ID, Name: "task-del-001"})
	if err != nil {
		t.Fatalf("CreateBranch: %v", err)
	}
	blobID := writeTestFile(t, m, taskBranch.ID, "src/main.go", "package main")

	kw, err := m.CreateKeyword(ctx, CreateKeywordRequest{Name: "service"})
	if err != nil {
		t.Fatalf("CreateKeyword: %v", err)
	}
	if err := m.CreateEdge(ctx, CreateEdgeRequest{
		BranchID: taskBranch.ID, FromEntityID: blobID, ToEntityID: kw.ID, RelationshipName: "tagged_with",
	}); err != nil {
		t.Fatalf("CreateEdge: %v", err)
	}

	if got := countTaggedWith(t, m, blobID, taskBranch.ID); got != 1 {
		t.Fatalf("before DeleteBranch: want 1 edge, got %d", got)
	}

	if err := m.DeleteBranch(ctx, taskBranch.ID); err != nil {
		t.Fatalf("DeleteBranch: %v", err)
	}

	if got := countTaggedWith(t, m, blobID, taskBranch.ID); got != 0 {
		t.Fatalf("after DeleteBranch: want 0 edges, got %d", got)
	}
}

func TestEdgeLifecycle_022b_OnlyDeletesScopedEdges(t *testing.T) {
	ctx := context.Background()
	m := newTestManager(t)
	repo, err := m.InitRepo(ctx, CreateRepoRequest{Name: "testrepo"})
	if err != nil {
		t.Fatalf("InitRepo: %v", err)
	}
	branches, _ := m.ListBranches(ctx, repo.ID)
	defaultBranchID := branches[0].ID

	branchA, err := m.CreateBranch(ctx, CreateBranchRequest{RepositoryID: repo.ID, Name: "task-scope-a"})
	if err != nil {
		t.Fatalf("CreateBranch: %v", err)
	}
	blobID := writeTestFile(t, m, branchA.ID, "src/util.go", "package util")

	kw, err := m.CreateKeyword(ctx, CreateKeywordRequest{Name: "util"})
	if err != nil {
		t.Fatalf("CreateKeyword: %v", err)
	}
	if err := m.CreateEdge(ctx, CreateEdgeRequest{
		BranchID: branchA.ID, FromEntityID: blobID, ToEntityID: kw.ID, RelationshipName: "tagged_with",
	}); err != nil {
		t.Fatalf("CreateEdge on branchA: %v", err)
	}

	if _, err := m.MergeBranch(ctx, branchA.ID); err != nil {
		t.Fatalf("MergeBranch branchA: %v", err)
	}
	if err := m.DeleteBranch(ctx, branchA.ID); err != nil {
		t.Fatalf("DeleteBranch branchA: %v", err)
	}

	if got := countTaggedWith(t, m, blobID, branchA.ID); got != 0 {
		t.Errorf("after delete branchA: want 0 edges on branchA, got %d", got)
	}
	if got := countTaggedWith(t, m, blobID, defaultBranchID); got != 1 {
		t.Errorf("after delete branchA: default-branch edge should survive, got %d", got)
	}
}

func TestEdgeLifecycle_022c_DeleteFileRemovesEdges(t *testing.T) {
	ctx := context.Background()
	m := newTestManager(t)
	repo, err := m.InitRepo(ctx, CreateRepoRequest{Name: "testrepo"})
	if err != nil {
		t.Fatalf("InitRepo: %v", err)
	}
	taskBranch, err := m.CreateBranch(ctx, CreateBranchRequest{RepositoryID: repo.ID, Name: "task-delfile-001"})
	if err != nil {
		t.Fatalf("CreateBranch: %v", err)
	}
	blobID := writeTestFile(t, m, taskBranch.ID, "docs/guide.md", "# Guide")

	kw, err := m.CreateKeyword(ctx, CreateKeywordRequest{Name: "guide"})
	if err != nil {
		t.Fatalf("CreateKeyword: %v", err)
	}
	if err := m.CreateEdge(ctx, CreateEdgeRequest{
		BranchID: taskBranch.ID, FromEntityID: blobID, ToEntityID: kw.ID, RelationshipName: "tagged_with",
	}); err != nil {
		t.Fatalf("CreateEdge: %v", err)
	}

	if got := countTaggedWith(t, m, blobID, taskBranch.ID); got != 1 {
		t.Fatalf("before DeleteFile: want 1 edge, got %d", got)
	}

	if _, err := m.DeleteFile(ctx, DeleteFileRequest{
		BranchID: taskBranch.ID, Path: "docs/guide.md", AuthorName: "test",
	}); err != nil {
		t.Fatalf("DeleteFile: %v", err)
	}

	if got := countTaggedWith(t, m, blobID, taskBranch.ID); got != 0 {
		t.Fatalf("after DeleteFile: want 0 edges, got %d", got)
	}
}
