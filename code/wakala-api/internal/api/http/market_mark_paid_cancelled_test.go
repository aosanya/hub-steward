package http

import (
	"context"
	"errors"
	"testing"

	"wakalaserver/modules/market"
)

func TestMarketMarkPaidRefusesCancelledOrder(t *testing.T) {
	w := newStepRunWalk(t, nil)
	ctx := context.Background()
	m, err := w.deps.Registry.MarketManager(ctx, w.instance, "market")
	if err != nil {
		t.Fatalf("MarketManager: %v", err)
	}
	poster, err := m.ApplyPoster(ctx, "poster-1", market.Poster{Name: "Stall"})
	if err != nil {
		t.Fatalf("ApplyPoster: %v", err)
	}
	if _, err := m.ApprovePoster(ctx, "test-owner", poster.ID); err != nil {
		t.Fatalf("ApprovePoster: %v", err)
	}
	offer, err := m.CreateOffer(ctx, "poster-1", market.Offer{PosterID: poster.ID, ProductWords: "eggs", Price: 3})
	if err != nil {
		t.Fatalf("CreateOffer: %v", err)
	}
	order, err := m.BuyNow(ctx, "picker-1", offer.ID, 2, "")
	if err != nil {
		t.Fatalf("BuyNow: %v", err)
	}
	if _, err := m.CancelOrder(ctx, "picker-1", order.ID); err != nil {
		t.Fatalf("CancelOrder: %v", err)
	}

	_, err = m.MarkPaid(ctx, "poster-1", order.ID)
	if !errors.Is(err, market.ErrConflict) {
		t.Fatalf("MarkPaid on a cancelled order returned %v, want ErrConflict", err)
	}
	got, err := m.GetOrder(ctx, "picker-1", order.ID)
	if err != nil {
		t.Fatalf("GetOrder: %v", err)
	}
	if got.Paid {
		t.Fatalf("a cancelled order is stored paid")
	}
}
