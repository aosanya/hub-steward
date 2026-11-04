package reviewruns

import "context"

type DraftReader interface {
	Read(ctx context.Context, draftID string) (string, error)
}

type DraftReaderFunc func(ctx context.Context, draftID string) (string, error)

func (f DraftReaderFunc) Read(ctx context.Context, draftID string) (string, error) {
	return f(ctx, draftID)
}
