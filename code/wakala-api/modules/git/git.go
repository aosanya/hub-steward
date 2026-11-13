package mwanachamagit

import (
	"context"
	"fmt"
	"net/http"
	"sync"

	"gorm.io/gorm"

	"wakalaserver/modules/git/models"
	"wakalaserver/modules/shared/events"
	"wakalaserver/modules/shared/spec"
)

type (
	Repository     = models.Repository
	Branch         = models.Branch
	MergeRequest   = models.MergeRequest
	Tag            = models.Tag
	Keyword        = models.Keyword
	ImportJob      = models.ImportJob
	FetchBranchJob = models.FetchBranchJob
)

type GitManager interface {
	InitRepo(ctx context.Context, req CreateRepoRequest) (models.Repository, error)

	ListRepositories(ctx context.Context) ([]models.Repository, error)

	ListRepositorySummaries(ctx context.Context) ([]models.RepositorySummary, error)

	GetRepository(ctx context.Context, repoID string) (models.Repository, error)

	GetRepositoryByName(ctx context.Context, repoName string) (models.Repository, error)

	GetBranchByName(ctx context.Context, repoID string, branchName string) (models.Branch, error)

	DeleteRepo(ctx context.Context, repoID string) error

	PurgeRepo(ctx context.Context, repoID string) error

	CreateBranch(ctx context.Context, req CreateBranchRequest) (models.Branch, error)

	GetBranch(ctx context.Context, branchID string) (models.Branch, error)

	ListBranches(ctx context.Context, repoID string) ([]models.Branch, error)

	DeleteBranch(ctx context.Context, branchID string) error

	MergeBranch(ctx context.Context, branchID string) (models.Branch, error)
	RebaseBranch(ctx context.Context, req RebaseBranchRequest) (models.Branch, error)

	ListBranchesFiltered(ctx context.Context, repoID string, filter BranchFilter) ([]models.Branch, error)

	CreateMergeRequest(ctx context.Context, req CreateMergeRequestRequest) (models.MergeRequest, error)

	GetMergeRequest(ctx context.Context, mrID string) (models.MergeRequest, error)

	ListMergeRequests(ctx context.Context, filter MergeRequestFilter) ([]models.MergeRequest, error)

	CompleteMergeRequest(ctx context.Context, mrID, mergedBy string) (models.MergeRequest, error)

	CloseMergeRequest(ctx context.Context, mrID string) (models.MergeRequest, error)

	RollbackByWorkflowRun(ctx context.Context, workflowRunID string) (RollbackResult, error)

	CreateTag(ctx context.Context, req CreateTagRequest) (models.Tag, error)

	GetTag(ctx context.Context, tagID string) (models.Tag, error)

	ListTags(ctx context.Context, repoID string) ([]models.Tag, error)

	DeleteTag(ctx context.Context, tagID string) error

	WriteFile(ctx context.Context, req WriteFileRequest) (models.Commit, error)

	ReadFile(ctx context.Context, branchID, path string) (models.Blob, error)

	DeleteFile(ctx context.Context, req DeleteFileRequest) (models.Commit, error)

	ListDirectory(ctx context.Context, branchID, path string) ([]FileEntry, error)

	Log(ctx context.Context, branchID string, filter LogFilter) ([]CommitEntry, error)

	Diff(ctx context.Context, fromRef, toRef string) ([]FileDiff, error)

	ImportRepo(ctx context.Context, req ImportRepoRequest) (models.ImportJob, error)

	GetImportStatus(ctx context.Context, jobID string) (models.ImportJob, error)

	CancelImport(ctx context.Context, jobID string) error

	CreateKeyword(ctx context.Context, req CreateKeywordRequest) (models.Keyword, error)

	GetKeyword(ctx context.Context, keywordID string) (models.Keyword, error)

	ListKeywords(ctx context.Context, filter KeywordFilter) ([]models.Keyword, error)

	GetKeywordTree(ctx context.Context, keywordID string) ([]KeywordTreeNode, error)

	UpdateKeyword(ctx context.Context, keywordID string, req UpdateKeywordRequest) (models.Keyword, error)

	DeleteKeyword(ctx context.Context, keywordID string) error

	CreateEdge(ctx context.Context, req CreateEdgeRequest) error

	DeleteEdge(ctx context.Context, req DeleteEdgeRequest) error

	GetNeighborhood(ctx context.Context, branchID, entityID string, depth int) (GraphResult, error)

	SearchByKeywords(ctx context.Context, req SearchByKeywordsRequest) (GraphResult, error)

	QueryGraph(ctx context.Context, req QueryGraphRequest) (GraphResult, error)

	FetchBranch(ctx context.Context, req FetchBranchRequest) (models.FetchBranchJob, error)

	GetFetchBranchStatus(ctx context.Context, jobID string) (models.FetchBranchJob, error)

	IndexPushedBranch(ctx context.Context, repoName, branchRef, oldSHA, newSHA string) error

	SmartHTTPHandler() http.Handler

	SearchBlobs(ctx context.Context, req SearchBlobsRequest) ([]BlobSearchResult, error)
}

type BlobSearcher interface {
	Search(ctx context.Context, query string, limit int) ([]BlobSearchResult, error)
}

type RefLocker interface {
	WithMergeLock(ctx context.Context, fn func() error) error
}

type mutexLocker struct {
	mu sync.Mutex
}

func (l *mutexLocker) WithMergeLock(ctx context.Context, fn func() error) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	done := make(chan error, 1)
	go func() {
		l.mu.Lock()
		defer l.mu.Unlock()
		done <- fn()
	}()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case err := <-done:
		return err
	}
}

type gitManager struct {
	db        *gorm.DB
	store     *store
	tables    tableSet
	publisher events.Publisher
	locker    RefLocker
	searcher  BlobSearcher
	maxFile   int64
	merging   MergeGate

	catalog        RepositoryCatalog
	repositoryFile RepositoryFile

	singleRepository bool
}

func NewGitManager(
	db *gorm.DB,
	s *spec.Spec,
	pub events.Publisher,
	locker RefLocker,
	searcher BlobSearcher,
	opts ...Option,
) (GitManager, error) {
	if db == nil {
		return nil, fmt.Errorf("NewGitManager: db must not be nil")
	}
	st, err := newStore(db, s)
	if err != nil {
		return nil, fmt.Errorf("NewGitManager: %w", err)
	}
	if locker == nil {
		locker = &mutexLocker{}
	}
	m := &gitManager{
		db:        db,
		store:     st,
		tables:    tablesOf(st),
		publisher: pub,
		locker:    locker,
		searcher:  searcher,
	}
	for _, opt := range opts {
		opt(m)
	}
	return m, nil
}

func (m *gitManager) publish(ctx context.Context, topic string, payload any) {
	if m.publisher == nil {
		return
	}
	_ = m.publisher.Publish(ctx, topic, payload)
}
