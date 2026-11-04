package agencies

import (
	"context"
	"errors"
	"fmt"

	mwanachamacatalog "wakalaserver/modules/catalog"
	"wakalaserver/modules/shared/spec"
)

var ErrCatalogMountRequired = errors.New("agencies: catalog mount required")

func (r *registry) CatalogManager(ctx context.Context, id, mount string) (mwanachamacatalog.CatalogManager, error) {
	if mount == "" {
		return nil, ErrCatalogMountRequired
	}
	return r.catalogs.Get(ctx, id+"/"+mount, func(ctx context.Context) (mwanachamacatalog.CatalogManager, []string, error) {
		built, err := r.buildCatalogManager(ctx, id, mount)
		return built, nil, err
	})
}

func (r *registry) buildCatalogManager(ctx context.Context, id, mount string) (mwanachamacatalog.CatalogManager, error) {
	inst, err := r.GetInstance(ctx, id)
	if err != nil {
		return nil, err
	}
	s, err := mwanachamacatalog.SpecFor(inst.TableSlug, mount)
	if err != nil {
		return nil, fmt.Errorf("CatalogManager: spec for instance %s mount %s: %w", id, mount, err)
	}
	if err := spec.Migrate(r.db, s); err != nil {
		return nil, fmt.Errorf("CatalogManager: migrate instance %s mount %s: %w", id, mount, err)
	}
	built, err := mwanachamacatalog.NewCatalogManager(r.db, s)
	if err != nil {
		return nil, err
	}
	return built, nil
}
