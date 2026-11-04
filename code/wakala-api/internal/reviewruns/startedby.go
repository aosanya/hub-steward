package reviewruns

import "context"

type startedByKey struct{}

func WithStartedBy(ctx context.Context, person string) context.Context {
	return context.WithValue(ctx, startedByKey{}, person)
}

func StartedByFrom(ctx context.Context) string {
	person, _ := ctx.Value(startedByKey{}).(string)
	return person
}
