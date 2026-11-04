package mwanachamacatalog

import (
	"context"
	"fmt"
)

type Audience string

const (
	AudiencePublic  Audience = "public"
	AudienceMembers Audience = "members"
	AudienceStaff   Audience = "staff"
)

type Standing int

const (
	StandingNone Standing = iota
	StandingMember
	StandingStaff
)

type StandingOf func(ctx context.Context) Standing

func (a Audience) needs() (Standing, error) {
	switch a {
	case AudiencePublic:
		return StandingNone, nil
	case AudienceMembers:
		return StandingMember, nil
	case AudienceStaff:
		return StandingStaff, nil
	default:
		return 0, fmt.Errorf("catalog: unknown audience %q", string(a))
	}
}

func WithAudience(cm CatalogManager, a Audience, of StandingOf) (CatalogManager, error) {
	needs, err := a.needs()
	if err != nil {
		return nil, err
	}
	if of == nil {
		of = func(context.Context) Standing { return StandingNone }
	}
	return audienceFenced{CatalogManager: cm, needs: needs, of: of}, nil
}

type audienceFenced struct {
	CatalogManager
	needs Standing
	of    StandingOf
}

func (f audienceFenced) admits(ctx context.Context) bool {
	return f.of(ctx) >= f.needs
}

func (f audienceFenced) staff(ctx context.Context) bool {
	return f.of(ctx) >= StandingStaff
}

func (f audienceFenced) OpenEntry(ctx context.Context, slug, key string) (Entry, error) {
	if !f.admits(ctx) {
		return Entry{}, ErrEntryNotFound
	}
	return f.CatalogManager.OpenEntry(ctx, slug, key)
}

func (f audienceFenced) GetEntry(ctx context.Context, slug string) (Entry, error) {
	if !f.admits(ctx) {
		return Entry{}, ErrEntryNotFound
	}
	if f.staff(ctx) {
		return f.CatalogManager.GetEntry(ctx, slug)
	}
	return f.CatalogManager.OpenEntry(ctx, slug, "")
}

func (f audienceFenced) ListPublicEntries(ctx context.Context, filter ListFilter) ([]Entry, error) {
	if !f.admits(ctx) {
		return []Entry{}, nil
	}
	return f.CatalogManager.ListPublicEntries(ctx, filter)
}

func (f audienceFenced) ListEntries(ctx context.Context, filter ListFilter) ([]Entry, error) {
	if !f.admits(ctx) {
		return []Entry{}, nil
	}
	if f.staff(ctx) {
		return f.CatalogManager.ListEntries(ctx, filter)
	}
	if filter.Visibility != "" && filter.Visibility != VisibilityPublic {
		return []Entry{}, nil
	}
	return f.CatalogManager.ListPublicEntries(ctx, filter)
}

func (f audienceFenced) GetPrivate(ctx context.Context, slug string) (EntryPrivate, error) {
	if !f.staff(ctx) {
		return EntryPrivate{}, ErrEntryNotFound
	}
	return f.CatalogManager.GetPrivate(ctx, slug)
}

func (f audienceFenced) PutPrivate(ctx context.Context, p EntryPrivate) (EntryPrivate, error) {
	if !f.staff(ctx) {
		return EntryPrivate{}, ErrEntryNotFound
	}
	return f.CatalogManager.PutPrivate(ctx, p)
}
