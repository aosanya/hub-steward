package agencies

import (
	"context"
	"errors"
	"testing"

	ai "wakalaserver/modules/ai"
	aimodels "wakalaserver/modules/ai/models"
)

type fakeAI struct {
	ai.Manager
	accounts   []aimodels.Account
	defaultAcc aimodels.Account
	err        error
}

func (f fakeAI) ListAccounts(context.Context, string) ([]aimodels.Account, error) {
	return f.accounts, f.err
}

func (f fakeAI) GetDefaultAccount(context.Context, string) (aimodels.Account, error) {
	return f.defaultAcc, f.err
}

func intp(n int) *int { return &n }

func resolving(m ai.Manager, err error) func(context.Context, string) (ai.Manager, error) {
	return func(context.Context, string) (ai.Manager, error) { return m, err }
}

func TestScenariosAtOnceTakesTheLowestPositiveLimit(t *testing.T) {
	manager := fakeAI{accounts: []aimodels.Account{
		{ScenariosAtOnce: intp(6)},
		{ScenariosAtOnce: nil},
		{ScenariosAtOnce: intp(0)},
		{ScenariosAtOnce: intp(-3)},
		{ScenariosAtOnce: intp(2)},
		{ScenariosAtOnce: intp(4)},
	}}
	got, err := ScenariosAtOnceFrom(resolving(manager, nil))(context.Background(), "a")
	if err != nil || got != 2 {
		t.Fatalf("got %d, %v; want 2", got, err)
	}
}

func TestScenariosAtOnceIsZeroWhenNoAccountSetsOne(t *testing.T) {
	manager := fakeAI{accounts: []aimodels.Account{{}, {ScenariosAtOnce: intp(0)}}}
	got, err := ScenariosAtOnceFrom(resolving(manager, nil))(context.Background(), "a")
	if err != nil || got != 0 {
		t.Fatalf("got %d, %v; want 0", got, err)
	}
}

func TestScenariosAtOnceWithoutAResolverIsZero(t *testing.T) {
	got, err := ScenariosAtOnceFrom(nil)(context.Background(), "a")
	if err != nil || got != 0 {
		t.Fatalf("got %d, %v", got, err)
	}
}

func TestScenariosAtOnceReturnsTheResolverAndListingErrors(t *testing.T) {
	boom := errors.New("boom")
	if _, err := ScenariosAtOnceFrom(resolving(nil, boom))(context.Background(), "a"); !errors.Is(err, boom) {
		t.Fatalf("resolver error lost: %v", err)
	}
	if _, err := ScenariosAtOnceFrom(resolving(fakeAI{err: boom}, nil))(context.Background(), "a"); !errors.Is(err, boom) {
		t.Fatalf("listing error lost: %v", err)
	}
}

func TestTokensPerTestReadsTheDefaultAccount(t *testing.T) {
	manager := fakeAI{defaultAcc: aimodels.Account{TokensPerTest: intp(5000)}}
	got, err := TokensPerTestFrom(resolving(manager, nil))(context.Background(), "a")
	if err != nil || got != 5000 {
		t.Fatalf("got %d, %v", got, err)
	}
}

func TestTokensPerTestIsZeroWhenUnsetOrNotPositive(t *testing.T) {
	for name, acc := range map[string]aimodels.Account{
		"unset":    {},
		"zero":     {TokensPerTest: intp(0)},
		"negative": {TokensPerTest: intp(-1)},
	} {
		got, err := TokensPerTestFrom(resolving(fakeAI{defaultAcc: acc}, nil))(context.Background(), "a")
		if err != nil || got != 0 {
			t.Errorf("%s: got %d, %v", name, got, err)
		}
	}
}

func TestTokensPerTestWithoutAResolverIsZeroAndErrorsPass(t *testing.T) {
	if got, err := TokensPerTestFrom(nil)(context.Background(), "a"); err != nil || got != 0 {
		t.Fatalf("got %d, %v", got, err)
	}
	boom := errors.New("boom")
	if _, err := TokensPerTestFrom(resolving(nil, boom))(context.Background(), "a"); !errors.Is(err, boom) {
		t.Fatalf("resolver error lost: %v", err)
	}
	if _, err := TokensPerTestFrom(resolving(fakeAI{err: boom}, nil))(context.Background(), "a"); !errors.Is(err, boom) {
		t.Fatalf("account error lost: %v", err)
	}
}

func TestTokenLimitOfARegistryReadsZeroWhenTheLookupFails(t *testing.T) {
	r := &registry{tokensPerTest: func(_ context.Context, id string) (int, error) {
		if id == "bad" {
			return 0, errors.New("down")
		}
		return 700, nil
	}}
	if got := r.tokenLimit("good")(context.Background()); got != 700 {
		t.Fatalf("got %d", got)
	}
	if got := r.tokenLimit("bad")(context.Background()); got != 0 {
		t.Fatalf("a failed lookup must read as no limit, got %d", got)
	}
}
