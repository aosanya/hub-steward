package sources

import (
	"context"
	"fmt"
	"time"

	"gorm.io/gorm"

	"wakalaserver/modules/shared/identity"
	"wakalaserver/modules/shared/spec"
	"wakalaserver/modules/shared/specstore"

	"wakalaserver/modules/sources/models"
)

type (
	Source             = models.Source
	SourceFilter       = models.SourceFilter
	Annotation         = models.Annotation
	AnnotationFilter   = models.AnnotationFilter
	Verification       = models.Verification
	VerificationFilter = models.VerificationFilter
	Chunk              = models.Chunk
	Document           = models.Document
	ChunkQuery         = models.ChunkQuery
	ChunkMatch         = models.ChunkMatch
	Profile            = models.Profile
)

type ProfileLookup func(ctx context.Context, actorID string) (Profile, error)

type SourceManager interface {
	identity.Owner

	CreateSource(ctx context.Context, in Source) (Source, error)
	GetSource(ctx context.Context, sourceID string) (Source, error)
	ListSources(ctx context.Context, filter SourceFilter) ([]Source, error)
	UpdateSource(ctx context.Context, in Source) (Source, error)
	DeleteSource(ctx context.Context, sourceID string) error

	CreateAnnotation(ctx context.Context, in Annotation) (Annotation, error)
	GetAnnotation(ctx context.Context, annotationID string) (Annotation, error)
	ListAnnotations(ctx context.Context, filter AnnotationFilter) ([]Annotation, error)
	DeleteAnnotation(ctx context.Context, annotationID string) error

	Verify(ctx context.Context, in Verification) (Verification, error)
	ListVerifications(ctx context.Context, filter VerificationFilter) ([]Verification, error)

	AddChunk(ctx context.Context, in Chunk) (Chunk, error)
	AddDocument(ctx context.Context, in Document) ([]Chunk, error)
	ListChunks(ctx context.Context, sourceID string) ([]Chunk, error)
	SearchChunks(ctx context.Context, q ChunkQuery) ([]ChunkMatch, error)
}

type Option func(*sourceManager)

func WithProfiles(lookup ProfileLookup) Option {
	return func(m *sourceManager) { m.profiles = lookup }
}

type sourceManager struct {
	st       *store
	now      func() string
	profiles ProfileLookup
}

func NewSourceManager(db *gorm.DB, s *spec.Spec, opts ...Option) (SourceManager, error) {
	if db == nil {
		return nil, fmt.Errorf("NewSourceManager: db must not be nil")
	}
	st, err := newStore(db, s, map[string]any{
		roleSource:       models.Source{},
		roleAnnotation:   models.Annotation{},
		roleVerification: models.Verification{},
		roleChunk:        models.Chunk{},
	})
	if err != nil {
		return nil, fmt.Errorf("NewSourceManager: %w", err)
	}
	m := &sourceManager{st: st, now: nowStamp}
	for _, opt := range opts {
		opt(m)
	}
	return m, nil
}

func nowStamp() string { return time.Now().UTC().Format(specstore.TimeLayout) }
