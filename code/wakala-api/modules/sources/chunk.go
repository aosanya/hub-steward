package sources

import (
	"context"
	"fmt"

	"github.com/aosanya/mwanachama-backend-shared/specstore"
)

func (m *sourceManager) AddChunk(ctx context.Context, in Chunk) (Chunk, error) {
	if err := m.checks(roleChunk, in, ErrInvalidChunk); err != nil {
		return Chunk{}, err
	}
	if in.Position < 0 {
		return Chunk{}, fmt.Errorf("%w: position is %d, and a passage cannot fall before the start", ErrInvalidChunk, in.Position)
	}
	if in.StartOffset < 0 || in.EndOffset < in.StartOffset {
		return Chunk{}, fmt.Errorf("%w: offsets %d to %d do not mark a passage", ErrInvalidChunk, in.StartOffset, in.EndOffset)
	}
	if len(in.Embedding) > 0 && in.EmbeddingModel == "" {
		return Chunk{}, fmt.Errorf("%w: an embedding needs the model that produced it", ErrInvalidChunk)
	}
	if _, err := m.GetSource(ctx, in.SourceID); err != nil {
		return Chunk{}, err
	}
	in.ID = newID()
	in.CreatedAt = m.now()

	if err := m.st.Insert(ctx, roleChunk, in); err != nil {
		return Chunk{}, fmt.Errorf("AddChunk: %w", err)
	}
	return in, nil
}

func (m *sourceManager) ListChunks(ctx context.Context, sourceID string) ([]Chunk, error) {
	if _, err := m.GetSource(ctx, sourceID); err != nil {
		return nil, err
	}
	q := m.st.Query(ctx, roleChunk).Where("source_id = ?", sourceID).Order("position asc")
	out, err := specstore.List[Chunk](m.st, q, roleChunk)
	if err != nil {
		return nil, fmt.Errorf("ListChunks: %w", err)
	}
	return out, nil
}
