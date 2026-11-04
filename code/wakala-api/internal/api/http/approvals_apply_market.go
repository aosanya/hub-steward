package http

import (
	"context"
	"errors"
	"strings"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
	mwanachamamarket "wakalaserver/modules/market"
)

func announcedMarketManager(ctx context.Context, reg agencies.Registry, instanceID, name string) (mwanachamamarket.MarketManager, error) {
	m, err := marketManagerNamed(ctx, reg, instanceID, name)
	if err != nil {
		return nil, err
	}
	if announce, ok := ctx.Value(marketAnnouncerKey{}).(marketAnnouncer); ok && announce != nil {
		return announce(m, instanceID), nil
	}
	return m, nil
}

func applyRegroupOffer(ctx context.Context, reg agencies.Registry, instanceID, payload string) error {
	var p struct {
		OfferID string `json:"offer_id"`
		Product string `json:"product"`
	}
	if err := decodePayload(payload, &p); err != nil {
		return err
	}
	if strings.TrimSpace(p.OfferID) == "" {
		return errors.New("name the offer by offer_id")
	}
	m, err := announcedMarketManager(ctx, reg, instanceID, marketNameIn(payload))
	if err != nil {
		return err
	}
	_, err = m.RegroupOffer(ctx, accounts.IDFromContext(ctx), p.OfferID, p.Product)
	return err
}

func applyAsk(ctx context.Context, reg agencies.Registry, instanceID, payload string) error {
	var ask mwanachamamarket.Ask
	if err := decodePayload(payload, &ask); err != nil {
		return err
	}
	if strings.TrimSpace(ask.PosterID) == "" {
		return errors.New("name the poster by poster_id")
	}
	m, err := announcedMarketManager(ctx, reg, instanceID, marketNameIn(payload))
	if err != nil {
		return err
	}
	asked, err := m.CreateAsk(ctx, accounts.IDFromContext(ctx), ask)
	if err != nil {
		return err
	}
	noteStep(ctx, "Asked the poster %q: %s", asked.PosterID, asked.Question)
	return nil
}

func posterIn(ctx context.Context, reg agencies.Registry, instanceID, payload string) (mwanachamamarket.MarketManager, string, error) {
	var p struct {
		PosterID string `json:"posterID"`
	}
	if err := decodePayload(payload, &p); err != nil {
		return nil, "", err
	}
	if strings.TrimSpace(p.PosterID) == "" {
		return nil, "", errors.New("name the poster by posterID")
	}
	m, err := announcedMarketManager(ctx, reg, instanceID, marketNameIn(payload))
	return m, p.PosterID, err
}

func applyApprovePoster(ctx context.Context, reg agencies.Registry, instanceID, payload string) error {
	m, posterID, err := posterIn(ctx, reg, instanceID, payload)
	if err != nil {
		return err
	}
	poster, err := m.ApprovePoster(ctx, accounts.IDFromContext(ctx), posterID)
	if err != nil {
		return err
	}
	noteStep(ctx, "Approved the poster %q", poster.Name)
	return nil
}

func applyDeclinePoster(ctx context.Context, reg agencies.Registry, instanceID, payload string) error {
	m, posterID, err := posterIn(ctx, reg, instanceID, payload)
	if err != nil {
		return err
	}
	poster, err := m.DeclinePoster(ctx, accounts.IDFromContext(ctx), posterID)
	if err != nil {
		return err
	}
	noteStep(ctx, "Declined the poster %q", poster.Name)
	return nil
}
