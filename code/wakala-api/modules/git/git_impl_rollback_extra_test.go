package mwanachamagit

import (
	"context"
	"testing"

	"wakalaserver/modules/git/models"
)

func TestRollbackByWorkflowRun_PublishesExpectedEvents(t *testing.T) {
	const targetRun = "wfr_rollback_target"
	const otherRun = "wfr_rollback_other"
	ctx := context.Background()
	m, pub := newTestManagerWithPublisher(t)
	repo, err := m.InitRepo(ctx, CreateRepoRequest{Name: "r"})
	if err != nil {
		t.Fatalf("InitRepo: %v", err)
	}

	target1, err := m.CreateBranch(ctx, CreateBranchRequest{RepositoryID: repo.ID, Name: "feature/target-1", WorkflowRunID: targetRun})
	if err != nil {
		t.Fatalf("CreateBranch target-1: %v", err)
	}
	target2, err := m.CreateBranch(ctx, CreateBranchRequest{RepositoryID: repo.ID, Name: "feature/target-2", WorkflowRunID: targetRun})
	if err != nil {
		t.Fatalf("CreateBranch target-2: %v", err)
	}
	otherBranch, err := m.CreateBranch(ctx, CreateBranchRequest{RepositoryID: repo.ID, Name: "feature/other", WorkflowRunID: otherRun})
	if err != nil {
		t.Fatalf("CreateBranch other: %v", err)
	}

	target1MR, err := m.CreateMergeRequest(ctx, CreateMergeRequestRequest{RepositoryID: repo.ID, Title: "target-1", SourceBranchID: target1.ID, WorkflowRunID: targetRun})
	if err != nil {
		t.Fatalf("CreateMergeRequest target-1: %v", err)
	}
	target2MR, err := m.CreateMergeRequest(ctx, CreateMergeRequestRequest{RepositoryID: repo.ID, Title: "target-2", SourceBranchID: target2.ID, WorkflowRunID: targetRun})
	if err != nil {
		t.Fatalf("CreateMergeRequest target-2: %v", err)
	}
	otherMR, err := m.CreateMergeRequest(ctx, CreateMergeRequestRequest{RepositoryID: repo.ID, Title: "other", SourceBranchID: otherBranch.ID, WorkflowRunID: otherRun})
	if err != nil {
		t.Fatalf("CreateMergeRequest other: %v", err)
	}

	result, err := m.RollbackByWorkflowRun(ctx, targetRun)
	if err != nil {
		t.Fatalf("RollbackByWorkflowRun: %v", err)
	}
	if result.BranchesDeleted != 2 || result.MergeRequestsRolledBack != 2 {
		t.Errorf("result = %+v, want 2 branches + 2 MRs", result)
	}

	gotOther, err := m.GetMergeRequest(ctx, otherMR.ID)
	if err != nil {
		t.Fatalf("GetMergeRequest other: %v", err)
	}
	if gotOther.Status != models.MergeRequestStatusOpen {
		t.Errorf("other MR status = %q, want %q (untouched)", gotOther.Status, models.MergeRequestStatusOpen)
	}
	_ = target1MR
	_ = target2MR

	events := pub.published()
	mrEvents := countByTopic(events, TopicMergeRolledBack)
	summary := countByTopic(events, TopicWorkflowRunRolledBack)
	if mrEvents != 2 {
		t.Errorf("TopicMergeRolledBack count = %d, want 2", mrEvents)
	}
	if summary != 1 {
		t.Errorf("TopicWorkflowRunRolledBack count = %d, want 1", summary)
	}
}

func TestRollbackByWorkflowRun_PreservesMergedSHA(t *testing.T) {
	const runID = "wfr_rollback_merged"
	ctx := context.Background()
	m := newTestManager(t)
	repo, err := m.InitRepo(ctx, CreateRepoRequest{Name: "r"})
	if err != nil {
		t.Fatalf("InitRepo: %v", err)
	}
	source, err := m.CreateBranch(ctx, CreateBranchRequest{RepositoryID: repo.ID, Name: "feature/already-merged", WorkflowRunID: runID})
	if err != nil {
		t.Fatalf("CreateBranch: %v", err)
	}
	mr, err := m.CreateMergeRequest(ctx, CreateMergeRequestRequest{RepositoryID: repo.ID, Title: "Merged MR", SourceBranchID: source.ID, WorkflowRunID: runID})
	if err != nil {
		t.Fatalf("CreateMergeRequest: %v", err)
	}

	if err := m.db.WithContext(ctx).Table(m.tables.MergeRequests).Where("id = ?", mr.ID).Updates(map[string]any{
		"status":            models.MergeRequestStatusMerged,
		"merged_commit_sha": "deadbeefdeadbeefdeadbeef",
	}).Error; err != nil {
		t.Fatalf("fake merge transition: %v", err)
	}

	if _, err := m.RollbackByWorkflowRun(ctx, runID); err != nil {
		t.Fatalf("RollbackByWorkflowRun: %v", err)
	}

	got, err := m.GetMergeRequest(ctx, mr.ID)
	if err != nil {
		t.Fatalf("GetMergeRequest: %v", err)
	}
	if got.Status != models.MergeRequestStatusRolledBack {
		t.Errorf("status = %q, want %q", got.Status, models.MergeRequestStatusRolledBack)
	}
	if got.MergedCommitSHA != "deadbeefdeadbeefdeadbeef" {
		t.Errorf("merged_commit_sha = %q, want preserved", got.MergedCommitSHA)
	}
}

func TestRollbackByWorkflowRun_NoOpWhenRunProducedNothing(t *testing.T) {
	ctx := context.Background()
	m, pub := newTestManagerWithPublisher(t)
	if _, err := m.InitRepo(ctx, CreateRepoRequest{Name: "r"}); err != nil {
		t.Fatalf("InitRepo: %v", err)
	}

	result, err := m.RollbackByWorkflowRun(ctx, "wfr_no_artifacts")
	if err != nil {
		t.Fatalf("RollbackByWorkflowRun: %v", err)
	}
	if result.BranchesDeleted != 0 || result.MergeRequestsRolledBack != 0 {
		t.Errorf("expected zero counters, got %+v", result)
	}
	events := pub.published()
	if countByTopic(events, TopicWorkflowRunRolledBack) != 1 {
		t.Errorf("expected summary event even on no-op; got %v", events)
	}
	if countByTopic(events, TopicMergeRolledBack) != 0 {
		t.Errorf("expected no TopicMergeRolledBack on no-op; got %v", events)
	}
}

func TestRollbackByWorkflowRun_PreservesDefaultBranch(t *testing.T) {
	const runID = "wfr_rollback_default"
	ctx := context.Background()
	m := newTestManager(t)
	repo, err := m.InitRepo(ctx, CreateRepoRequest{Name: "r"})
	if err != nil {
		t.Fatalf("InitRepo: %v", err)
	}
	branches, _ := m.ListBranches(ctx, repo.ID)
	defaultBranch := branches[0]

	if err := m.db.WithContext(ctx).Table(m.tables.Branches).Where("id = ?", defaultBranch.ID).
		Update("workflow_run_id", runID).Error; err != nil {
		t.Fatalf("backfill default branch run_id: %v", err)
	}

	result, err := m.RollbackByWorkflowRun(ctx, runID)
	if err != nil {
		t.Fatalf("RollbackByWorkflowRun: %v", err)
	}
	if result.DefaultBranchesSkipped != 1 {
		t.Errorf("DefaultBranchesSkipped = %d, want 1", result.DefaultBranchesSkipped)
	}
	if result.BranchesDeleted != 0 {
		t.Errorf("BranchesDeleted = %d, want 0", result.BranchesDeleted)
	}
	if _, err := m.GetBranch(ctx, defaultBranch.ID); err != nil {
		t.Errorf("default branch deleted unexpectedly: %v", err)
	}
}
