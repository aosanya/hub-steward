package agencies

import (
	"context"
	"errors"
	"fmt"

	mwanachamacomm "wakalaserver/modules/comm"
	mwanachamaengage "wakalaserver/modules/engage"
	"wakalaserver/modules/forms/models"
)

type HiddenRows struct {
	Engage *mwanachamaengage.Hidden       `json:"engage,omitempty"`
	Forms  []models.Answer                `json:"forms,omitempty"`
	Comm   *mwanachamacomm.HiddenMessages `json:"comm,omitempty"`
}

type WithdrawalReader interface {
	HiddenRowsOf(ctx context.Context, id, actorID string) (HiddenRows, error)
	RestoreWithdrawn(ctx context.Context, id, actorID string) error
}

var _ WithdrawalReader = (*registry)(nil)

func (r *registry) HiddenRowsOf(ctx context.Context, id, actorID string) (HiddenRows, error) {
	var out HiddenRows
	err := errors.Join(
		r.whenMounted(ctx, id, "engage", func() error {
			pm, err := r.PostManager(ctx, id)
			if err != nil {
				return err
			}
			hidden, err := pm.ListHidden(ctx, actorID)
			out.Engage = &hidden
			return err
		}),
		r.whenMounted(ctx, id, "forms", func() error {
			fm, err := r.FormManager(ctx, id)
			if err != nil {
				return err
			}
			out.Forms, err = fm.ListHiddenAnswers(ctx, actorID)
			return err
		}),
		r.whenMounted(ctx, id, "comm", func() error {
			rm, err := r.CommManager(ctx, id)
			if err != nil {
				return err
			}
			hidden, err := rm.ListHiddenMessages(ctx, actorID)
			out.Comm = &hidden
			return err
		}),
	)
	if err != nil {
		return HiddenRows{}, fmt.Errorf("HiddenRowsOf: %w", err)
	}
	return out, nil
}

func (r *registry) RestoreWithdrawn(ctx context.Context, id, actorID string) error {
	return errors.Join(
		r.whenMounted(ctx, id, "engage", func() error {
			pm, err := r.PostManager(ctx, id)
			if err != nil {
				return err
			}
			return pm.RestoreParticipant(ctx, actorID)
		}),
		r.whenMounted(ctx, id, "forms", func() error {
			fm, err := r.FormManager(ctx, id)
			if err != nil {
				return err
			}
			return fm.RestoreMemberAnswers(ctx, actorID)
		}),
		r.whenMounted(ctx, id, "comm", func() error {
			rm, err := r.CommManager(ctx, id)
			if err != nil {
				return err
			}
			return rm.RestoreActorMessages(ctx, actorID)
		}),
	)
}
