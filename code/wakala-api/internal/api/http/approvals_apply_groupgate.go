package http

import (
	"context"
	"errors"
	"strings"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
	mwanachamamarket "wakalaserver/modules/market"
)

type groupGatePayload struct {
	GroupOrderID string `json:"groupOrderID"`
	LineID       string `json:"lineID"`
	Decision     string `json:"decision"`
}

func groupGateManager(ctx context.Context, reg agencies.Registry, instanceID, payload string, needsLine bool) (mwanachamamarket.MarketManager, groupGatePayload, error) {
	var p groupGatePayload
	if err := decodePayload(payload, &p); err != nil {
		return nil, p, err
	}
	p.GroupOrderID, p.LineID, p.Decision = strings.TrimSpace(p.GroupOrderID), strings.TrimSpace(p.LineID), strings.TrimSpace(p.Decision)
	if p.GroupOrderID == "" {
		return nil, p, errors.New("name the group order by groupOrderID")
	}
	if needsLine && p.LineID == "" {
		return nil, p, errors.New("name the line by lineID")
	}
	m, err := announcedMarketManager(ctx, reg, instanceID, marketNameIn(payload))
	return m, p, err
}

func applyDecideSilentLine(ctx context.Context, reg agencies.Registry, instanceID, payload string) error {
	m, p, err := groupGateManager(ctx, reg, instanceID, payload, true)
	if err != nil {
		return err
	}
	_, err = m.DecideSilentLine(ctx, accounts.IDFromContext(ctx), p.GroupOrderID, p.LineID, p.Decision)
	return err
}

func applyCallOff(ctx context.Context, reg agencies.Registry, instanceID, payload string) error {
	m, p, err := groupGateManager(ctx, reg, instanceID, payload, false)
	if err != nil {
		return err
	}
	_, err = m.CallOffGroupOrder(ctx, accounts.IDFromContext(ctx), p.GroupOrderID)
	return err
}

func applySendGroupOrder(ctx context.Context, reg agencies.Registry, instanceID, payload string) error {
	m, p, err := groupGateManager(ctx, reg, instanceID, payload, false)
	if err != nil {
		return err
	}
	_, err = m.SendGroupOrder(ctx, accounts.IDFromContext(ctx), p.GroupOrderID)
	return err
}

func applyMarkLinePaid(ctx context.Context, reg agencies.Registry, instanceID, payload string) error {
	m, p, err := groupGateManager(ctx, reg, instanceID, payload, true)
	if err != nil {
		return err
	}
	_, err = m.MarkLinePaid(ctx, accounts.IDFromContext(ctx), p.GroupOrderID, p.LineID)
	return err
}

func init() {
	approvalAppliers["market_decide_silent_line"] = applyDecideSilentLine
	approvalAppliers["market_call_off"] = applyCallOff
	approvalAppliers["market_send_group_order"] = applySendGroupOrder
	approvalAppliers["market_mark_line_paid"] = applyMarkLinePaid
}
