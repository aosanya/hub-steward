package agencies

import (
	"context"
	"errors"

	mwanachamacomm "wakalaserver/modules/comm"
	mwanachamacustody "wakalaserver/modules/custody"
	mwanachamaforms "wakalaserver/modules/forms"
)

type WithdrawalPolicy string

const WithdrawalKeepsHidden WithdrawalPolicy = "keep_hidden"

const WithdrawalReleasesOnly WithdrawalPolicy = "release_only"

func WithWithdrawalPolicy(p WithdrawalPolicy) Option {
	return func(r *registry) { r.withdrawalPolicy = p }
}

func (r *registry) hidesOnWithdrawal() bool { return r.withdrawalPolicy == WithdrawalKeepsHidden }

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
				return errors.Join(fm.ReleaseMember(ctx, w.ActorID), r.hideAnswers(ctx, fm, w.ActorID))
			}),
			r.releaseIn(ctx, id, "comm", func() error {
				rm, err := r.CommManager(ctx, id)
				if err != nil {
					return err
				}
				return errors.Join(rm.ReleaseActor(ctx, w.ActorID), r.hideMessages(ctx, rm, w.ActorID))
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

func (r *registry) hideAnswers(ctx context.Context, fm mwanachamaforms.FormManager, actorID string) error {
	if !r.hidesOnWithdrawal() {
		return nil
	}
	return fm.HideMemberAnswers(ctx, actorID)
}

func (r *registry) hideMessages(ctx context.Context, rm *mwanachamacomm.CommManager, actorID string) error {
	if !r.hidesOnWithdrawal() {
		return nil
	}
	return rm.HideActorMessages(ctx, actorID)
}
