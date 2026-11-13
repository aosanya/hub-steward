package agencies

import (
	"context"
	"errors"

	mwanachamagit "wakalaserver/modules/git"
	"wakalaserver/modules/git/models"
)

func (g *repositoryFolderGit) InitRepo(ctx context.Context, req mwanachamagit.CreateRepoRequest) (models.Repository, error) {
	return g.folder.Create(ctx, req)
}

func (g *repositoryFolderGit) DeleteRepo(ctx context.Context, repoID string) error {
	defer g.owners.clear()
	return g.folder.Delete(ctx, repoID)
}

func (g *repositoryFolderGit) PurgeRepo(ctx context.Context, repoID string) error {
	defer g.owners.clear()
	return g.folder.Purge(ctx, repoID)
}

func (g *repositoryFolderGit) ListRepositories(ctx context.Context) ([]models.Repository, error) {
	out := []models.Repository{}
	err := g.eachFile(ctx, func(entry mwanachamagit.RepositoryCatalogEntry, file *mwanachamagit.RepoFile) error {
		out = append(out, g.repositoryOf(ctx, entry, file))
		return nil
	})
	return out, err
}

func (g *repositoryFolderGit) repositoryOf(ctx context.Context, entry mwanachamagit.RepositoryCatalogEntry, file *mwanachamagit.RepoFile) models.Repository {
	repo, err := file.GetRepository(ctx, entry.ID)
	if err != nil {
		repo = models.Repository{}
	}
	repo.ID = entry.ID
	repo.Name = entry.Name
	if entry.LastCommitAt != "" {
		repo.UpdatedAt = entry.LastCommitAt
	}
	return repo
}

func (g *repositoryFolderGit) ListRepositorySummaries(ctx context.Context) ([]models.RepositorySummary, error) {
	out := []models.RepositorySummary{}
	err := g.eachFile(ctx, func(entry mwanachamagit.RepositoryCatalogEntry, file *mwanachamagit.RepoFile) error {
		repo := g.repositoryOf(ctx, entry, file)
		summary := models.RepositorySummary{ID: repo.ID, Name: repo.Name, DefaultBranch: repo.DefaultBranch}
		if branch, err := file.GetBranchByName(ctx, repo.ID, repo.DefaultBranch); err == nil {
			summary.DefaultBranchID = branch.ID
		}
		out = append(out, summary)
		return nil
	})
	return out, err
}

func (g *repositoryFolderGit) GetRepository(ctx context.Context, repoID string) (models.Repository, error) {
	return call(g.repo(ctx, repoID), func(f *mwanachamagit.RepoFile) (models.Repository, error) {
		return f.GetRepository(ctx, repoID)
	})
}

func (g *repositoryFolderGit) GetRepositoryByName(ctx context.Context, repoName string) (models.Repository, error) {
	return call(g.named(ctx, repoName), func(f *mwanachamagit.RepoFile) (models.Repository, error) {
		return f.GetRepositoryByName(ctx, repoName)
	})
}

func (g *repositoryFolderGit) GetBranchByName(ctx context.Context, repoID string, branchName string) (models.Branch, error) {
	return call(g.repo(ctx, repoID), func(f *mwanachamagit.RepoFile) (models.Branch, error) {
		return f.GetBranchByName(ctx, repoID, branchName)
	})
}

func (g *repositoryFolderGit) CreateBranch(ctx context.Context, req mwanachamagit.CreateBranchRequest) (models.Branch, error) {
	return call(g.repo(ctx, req.RepositoryID), func(f *mwanachamagit.RepoFile) (models.Branch, error) {
		return f.CreateBranch(ctx, req)
	})
}

func (g *repositoryFolderGit) GetBranch(ctx context.Context, branchID string) (models.Branch, error) {
	return call(g.branch(ctx, branchID), func(f *mwanachamagit.RepoFile) (models.Branch, error) {
		return f.GetBranch(ctx, branchID)
	})
}

func (g *repositoryFolderGit) ListBranches(ctx context.Context, repoID string) ([]models.Branch, error) {
	return call(g.repo(ctx, repoID), func(f *mwanachamagit.RepoFile) ([]models.Branch, error) {
		return f.ListBranches(ctx, repoID)
	})
}

func (g *repositoryFolderGit) ListBranchesFiltered(ctx context.Context, repoID string, filter mwanachamagit.BranchFilter) ([]models.Branch, error) {
	return call(g.repo(ctx, repoID), func(f *mwanachamagit.RepoFile) ([]models.Branch, error) {
		return f.ListBranchesFiltered(ctx, repoID, filter)
	})
}

func (g *repositoryFolderGit) DeleteBranch(ctx context.Context, branchID string) error {
	return g.branch(ctx, branchID)(func(f *mwanachamagit.RepoFile) error { return f.DeleteBranch(ctx, branchID) })
}

func (g *repositoryFolderGit) MergeBranch(ctx context.Context, branchID string) (models.Branch, error) {
	return call(g.branch(ctx, branchID), func(f *mwanachamagit.RepoFile) (models.Branch, error) {
		return f.MergeBranch(ctx, branchID)
	})
}

func (g *repositoryFolderGit) RebaseBranch(ctx context.Context, req mwanachamagit.RebaseBranchRequest) (models.Branch, error) {
	return call(g.branch(ctx, req.BranchID), func(f *mwanachamagit.RepoFile) (models.Branch, error) {
		return f.RebaseBranch(ctx, req)
	})
}

func (g *repositoryFolderGit) CreateMergeRequest(ctx context.Context, req mwanachamagit.CreateMergeRequestRequest) (models.MergeRequest, error) {
	return call(g.repo(ctx, req.RepositoryID), func(f *mwanachamagit.RepoFile) (models.MergeRequest, error) {
		return f.CreateMergeRequest(ctx, req)
	})
}

func (g *repositoryFolderGit) GetMergeRequest(ctx context.Context, mrID string) (models.MergeRequest, error) {
	return call(g.mergeRequest(ctx, mrID), func(f *mwanachamagit.RepoFile) (models.MergeRequest, error) {
		return f.GetMergeRequest(ctx, mrID)
	})
}

func (g *repositoryFolderGit) ListMergeRequests(ctx context.Context, filter mwanachamagit.MergeRequestFilter) ([]models.MergeRequest, error) {
	if filter.RepositoryID != "" {
		return call(g.repo(ctx, filter.RepositoryID), func(f *mwanachamagit.RepoFile) ([]models.MergeRequest, error) {
			return f.ListMergeRequests(ctx, filter)
		})
	}
	out := []models.MergeRequest{}
	err := g.eachFile(ctx, func(_ mwanachamagit.RepositoryCatalogEntry, file *mwanachamagit.RepoFile) error {
		found, err := file.ListMergeRequests(ctx, filter)
		out = append(out, found...)
		return err
	})
	if filter.Limit > 0 && len(out) > filter.Limit {
		out = out[:filter.Limit]
	}
	return out, err
}

func (g *repositoryFolderGit) CompleteMergeRequest(ctx context.Context, mrID, mergedBy string) (models.MergeRequest, error) {
	return call(g.mergeRequest(ctx, mrID), func(f *mwanachamagit.RepoFile) (models.MergeRequest, error) {
		return f.CompleteMergeRequest(ctx, mrID, mergedBy)
	})
}

func (g *repositoryFolderGit) CloseMergeRequest(ctx context.Context, mrID string) (models.MergeRequest, error) {
	return call(g.mergeRequest(ctx, mrID), func(f *mwanachamagit.RepoFile) (models.MergeRequest, error) {
		return f.CloseMergeRequest(ctx, mrID)
	})
}

func (g *repositoryFolderGit) RollbackByWorkflowRun(ctx context.Context, workflowRunID string) (mwanachamagit.RollbackResult, error) {
	if workflowRunID == "" {
		return mwanachamagit.RollbackResult{}, mwanachamagit.ErrWorkflowRunIDRequired
	}
	total := mwanachamagit.RollbackResult{WorkflowRunID: workflowRunID}
	err := g.eachFile(ctx, func(_ mwanachamagit.RepositoryCatalogEntry, file *mwanachamagit.RepoFile) error {
		part, err := file.RollbackByWorkflowRun(ctx, workflowRunID)
		total.BranchesDeleted += part.BranchesDeleted
		total.MergeRequestsRolledBack += part.MergeRequestsRolledBack
		total.DefaultBranchesSkipped += part.DefaultBranchesSkipped
		return err
	})
	return total, err
}

func (g *repositoryFolderGit) CreateTag(ctx context.Context, req mwanachamagit.CreateTagRequest) (models.Tag, error) {
	return call(g.repo(ctx, req.RepositoryID), func(f *mwanachamagit.RepoFile) (models.Tag, error) {
		return f.CreateTag(ctx, req)
	})
}

func (g *repositoryFolderGit) GetTag(ctx context.Context, tagID string) (models.Tag, error) {
	return call(g.tag(ctx, tagID), func(f *mwanachamagit.RepoFile) (models.Tag, error) {
		return f.GetTag(ctx, tagID)
	})
}

func (g *repositoryFolderGit) ListTags(ctx context.Context, repoID string) ([]models.Tag, error) {
	return call(g.repo(ctx, repoID), func(f *mwanachamagit.RepoFile) ([]models.Tag, error) {
		return f.ListTags(ctx, repoID)
	})
}

func (g *repositoryFolderGit) DeleteTag(ctx context.Context, tagID string) error {
	return g.tag(ctx, tagID)(func(f *mwanachamagit.RepoFile) error { return f.DeleteTag(ctx, tagID) })
}

func (g *repositoryFolderGit) WriteFile(ctx context.Context, req mwanachamagit.WriteFileRequest) (models.Commit, error) {
	return call(g.branch(ctx, req.BranchID), func(f *mwanachamagit.RepoFile) (models.Commit, error) {
		return f.WriteFile(ctx, req)
	})
}

func (g *repositoryFolderGit) ReadFile(ctx context.Context, branchID, path string) (models.Blob, error) {
	return call(g.branch(ctx, branchID), func(f *mwanachamagit.RepoFile) (models.Blob, error) {
		return f.ReadFile(ctx, branchID, path)
	})
}

func (g *repositoryFolderGit) DeleteFile(ctx context.Context, req mwanachamagit.DeleteFileRequest) (models.Commit, error) {
	return call(g.branch(ctx, req.BranchID), func(f *mwanachamagit.RepoFile) (models.Commit, error) {
		return f.DeleteFile(ctx, req)
	})
}

func (g *repositoryFolderGit) ListDirectory(ctx context.Context, branchID, path string) ([]mwanachamagit.FileEntry, error) {
	return call(g.branch(ctx, branchID), func(f *mwanachamagit.RepoFile) ([]mwanachamagit.FileEntry, error) {
		return f.ListDirectory(ctx, branchID, path)
	})
}

func (g *repositoryFolderGit) Log(ctx context.Context, branchID string, filter mwanachamagit.LogFilter) ([]mwanachamagit.CommitEntry, error) {
	return call(g.branch(ctx, branchID), func(f *mwanachamagit.RepoFile) ([]mwanachamagit.CommitEntry, error) {
		return f.Log(ctx, branchID, filter)
	})
}

func (g *repositoryFolderGit) Diff(ctx context.Context, fromRef, toRef string) ([]mwanachamagit.FileDiff, error) {
	var out []mwanachamagit.FileDiff
	err := g.locate(ctx, "", mwanachamagit.ErrRefNotFound, func(file *mwanachamagit.RepoFile) (bool, error) {
		diffs, err := file.Diff(ctx, fromRef, toRef)
		if errors.Is(err, mwanachamagit.ErrRefNotFound) {
			return false, nil
		}
		out = diffs
		return err == nil, err
	})
	return out, err
}

func (g *repositoryFolderGit) ImportRepo(ctx context.Context, req mwanachamagit.ImportRepoRequest) (models.ImportJob, error) {
	return models.ImportJob{}, ErrImportNeedsRepositoryFile
}

func (g *repositoryFolderGit) GetImportStatus(ctx context.Context, jobID string) (models.ImportJob, error) {
	return call(g.importJob(ctx, jobID), func(f *mwanachamagit.RepoFile) (models.ImportJob, error) {
		return f.GetImportStatus(ctx, jobID)
	})
}

func (g *repositoryFolderGit) CancelImport(ctx context.Context, jobID string) error {
	return g.importJob(ctx, jobID)(func(f *mwanachamagit.RepoFile) error { return f.CancelImport(ctx, jobID) })
}

func (g *repositoryFolderGit) CreateKeyword(ctx context.Context, req mwanachamagit.CreateKeywordRequest) (models.Keyword, error) {
	scope := g.first(ctx)
	if req.ParentID != "" {
		scope = g.keyword(ctx, req.ParentID)
	}
	return call(scope, func(f *mwanachamagit.RepoFile) (models.Keyword, error) {
		return f.CreateKeyword(ctx, req)
	})
}

func (g *repositoryFolderGit) GetKeyword(ctx context.Context, keywordID string) (models.Keyword, error) {
	return call(g.keyword(ctx, keywordID), func(f *mwanachamagit.RepoFile) (models.Keyword, error) {
		return f.GetKeyword(ctx, keywordID)
	})
}

func (g *repositoryFolderGit) ListKeywords(ctx context.Context, filter mwanachamagit.KeywordFilter) ([]models.Keyword, error) {
	if filter.ParentID != "" {
		return call(g.keyword(ctx, filter.ParentID), func(f *mwanachamagit.RepoFile) ([]models.Keyword, error) {
			return f.ListKeywords(ctx, filter)
		})
	}
	out := []models.Keyword{}
	err := g.eachFile(ctx, func(_ mwanachamagit.RepositoryCatalogEntry, file *mwanachamagit.RepoFile) error {
		found, err := file.ListKeywords(ctx, filter)
		out = append(out, found...)
		return err
	})
	if filter.Limit > 0 && len(out) > filter.Limit {
		out = out[:filter.Limit]
	}
	return out, err
}

func (g *repositoryFolderGit) GetKeywordTree(ctx context.Context, keywordID string) ([]mwanachamagit.KeywordTreeNode, error) {
	return call(g.keyword(ctx, keywordID), func(f *mwanachamagit.RepoFile) ([]mwanachamagit.KeywordTreeNode, error) {
		return f.GetKeywordTree(ctx, keywordID)
	})
}

func (g *repositoryFolderGit) UpdateKeyword(ctx context.Context, keywordID string, req mwanachamagit.UpdateKeywordRequest) (models.Keyword, error) {
	return call(g.keyword(ctx, keywordID), func(f *mwanachamagit.RepoFile) (models.Keyword, error) {
		return f.UpdateKeyword(ctx, keywordID, req)
	})
}

func (g *repositoryFolderGit) DeleteKeyword(ctx context.Context, keywordID string) error {
	return g.keyword(ctx, keywordID)(func(f *mwanachamagit.RepoFile) error { return f.DeleteKeyword(ctx, keywordID) })
}

func (g *repositoryFolderGit) CreateEdge(ctx context.Context, req mwanachamagit.CreateEdgeRequest) error {
	return g.branch(ctx, req.BranchID)(func(f *mwanachamagit.RepoFile) error { return f.CreateEdge(ctx, req) })
}

func (g *repositoryFolderGit) DeleteEdge(ctx context.Context, req mwanachamagit.DeleteEdgeRequest) error {
	return g.branch(ctx, req.BranchID)(func(f *mwanachamagit.RepoFile) error { return f.DeleteEdge(ctx, req) })
}

func (g *repositoryFolderGit) GetNeighborhood(ctx context.Context, branchID, entityID string, depth int) (mwanachamagit.GraphResult, error) {
	return call(g.branch(ctx, branchID), func(f *mwanachamagit.RepoFile) (mwanachamagit.GraphResult, error) {
		return f.GetNeighborhood(ctx, branchID, entityID, depth)
	})
}

func (g *repositoryFolderGit) SearchByKeywords(ctx context.Context, req mwanachamagit.SearchByKeywordsRequest) (mwanachamagit.GraphResult, error) {
	return call(g.branch(ctx, req.BranchID), func(f *mwanachamagit.RepoFile) (mwanachamagit.GraphResult, error) {
		return f.SearchByKeywords(ctx, req)
	})
}

func (g *repositoryFolderGit) QueryGraph(ctx context.Context, req mwanachamagit.QueryGraphRequest) (mwanachamagit.GraphResult, error) {
	return call(g.branch(ctx, req.BranchID), func(f *mwanachamagit.RepoFile) (mwanachamagit.GraphResult, error) {
		return f.QueryGraph(ctx, req)
	})
}

func (g *repositoryFolderGit) FetchBranch(ctx context.Context, req mwanachamagit.FetchBranchRequest) (models.FetchBranchJob, error) {
	return call(g.repo(ctx, req.RepoID), func(f *mwanachamagit.RepoFile) (models.FetchBranchJob, error) {
		return f.FetchBranch(ctx, req)
	})
}

func (g *repositoryFolderGit) GetFetchBranchStatus(ctx context.Context, jobID string) (models.FetchBranchJob, error) {
	return call(g.fetchJob(ctx, jobID), func(f *mwanachamagit.RepoFile) (models.FetchBranchJob, error) {
		return f.GetFetchBranchStatus(ctx, jobID)
	})
}

func (g *repositoryFolderGit) IndexPushedBranch(ctx context.Context, repoName, branchRef, oldSHA, newSHA string) error {
	return g.named(ctx, repoName)(func(f *mwanachamagit.RepoFile) error {
		return f.IndexPushedBranch(ctx, repoName, branchRef, oldSHA, newSHA)
	})
}

func (g *repositoryFolderGit) SearchBlobs(ctx context.Context, req mwanachamagit.SearchBlobsRequest) ([]mwanachamagit.BlobSearchResult, error) {
	return call(g.named(ctx, req.RepositoryName), func(f *mwanachamagit.RepoFile) ([]mwanachamagit.BlobSearchResult, error) {
		return f.SearchBlobs(ctx, req)
	})
}
