package agencies

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"sync"

	mwanachamagit "wakalaserver/modules/git"
	"github.com/aosanya/mwanachama-backend-shared/spec"
)

var ErrImportNeedsRepositoryFile = errors.New("importing a repository is not supported on per-repository files")

const maxRememberedOwners = 4096

type repoFileScope func(use func(*mwanachamagit.RepoFile) error) error

type repoFileAttempt func(file *mwanachamagit.RepoFile) (found bool, err error)

type fileOwners struct {
	mu    sync.Mutex
	names map[string]string
}

func (o *fileOwners) get(key string) (string, bool) {
	o.mu.Lock()
	defer o.mu.Unlock()
	name, ok := o.names[key]
	return name, ok
}

func (o *fileOwners) remember(key, fileName string) {
	o.mu.Lock()
	defer o.mu.Unlock()
	if o.names == nil || len(o.names) >= maxRememberedOwners {
		o.names = map[string]string{}
	}
	o.names[key] = fileName
}

func (o *fileOwners) forget(key string) {
	o.mu.Lock()
	defer o.mu.Unlock()
	delete(o.names, key)
}

func (o *fileOwners) clear() {
	o.mu.Lock()
	defer o.mu.Unlock()
	o.names = nil
}

type repositoryFolderGit struct {
	catalog mwanachamagit.RepositoryCatalog
	folder  *mwanachamagit.RepositoryFolder
	files   *mwanachamagit.RepoFiles
	owners  fileOwners
}

func newRepositoryFolderGit(folder string, maxOpen int, s *spec.Spec, catalog mwanachamagit.RepositoryCatalog) (*repositoryFolderGit, error) {
	openForCreate := func(path string) (*mwanachamagit.RepoFile, error) {
		return mwanachamagit.OpenRepoFile(path, s, nil, nil, nil)
	}
	openForUse := func(path string) (*mwanachamagit.RepoFile, error) {
		return mwanachamagit.OpenRepoFile(path, s, nil, nil, nil,
			mwanachamagit.WithRepositoryCatalog(catalog, RepositoryFileInFolder(folder, catalog)))
	}
	files, err := mwanachamagit.NewRepoFiles(folder, maxOpen, mwanachamagit.RegistrationCheckFromCatalog(catalog), openForUse)
	if err != nil {
		return nil, err
	}
	return &repositoryFolderGit{
		catalog: catalog,
		folder:  mwanachamagit.NewRepositoryFolder(folder, catalog, openForCreate),
		files:   files,
	}, nil
}

func (g *repositoryFolderGit) Close() error { return g.files.Close() }

func (g *repositoryFolderGit) openFiles() int { return g.files.Open() }

func call[T any](scope repoFileScope, use func(*mwanachamagit.RepoFile) (T, error)) (T, error) {
	var out T
	err := scope(func(file *mwanachamagit.RepoFile) error {
		var inner error
		out, inner = use(file)
		return inner
	})
	return out, err
}

func (g *repositoryFolderGit) repo(ctx context.Context, repoID string) repoFileScope {
	return func(use func(*mwanachamagit.RepoFile) error) error {
		entry, err := g.catalog.Lookup(ctx, repoID)
		if errors.Is(err, mwanachamagit.ErrRepositoryNotCatalogued) {
			return mwanachamagit.ErrRepoNotInitialised
		}
		if err != nil {
			return err
		}
		return g.files.With(ctx, entry.FileName, use)
	}
}

func (g *repositoryFolderGit) named(ctx context.Context, name string) repoFileScope {
	return func(use func(*mwanachamagit.RepoFile) error) error {
		entries, err := g.catalog.List(ctx)
		if err != nil {
			return err
		}
		for _, entry := range entries {
			if entry.Name == name {
				return g.files.With(ctx, entry.FileName, use)
			}
		}
		return mwanachamagit.ErrRepoNotInitialised
	}
}

func (g *repositoryFolderGit) first(ctx context.Context) repoFileScope {
	return func(use func(*mwanachamagit.RepoFile) error) error {
		entries, err := g.catalog.List(ctx)
		if err != nil {
			return err
		}
		if len(entries) == 0 {
			return mwanachamagit.ErrRepoNotInitialised
		}
		return g.files.With(ctx, entries[0].FileName, use)
	}
}

func (g *repositoryFolderGit) eachFile(ctx context.Context, use func(entry mwanachamagit.RepositoryCatalogEntry, file *mwanachamagit.RepoFile) error) error {
	entries, err := g.catalog.List(ctx)
	if err != nil {
		return err
	}
	for _, entry := range entries {
		err := g.files.With(ctx, entry.FileName, func(file *mwanachamagit.RepoFile) error { return use(entry, file) })
		if errors.Is(err, mwanachamagit.ErrRepositoryNotRegistered) {
			continue
		}
		if err != nil {
			return err
		}
	}
	return nil
}

func (g *repositoryFolderGit) attemptIn(ctx context.Context, fileName string, try repoFileAttempt) (bool, error) {
	var found bool
	err := g.files.With(ctx, fileName, func(file *mwanachamagit.RepoFile) error {
		var inner error
		found, inner = try(file)
		return inner
	})
	return found, err
}

func (g *repositoryFolderGit) locate(ctx context.Context, key string, missing error, try repoFileAttempt) error {
	if fileName, ok := g.owners.get(key); ok {
		found, err := g.attemptIn(ctx, fileName, try)
		if found || (err != nil && !errors.Is(err, mwanachamagit.ErrRepositoryNotRegistered)) {
			return err
		}
		g.owners.forget(key)
	}
	entries, err := g.catalog.List(ctx)
	if err != nil {
		return err
	}
	for _, entry := range entries {
		found, err := g.attemptIn(ctx, entry.FileName, try)
		if errors.Is(err, mwanachamagit.ErrRepositoryNotRegistered) {
			continue
		}
		if found && key != "" {
			g.owners.remember(key, entry.FileName)
		}
		if found || err != nil {
			return err
		}
	}
	return missing
}

type ownerProbe func(ctx context.Context, file *mwanachamagit.RepoFile, id string) error

func (g *repositoryFolderGit) owning(ctx context.Context, kind, id string, missing error, probe ownerProbe) repoFileScope {
	return func(use func(*mwanachamagit.RepoFile) error) error {
		return g.locate(ctx, kind+":"+id, missing, func(file *mwanachamagit.RepoFile) (bool, error) {
			if err := probe(ctx, file, id); err != nil {
				if errors.Is(err, missing) {
					return false, nil
				}
				return false, err
			}
			return true, use(file)
		})
	}
}

func (g *repositoryFolderGit) branch(ctx context.Context, id string) repoFileScope {
	return g.owning(ctx, "branch", id, mwanachamagit.ErrBranchNotFound, func(ctx context.Context, f *mwanachamagit.RepoFile, id string) error {
		_, err := f.GetBranch(ctx, id)
		return err
	})
}

func (g *repositoryFolderGit) mergeRequest(ctx context.Context, id string) repoFileScope {
	return g.owning(ctx, "merge-request", id, mwanachamagit.ErrMergeRequestNotFound, func(ctx context.Context, f *mwanachamagit.RepoFile, id string) error {
		_, err := f.GetMergeRequest(ctx, id)
		return err
	})
}

func (g *repositoryFolderGit) tag(ctx context.Context, id string) repoFileScope {
	return g.owning(ctx, "tag", id, mwanachamagit.ErrTagNotFound, func(ctx context.Context, f *mwanachamagit.RepoFile, id string) error {
		_, err := f.GetTag(ctx, id)
		return err
	})
}

func (g *repositoryFolderGit) keyword(ctx context.Context, id string) repoFileScope {
	return g.owning(ctx, "keyword", id, mwanachamagit.ErrKeywordNotFound, func(ctx context.Context, f *mwanachamagit.RepoFile, id string) error {
		_, err := f.GetKeyword(ctx, id)
		return err
	})
}

func (g *repositoryFolderGit) importJob(ctx context.Context, id string) repoFileScope {
	return g.owning(ctx, "import", id, mwanachamagit.ErrImportJobNotFound, func(ctx context.Context, f *mwanachamagit.RepoFile, id string) error {
		_, err := f.GetImportStatus(ctx, id)
		return err
	})
}

func (g *repositoryFolderGit) fetchJob(ctx context.Context, id string) repoFileScope {
	return g.owning(ctx, "fetch", id, mwanachamagit.ErrImportJobNotFound, func(ctx context.Context, f *mwanachamagit.RepoFile, id string) error {
		_, err := f.GetFetchBranchStatus(ctx, id)
		return err
	})
}

func (g *repositoryFolderGit) SmartHTTPHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		name, rest, ok := splitRepositoryPath(r.URL.Path)
		if !ok {
			http.Error(w, "invalid repository path", http.StatusBadRequest)
			return
		}
		err := g.named(r.Context(), name)(func(file *mwanachamagit.RepoFile) error {
			inner := r.Clone(r.Context())
			inner.URL.Path = rest
			file.GitHTTPHandler().ServeHTTP(w, inner)
			return nil
		})
		if errors.Is(err, mwanachamagit.ErrRepoNotInitialised) || errors.Is(err, mwanachamagit.ErrRepositoryNotRegistered) {
			http.Error(w, "repository not found", http.StatusNotFound)
			return
		}
		if err != nil {
			http.Error(w, "internal error: "+err.Error(), http.StatusInternalServerError)
		}
	})
}

func splitRepositoryPath(path string) (name, rest string, ok bool) {
	trimmed := strings.TrimPrefix(path, "/")
	index := strings.Index(trimmed, "/")
	if index < 0 {
		return "", "", false
	}
	name = strings.TrimSuffix(trimmed[:index], ".git")
	rest = trimmed[index:]
	return name, rest, name != "" && rest != "/"
}

var _ mwanachamagit.GitManager = (*repositoryFolderGit)(nil)
