package agencies

import (
	"context"

	ai "wakalaserver/modules/ai"
)

type TokensPerTest func(ctx context.Context, instanceID string) (int, error)

func WithTokensPerTest(of TokensPerTest) Option {
	return func(r *registry) { r.tokensPerTest = of }
}

func (r *registry) tokenLimit(id string) func(ctx context.Context) int {
	return func(ctx context.Context) int {
		n, err := r.tokensPerTest(ctx, id)
		if err != nil {
			return 0
		}
		return n
	}
}

func TokensPerTestFrom(resolve func(ctx context.Context, instanceID string) (ai.Manager, error)) TokensPerTest {
	return func(ctx context.Context, instanceID string) (int, error) {
		if resolve == nil {
			return 0, nil
		}
		manager, err := resolve(ctx, instanceID)
		if err != nil {
			return 0, err
		}
		account, err := manager.GetDefaultAccount(ctx, instanceID)
		if err != nil {
			return 0, err
		}
		if account.TokensPerTest == nil || *account.TokensPerTest <= 0 {
			return 0, nil
		}
		return *account.TokensPerTest, nil
	}
}
