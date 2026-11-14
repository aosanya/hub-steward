package mwanachamagit

import (
	"context"
	"errors"
	"fmt"

	"gorm.io/gorm"

	"wakalaserver/modules/git/models"
)

func (m *gitManager) InitRepo(ctx context.Context, req CreateRepoRequest) (models.Repository, error) {
	if m.singleRepository {
		var existing int64
		if err := m.db.WithContext(ctx).Table(m.tables.Repositories).
			Where("NOT deleted").Count(&existing).Error; err != nil {
			return models.Repository{}, fmt.Errorf("InitRepo: count repositories: %w", err)
		}
		if existing > 0 {
			return models.Repository{}, ErrRepoAlreadyExists
		}
	}

	var count int64
	if err := m.db.WithContext(ctx).Table(m.tables.Repositories).
		Where("name = ? AND NOT deleted", req.Name).Count(&count).Error; err != nil {
		return models.Repository{}, fmt.Errorf("InitRepo: check existing: %w", err)
	}
	if count > 0 {
		return models.Repository{}, ErrRepoAlreadyExists
	}

	defaultBranch := req.DefaultBranch
	if defaultBranch == "" {
		defaultBranch = "main"
	}
	now := models.NowRFC3339()

	row := models.Repository{
		Name:          req.Name,
		Description:   req.Description,
		DefaultBranch: defaultBranch,
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	ensureID(&row)
	if err := m.db.WithContext(ctx).Table(m.tables.Repositories).Create(&row).Error; err != nil {
		return models.Repository{}, fmt.Errorf("InitRepo: create repository: %w", err)
	}

	branchRow := models.Branch{
		Name:      defaultBranch,
		IsDefault: true,
		CreatedAt: now,
		UpdatedAt: now,
	}
	branchRow.RepositoryID = row.ID
	ensureID(&branchRow)
	if err := m.db.WithContext(ctx).Table(m.tables.Branches).Create(&branchRow).Error; err != nil {
		return models.Repository{}, fmt.Errorf("InitRepo: create default branch: %w", err)
	}

	if err := m.registerInCatalog(ctx, row); err != nil {
		return models.Repository{}, fmt.Errorf("InitRepo: register in catalog: %w", err)
	}

	repo := row
	m.publish(ctx, TopicRepoCreated, RepoCreatedPayload{RepoID: repo.ID, Name: req.Name})
	return repo, nil
}

func (m *gitManager) ListRepositories(ctx context.Context) ([]models.Repository, error) {
	if m.catalog != nil {
		return m.listCataloguedRepositories(ctx)
	}
	var rows []models.Repository
	if err := m.db.WithContext(ctx).Table(m.tables.Repositories).
		Where("NOT deleted").Limit(maxListPage).Find(&rows).Error; err != nil {
		return nil, fmt.Errorf("ListRepositories: %w", err)
	}
	out := make([]models.Repository, len(rows))
	for i, r := range rows {
		out[i] = r
	}
	return out, nil
}

func (m *gitManager) ListRepositorySummaries(ctx context.Context) ([]models.RepositorySummary, error) {
	repos, err := m.ListRepositories(ctx)
	if err != nil {
		return nil, fmt.Errorf("ListRepositorySummaries: %w", err)
	}
	out := make([]models.RepositorySummary, 0, len(repos))
	if len(repos) == 0 {
		return out, nil
	}
	ids := make([]string, len(repos))
	for i, r := range repos {
		ids[i] = r.ID
	}
	var defaults []models.Branch
	if err := m.db.WithContext(ctx).Table(m.tables.Branches).
		Where("repository_id IN ? AND is_default AND NOT deleted", ids).Find(&defaults).Error; err != nil {
		return nil, fmt.Errorf("ListRepositorySummaries: default branches: %w", err)
	}
	branchOf := make(map[string]string, len(defaults))
	for _, b := range defaults {
		branchOf[b.RepositoryID] = b.ID
	}
	for _, r := range repos {
		out = append(out, models.RepositorySummary{
			ID:              r.ID,
			Name:            r.Name,
			DefaultBranch:   r.DefaultBranch,
			DefaultBranchID: branchOf[r.ID],
		})
	}
	return out, nil
}

func (m *gitManager) GetRepository(ctx context.Context, repoID string) (models.Repository, error) {
	var row models.Repository
	err := m.db.WithContext(ctx).Table(m.tables.Repositories).
		Where("id = ? AND NOT deleted", repoID).First(&row).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return models.Repository{}, ErrRepoNotInitialised
		}
		return models.Repository{}, fmt.Errorf("GetRepository: %w", err)
	}
	return row, nil
}

func (m *gitManager) GetRepositoryByName(ctx context.Context, repoName string) (models.Repository, error) {
	var row models.Repository
	err := m.db.WithContext(ctx).Table(m.tables.Repositories).
		Where("name = ? AND NOT deleted", repoName).First(&row).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return models.Repository{}, ErrRepoNotInitialised
		}
		return models.Repository{}, fmt.Errorf("GetRepositoryByName: %w", err)
	}
	return row, nil
}

func (m *gitManager) DeleteRepo(ctx context.Context, repoID string) error {
	repo, err := m.GetRepository(ctx, repoID)
	if err != nil {
		return fmt.Errorf("DeleteRepo: %w", err)
	}

	if err := m.db.WithContext(ctx).Table(m.tables.Branches).
		Where("repository_id = ?", repo.ID).Update("deleted", true).Error; err != nil {
		return fmt.Errorf("DeleteRepo: delete branches: %w", err)
	}
	if err := m.db.WithContext(ctx).Table(m.tables.Tags).
		Where("repository_id = ?", repo.ID).Update("deleted", true).Error; err != nil {
		return fmt.Errorf("DeleteRepo: delete tags: %w", err)
	}
	if err := m.db.WithContext(ctx).Table(m.tables.Repositories).
		Where("id = ?", repo.ID).Update("deleted", true).Error; err != nil {
		return fmt.Errorf("DeleteRepo: delete repo: %w", err)
	}
	if err := m.removeFromCatalog(ctx, repo.ID); err != nil {
		return fmt.Errorf("DeleteRepo: remove from catalog: %w", err)
	}
	return nil
}

func (m *gitManager) PurgeRepo(ctx context.Context, repoID string) error {
	return m.DeleteRepo(ctx, repoID)
}
