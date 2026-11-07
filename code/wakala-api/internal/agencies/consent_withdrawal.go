package agencies

import (
	"context"
	"errors"

	mwanachamacustody "wakalaserver/modules/custody"
)

type ModuleMountedOf func(ctx context.Context, instanceID, module string) (bool, error)

func WithModuleMounted(of ModuleMountedOf) Option {
	return func(r *registry) { r.moduleMounted = of }
}

func (r *registry) subscribeWithdrawals(n mwanachamacustody.WithdrawalNotifier, id string) {
	if r.moduleMounted == nil {
		return
	}
	n.Subscribe(func(ctx context.Context, w mwanachamacustody.Withdrawal) error {
		return errors.Join(
			r.releaseIn(ctx, id, "engage", func() error {
				pm, err := r.PostManager(ctx, id)
				if err != nil {
					return err
				}
				return pm.ReleaseParticipant(ctx, w.ActorID)
			}),
			r.releaseIn(ctx, id, "forms", func() error {
				fm, err := r.FormManager(ctx, id)
				if err != nil {
					return err
				}
				return fm.ReleaseMember(ctx, w.ActorID)
			}),
			r.releaseIn(ctx, id, "comm", func() error {
				rm, err := r.CommManager(ctx, id)
				if err != nil {
					return err
				}
				return rm.ReleaseActor(ctx, w.ActorID)
			}),
		)
	})
}

func (r *registry) releaseIn(ctx context.Context, id, module string, release func() error) error {
	mounted, err := r.moduleMounted(ctx, id, module)
	if err != nil || !mounted {
		return err
	}
	return release()
}
