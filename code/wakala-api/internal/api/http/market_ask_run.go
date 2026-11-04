package http

import (
	"context"
	"log/slog"

	mwanachamamarket "wakalaserver/modules/market"

	"wakalaserver/internal/agencies"
)

type marketAskRuns struct {
	mwanachamamarket.MarketManager
	registry   agencies.Registry
	instanceID string
}

func (d *Deps) marketAskRuns(m mwanachamamarket.MarketManager, instanceID string) mwanachamamarket.MarketManager {
	return marketAskRuns{MarketManager: m, registry: d.Registry, instanceID: instanceID}
}

func (m marketAskRuns) CreateAsk(ctx context.Context, caller string, a mwanachamamarket.Ask) (mwanachamamarket.Ask, error) {
	a, err := m.MarketManager.CreateAsk(ctx, caller, a)
	if err != nil {
		return a, err
	}
	if err := agencies.StartAskRun(ctx, m.registry, m.instanceID, a); err != nil {
		slog.Error("starting an ask's run failed", "instance", m.instanceID, "ask", a.ID, "error", err.Error())
	}
	return a, nil
}

func (m marketAskRuns) AnswerAsk(ctx context.Context, caller, askID, answer, date, note string) (mwanachamamarket.Ask, error) {
	a, err := m.MarketManager.AnswerAsk(ctx, caller, askID, answer, date, note)
	m.clearWhenSettled(ctx, a, err)
	return a, err
}

func (m marketAskRuns) AnswerAskWithOffer(ctx context.Context, caller, askID, answer, date, note, offerID string, price float64) (mwanachamamarket.Ask, error) {
	a, err := m.MarketManager.AnswerAskWithOffer(ctx, caller, askID, answer, date, note, offerID, price)
	m.clearWhenSettled(ctx, a, err)
	return a, err
}

func (m marketAskRuns) AnswerAskWithMinutes(ctx context.Context, caller, askID, answer, date, note, offerID string, price float64, minutes int) (mwanachamamarket.Ask, error) {
	a, err := m.MarketManager.AnswerAskWithMinutes(ctx, caller, askID, answer, date, note, offerID, price, minutes)
	m.clearWhenSettled(ctx, a, err)
	return a, err
}

func (m marketAskRuns) WithdrawAsk(ctx context.Context, caller, id string) (mwanachamamarket.Ask, error) {
	a, err := m.MarketManager.WithdrawAsk(ctx, caller, id)
	m.clearWhenSettled(ctx, a, err)
	return a, err
}

func (m marketAskRuns) clearWhenSettled(ctx context.Context, a mwanachamamarket.Ask, settleErr error) {
	if settleErr != nil {
		return
	}
	if err := agencies.ClearAskRun(ctx, m.registry, m.instanceID, a.ID); err != nil {
		slog.Error("clearing an ask's waiting step failed", "instance", m.instanceID, "ask", a.ID, "error", err.Error())
	}
}
