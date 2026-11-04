package http

import (
	"context"
	"errors"
	"strings"

	"wakalaserver/modules/riskmanager/models"

	"wakalaserver/internal/agencies"
)

type riskPayload struct {
	Title    string `json:"title"`
	TopEvent string `json:"top_event"`
	Hazard   string `json:"hazard"`
	Owner    string `json:"owner"`
}

type pathwayPayload struct {
	RiskID   string `json:"risk_id"`
	Title    string `json:"title"`
	Scenario string `json:"scenario"`
}

func applyCreateRisk(ctx context.Context, reg agencies.Registry, instanceID, payload string) error {
	var p riskPayload
	if err := decodePayload(payload, &p); err != nil {
		return err
	}
	if strings.TrimSpace(p.Title) == "" || strings.TrimSpace(p.TopEvent) == "" {
		return errors.New("name the risk by title and top_event")
	}
	m, err := riskManagerFor(ctx, reg, instanceID)
	if err != nil {
		return err
	}
	_, err = m.CreateRisk(ctx, models.Risk{Title: p.Title, TopEvent: p.TopEvent, Hazard: p.Hazard, Owner: p.Owner})
	return err
}

func applyCreatePathway(side models.Side) approvalApplier {
	return func(ctx context.Context, reg agencies.Registry, instanceID, payload string) error {
		var p pathwayPayload
		if err := decodePayload(payload, &p); err != nil {
			return err
		}
		if strings.TrimSpace(p.RiskID) == "" || strings.TrimSpace(p.Title) == "" {
			return errors.New("name the pathway by risk_id and title")
		}
		m, err := riskManagerFor(ctx, reg, instanceID)
		if err != nil {
			return err
		}
		_, err = m.CreatePathway(ctx, models.Pathway{RiskID: p.RiskID, Side: side, Title: p.Title, Scenario: p.Scenario})
		return err
	}
}
