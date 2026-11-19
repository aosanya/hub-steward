package agencies

import (
	"context"
	"fmt"
	"io"
	"path/filepath"
	"strconv"

	mwanachamagit "github.com/aosanya/mwanachama-backend-git"
	"github.com/aosanya/mwanachama-backend-shared/spec"

	"wakalaserver/internal/specs"
)

const (
	gitDeclaration       = "wakala.git"
	gitFolderVariable    = "GIT_REPOSITORY_FOLDER"
	gitOpenFilesVariable = "GIT_OPEN_FILES"
	defaultGitOpenFiles  = 32
)

func WithGitRepositoryFolder(folder string, maxOpenFiles int) Option {
	return func(r *registry) {
		r.gitFolder = folder
		r.gitOpenFiles = max(maxOpenFiles, 1)
	}
}

func gitFolderFromEnv(getenv func(string) string) (string, int) {
	folder := getenv(gitFolderVariable)
	open, err := strconv.Atoi(getenv(gitOpenFilesVariable))
	if err != nil {
		open = defaultGitOpenFiles
	}
	return folder, max(open, 1)
}

func closeGitManager(_ string, manager mwanachamagit.GitManager) {
	if closer, ok := manager.(io.Closer); ok {
		go func() { _ = closer.Close() }()
	}
}

func (r *registry) GitManager(ctx context.Context, id string) (mwanachamagit.GitManager, error) {
	return pooled(ctx, r.gits, id, r.buildGitManager)
}

func gitSpecOf(inst Instance) (*spec.Spec, error) {
	raw, err := specs.For(gitDeclaration, inst.TableSlug)
	if err != nil {
		return nil, fmt.Errorf("GitManager: spec for instance %s: %w", inst.ID, err)
	}
	s, err := mwanachamagit.ParseSpec(raw)
	if err != nil {
		return nil, fmt.Errorf("GitManager: spec for instance %s: %w", inst.ID, err)
	}
	return s, nil
}

func (r *registry) buildGitManager(ctx context.Context, id string) (mwanachamagit.GitManager, error) {
	inst, err := r.GetInstance(ctx, id)
	if err != nil {
		return nil, err
	}
	s, err := gitSpecOf(inst)
	if err != nil {
		return nil, err
	}
	if r.gitFolder != "" {
		return r.buildFolderGitManager(ctx, inst, s)
	}
	if err := mwanachamagit.Provision(r.db, s); err != nil {
		return nil, fmt.Errorf("GitManager: provision instance %s: %w", id, err)
	}
	built, err := mwanachamagit.NewGitManager(r.db, s, nil, nil, nil)
	if err != nil {
		return nil, err
	}
	return built, nil
}

func (r *registry) buildFolderGitManager(ctx context.Context, inst Instance, s *spec.Spec) (mwanachamagit.GitManager, error) {
	manager, err := r.CatalogManager(ctx, inst.ID, RepositoriesMount)
	if err != nil {
		return nil, fmt.Errorf("GitManager: repository catalog of instance %s: %w", inst.ID, err)
	}
	built, err := mwanachamagit.NewRoutedGitManager(filepath.Join(r.gitFolder, inst.TableSlug), r.gitOpenFiles, s, NewRepositoryCatalog(manager))
	if err != nil {
		return nil, fmt.Errorf("GitManager: repository folder of instance %s: %w", inst.ID, err)
	}
	return built, nil
}
