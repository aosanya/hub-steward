package agencies

import (
	"context"

	"wakalaserver/modules/shared/consent"
)

type ConsentRequiredOf func(ctx context.Context, instanceID string) (bool, error)

func WithConsentRequired(of ConsentRequiredOf) Option {
	return func(r *registry) { r.consentRequired = of }
}

type instanceConsentGate struct {
	r  *registry
	id string
}

func (r *registry) consentGateIn(id string) consent.Gate {
	if r.consentRequired == nil {
		return nil
	}
	return instanceConsentGate{r: r, id: id}
}

func (g instanceConsentGate) Check(ctx context.Context, actorID string) error {
	required, err := g.r.consentRequired(ctx, g.id)
	if err != nil {
		return err
	}
	if !required {
		return nil
	}
	cm, err := g.r.CustodyManager(ctx, g.id)
	if err != nil {
		return err
	}
	return cm.ConsentGate().Check(ctx, actorID)
}
