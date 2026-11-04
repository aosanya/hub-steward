package sources

import (
	"context"
	"fmt"
	"math"
	"sort"

	"wakalaserver/modules/shared/specstore"

	"wakalaserver/modules/sources/models"
)

const (
	DefaultMatches = 5
	MaxMatches     = 50
)

func (m *sourceManager) SearchChunks(ctx context.Context, query ChunkQuery) ([]ChunkMatch, error) {
	if len(query.Embedding) == 0 {
		return nil, fmt.Errorf("%w: embedding is required", ErrInvalidQuery)
	}
	if query.EmbeddingModel == "" {
		return nil, fmt.Errorf("%w: embedding_model is required, because vectors from different models do not compare", ErrInvalidQuery)
	}

	q := m.st.Query(ctx, roleChunk).Where("embedding_model = ?", query.EmbeddingModel)
	if query.SourceID != "" {
		q = q.Where("source_id = ?", query.SourceID)
	}
	held, err := specstore.List[Chunk](m.st, q, roleChunk)
	if err != nil {
		return nil, fmt.Errorf("SearchChunks: %w", err)
	}

	ranked := rank(held, query.Embedding, matchesWanted(query.Limit))
	return m.withSources(ctx, ranked)
}

func matchesWanted(limit int) int {
	switch {
	case limit <= 0:
		return DefaultMatches
	case limit > MaxMatches:
		return MaxMatches
	}
	return limit
}

func rank(held []Chunk, query []float64, wanted int) []ChunkMatch {
	out := make([]ChunkMatch, 0, len(held))
	for _, c := range held {
		score, ok := cosine(c.Embedding, query)
		if !ok {
			continue
		}
		out = append(out, ChunkMatch{Chunk: c, Score: score})
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].Score > out[j].Score })
	if len(out) > wanted {
		out = out[:wanted]
	}
	return out
}

func cosine(a, b []float64) (float64, bool) {
	if len(a) == 0 || len(a) != len(b) {
		return 0, false
	}
	var dot, na, nb float64
	for i := range a {
		dot += a[i] * b[i]
		na += a[i] * a[i]
		nb += b[i] * b[i]
	}
	if na == 0 || nb == 0 {
		return 0, false
	}
	return dot / (math.Sqrt(na) * math.Sqrt(nb)), true
}

func (m *sourceManager) withSources(ctx context.Context, matches []ChunkMatch) ([]ChunkMatch, error) {
	seen := map[string]Source{}
	standings := map[string]*Verification{}
	for i := range matches {
		id := matches[i].Chunk.SourceID
		src, ok := seen[id]
		if !ok {
			var err error
			if src, err = m.GetSource(ctx, id); err != nil {
				return nil, fmt.Errorf("SearchChunks: %w", err)
			}
			if standings[id], err = m.standing(ctx, models.SubjectSource, id); err != nil {
				return nil, fmt.Errorf("SearchChunks: %w", err)
			}
			seen[id] = src
		}
		matches[i].Source = src
		matches[i].Standing = standings[id]
	}
	return matches, nil
}
