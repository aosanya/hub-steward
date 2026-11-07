package agencies

import (
	"context"
	"errors"
	"testing"

	mwanachamacustody "wakalaserver/modules/custody"
)

type notifierCount struct {
	subs []mwanachamacustody.WithdrawalSubscriber
}

func (n *notifierCount) Subscribe(fn mwanachamacustody.WithdrawalSubscriber) {
	n.subs = append(n.subs, fn)
}

func TestWithdrawalsAreNotSubscribedWithoutAMountedCheck(t *testing.T) {
	n := &notifierCount{}
	(&registry{}).subscribeWithdrawals(n, "i-1")
	if len(n.subs) != 0 {
		t.Fatalf("subscribers = %d, want none", len(n.subs))
	}
}

func TestWithdrawalSkipsModulesThatAreNotMounted(t *testing.T) {
	asked := map[string]bool{}
	r := &registry{moduleMounted: func(_ context.Context, _, module string) (bool, error) {
		asked[module] = true
		return false, nil
	}}
	n := &notifierCount{}
	r.subscribeWithdrawals(n, "i-1")
	if err := n.subs[0](context.Background(), mwanachamacustody.Withdrawal{ActorID: "mem-1"}); err != nil {
		t.Fatalf("withdrawal = %v, want nil", err)
	}
	for _, module := range []string{"engage", "forms", "comm"} {
		if !asked[module] {
			t.Fatalf("module %q was not consulted", module)
		}
	}
}

func TestWithdrawalReportsAMountThatCannotBeRead(t *testing.T) {
	boom := errors.New("read failed")
	r := &registry{moduleMounted: func(context.Context, string, string) (bool, error) { return false, boom }}
	n := &notifierCount{}
	r.subscribeWithdrawals(n, "i-1")
	if err := n.subs[0](context.Background(), mwanachamacustody.Withdrawal{ActorID: "mem-1"}); !errors.Is(err, boom) {
		t.Fatalf("withdrawal = %v, want the read error", err)
	}
}
