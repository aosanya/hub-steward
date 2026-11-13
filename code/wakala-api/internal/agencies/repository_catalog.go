package agencies

import (
	"context"
	"errors"
	"fmt"

	mwanachamacatalog "wakalaserver/modules/catalog"
	mwanachamagit "wakalaserver/modules/git"
)

const RepositoriesMount = "repositories"

const repositoryListPage = 100

type catalogRepositories struct {
	manager mwanachamacatalog.CatalogManager
}

func NewRepositoryCatalog(manager mwanachamacatalog.CatalogManager) mwanachamagit.RepositoryCatalog {
	return &catalogRepositories{manager: manager}
}

func (c *catalogRepositories) Register(ctx context.Context, entry mwanachamagit.RepositoryCatalogEntry) error {
	_, err := c.manager.CreateEntry(ctx, mwanachamacatalog.Entry{
		Slug: entry.ID,
		Name: entry.Name,
		Doc:  entry.Document(),
	})
	if errors.Is(err, mwanachamacatalog.ErrEntryExists) {
		return mwanachamagit.ErrRepositoryAlreadyCatalogued
	}
	if err != nil {
		return fmt.Errorf("RepositoryCatalog.Register %s: %w", entry.ID, err)
	}
	return nil
}

func (c *catalogRepositories) Update(ctx context.Context, id string, sizeBytes int64, lastCommitAt string) error {
	stored, err := c.manager.GetEntry(ctx, id)
	if errors.Is(err, mwanachamacatalog.ErrEntryNotFound) {
		return mwanachamagit.ErrRepositoryNotCatalogued
	}
	if err != nil {
		return fmt.Errorf("RepositoryCatalog.Update %s: %w", id, err)
	}
	entry, err := mwanachamagit.ParseRepositoryCatalogDocument(stored.Slug, stored.Name, stored.Doc)
	if err != nil {
		return fmt.Errorf("RepositoryCatalog.Update %s: %w", id, err)
	}
	entry.SizeBytes = sizeBytes
	entry.LastCommitAt = lastCommitAt
	stored.Doc = entry.Document()
	if _, err := c.manager.UpdateEntry(ctx, stored); err != nil {
		if errors.Is(err, mwanachamacatalog.ErrEntryNotFound) {
			return mwanachamagit.ErrRepositoryNotCatalogued
		}
		return fmt.Errorf("RepositoryCatalog.Update %s: %w", id, err)
	}
	return nil
}

func (c *catalogRepositories) List(ctx context.Context) ([]mwanachamagit.RepositoryCatalogEntry, error) {
	out := []mwanachamagit.RepositoryCatalogEntry{}
	for offset := 0; ; offset += repositoryListPage {
		cards, err := c.manager.ListEntries(ctx, mwanachamacatalog.ListFilter{Limit: repositoryListPage, Offset: offset})
		if err != nil {
			return nil, fmt.Errorf("RepositoryCatalog.List: %w", err)
		}
		for _, card := range cards {
			entry, err := c.Lookup(ctx, card.Slug)
			if errors.Is(err, mwanachamagit.ErrRepositoryNotCatalogued) {
				continue
			}
			if err != nil {
				return nil, err
			}
			out = append(out, entry)
		}
		if len(cards) < repositoryListPage {
			return out, nil
		}
	}
}

func (c *catalogRepositories) Lookup(ctx context.Context, id string) (mwanachamagit.RepositoryCatalogEntry, error) {
	stored, err := c.manager.GetEntry(ctx, id)
	if errors.Is(err, mwanachamacatalog.ErrEntryNotFound) {
		return mwanachamagit.RepositoryCatalogEntry{}, mwanachamagit.ErrRepositoryNotCatalogued
	}
	if err != nil {
		return mwanachamagit.RepositoryCatalogEntry{}, fmt.Errorf("RepositoryCatalog.Lookup %s: %w", id, err)
	}
	entry, err := mwanachamagit.ParseRepositoryCatalogDocument(stored.Slug, stored.Name, stored.Doc)
	if err != nil {
		return mwanachamagit.RepositoryCatalogEntry{}, fmt.Errorf("RepositoryCatalog.Lookup %s: %w", id, err)
	}
	return entry, nil
}

func (c *catalogRepositories) Remove(ctx context.Context, id string) error {
	err := c.manager.DeleteEntry(ctx, id, "")
	if errors.Is(err, mwanachamacatalog.ErrEntryNotFound) {
		return mwanachamagit.ErrRepositoryNotCatalogued
	}
	if err != nil {
		return fmt.Errorf("RepositoryCatalog.Remove %s: %w", id, err)
	}
	return nil
}
