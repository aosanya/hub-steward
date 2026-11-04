package agencies

import (
	"context"
	"fmt"

	mwanachamagit "wakalaserver/modules/git"

	"wakalaserver/internal/specs"
)

const gitDeclaration = "wakala.git"

func (r *registry) GitManager(ctx context.Context, id string) (mwanachamagit.GitManager, error) {
	return pooled(ctx, r.gits, id, r.buildGitManager)
}

func (r *registry) buildGitManager(ctx context.Context, id string) (mwanachamagit.GitManager, error) {
	inst, err := r.GetInstance(ctx, id)
	if err != nil {
		return nil, err
	}
	raw, err := specs.For(gitDeclaration, inst.TableSlug)
	if err != nil {
		return nil, fmt.Errorf("GitManager: spec for instance %s: %w", id, err)
	}
	s, err := mwanachamagit.ParseSpec(raw)
	if err != nil {
		return nil, fmt.Errorf("GitManager: spec for instance %s: %w", id, err)
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
