package http

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"wakalaserver/internal/agencies"
	"wakalaserver/modules/agency/models"
)

func applySetMeasure(ctx context.Context, reg agencies.Registry, instanceID, payload string) error {
	var p struct {
		ObjectiveID string `json:"objective_id"`
		Name        string `json:"name"`
		Target      string `json:"target"`
		Unit        string `json:"unit"`
		Status      string `json:"status"`
	}
	if err := decodePayload(payload, &p); err != nil {
		return err
	}
	if strings.TrimSpace(p.ObjectiveID) == "" {
		return errors.New("name the objective by objective_id")
	}
	m, err := agencyManagerFor(ctx, reg, instanceID)
	if err != nil {
		return err
	}
	draftID, err := workingDraftID(ctx, m)
	if err != nil {
		return err
	}
	objective, err := m.GetObjective(ctx, p.ObjectiveID)
	if err != nil {
		return err
	}
	if objective.DraftID != draftID {
		return fmt.Errorf("the objective %q is not in the open draft", p.ObjectiveID)
	}
	_, err = m.SetMeasure(ctx, models.Measure{ObjectiveID: p.ObjectiveID, Name: p.Name, Target: p.Target, Unit: p.Unit, Status: p.Status})
	return err
}

func init() {
	approvalAppliers["agency_set_measure"] = applySetMeasure
}
