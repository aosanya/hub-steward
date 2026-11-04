package mcp

import (
	"context"

	sources "wakalaserver/modules/sources"
)

type resolving struct {
	resolve ManagerResolver
}

func (r resolving) manager(ctx context.Context) (sources.SourceManager, error) {
	if sm, ok := ctx.Value(managerKey{}).(sources.SourceManager); ok {
		return sm, nil
	}
	return nil, ErrInstanceRequired
}

func (r resolving) CreateSource(ctx context.Context, in sources.Source) (sources.Source, error) {
	m, err := r.manager(ctx)
	if err != nil {
		return sources.Source{}, err
	}
	return m.CreateSource(ctx, in)
}

func (r resolving) GetSource(ctx context.Context, sourceID string) (sources.Source, error) {
	m, err := r.manager(ctx)
	if err != nil {
		return sources.Source{}, err
	}
	return m.GetSource(ctx, sourceID)
}

func (r resolving) ListSources(ctx context.Context, filter sources.SourceFilter) ([]sources.Source, error) {
	m, err := r.manager(ctx)
	if err != nil {
		return nil, err
	}
	return m.ListSources(ctx, filter)
}

func (r resolving) UpdateSource(ctx context.Context, in sources.Source) (sources.Source, error) {
	m, err := r.manager(ctx)
	if err != nil {
		return sources.Source{}, err
	}
	return m.UpdateSource(ctx, in)
}

func (r resolving) DeleteSource(ctx context.Context, sourceID string) error {
	m, err := r.manager(ctx)
	if err != nil {
		return err
	}
	return m.DeleteSource(ctx, sourceID)
}

func (r resolving) CreateAnnotation(ctx context.Context, in sources.Annotation) (sources.Annotation, error) {
	m, err := r.manager(ctx)
	if err != nil {
		return sources.Annotation{}, err
	}
	return m.CreateAnnotation(ctx, in)
}

func (r resolving) GetAnnotation(ctx context.Context, annotationID string) (sources.Annotation, error) {
	m, err := r.manager(ctx)
	if err != nil {
		return sources.Annotation{}, err
	}
	return m.GetAnnotation(ctx, annotationID)
}

func (r resolving) ListAnnotations(ctx context.Context, filter sources.AnnotationFilter) ([]sources.Annotation, error) {
	m, err := r.manager(ctx)
	if err != nil {
		return nil, err
	}
	return m.ListAnnotations(ctx, filter)
}

func (r resolving) DeleteAnnotation(ctx context.Context, annotationID string) error {
	m, err := r.manager(ctx)
	if err != nil {
		return err
	}
	return m.DeleteAnnotation(ctx, annotationID)
}

func (r resolving) Verify(ctx context.Context, in sources.Verification) (sources.Verification, error) {
	m, err := r.manager(ctx)
	if err != nil {
		return sources.Verification{}, err
	}
	return m.Verify(ctx, in)
}

func (r resolving) ListVerifications(ctx context.Context, filter sources.VerificationFilter) ([]sources.Verification, error) {
	m, err := r.manager(ctx)
	if err != nil {
		return nil, err
	}
	return m.ListVerifications(ctx, filter)
}

func (r resolving) AddChunk(ctx context.Context, in sources.Chunk) (sources.Chunk, error) {
	m, err := r.manager(ctx)
	if err != nil {
		return sources.Chunk{}, err
	}
	return m.AddChunk(ctx, in)
}

func (r resolving) AddDocument(ctx context.Context, in sources.Document) ([]sources.Chunk, error) {
	m, err := r.manager(ctx)
	if err != nil {
		return nil, err
	}
	return m.AddDocument(ctx, in)
}

func (r resolving) ListChunks(ctx context.Context, sourceID string) ([]sources.Chunk, error) {
	m, err := r.manager(ctx)
	if err != nil {
		return nil, err
	}
	return m.ListChunks(ctx, sourceID)
}

func (r resolving) SearchChunks(ctx context.Context, q sources.ChunkQuery) ([]sources.ChunkMatch, error) {
	m, err := r.manager(ctx)
	if err != nil {
		return nil, err
	}
	return m.SearchChunks(ctx, q)
}

func (r resolving) StableIdentity(ctx context.Context, object, id string) (string, error) {
	m, err := r.manager(ctx)
	if err != nil {
		return "", err
	}
	return m.StableIdentity(ctx, object, id)
}

func (r resolving) Resolve(ctx context.Context, raw string) (string, string, error) {
	m, err := r.manager(ctx)
	if err != nil {
		return "", "", err
	}
	return m.Resolve(ctx, raw)
}
