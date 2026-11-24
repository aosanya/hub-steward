package http

import (
	"context"
	"encoding/json"
	"errors"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
	catalog "github.com/aosanya/mwanachama-backend-catalog"

	"wakalaserver/internal/agencies"
)

const registerDetailsKeyPrefix = "register_details:"

type registerDetail struct {
	Prompt   string `json:"prompt"`
	On       bool   `json:"on"`
	Required bool   `json:"required"`
	Own      bool   `json:"own"`
}

type registerDetails struct {
	Details []registerDetail `json:"details"`
}

func allowanceOf(chosen registerDetails) mwanachamaagency.RowAllowance {
	var allowance mwanachamaagency.RowAllowance
	for _, detail := range chosen.Details {
		switch {
		case detail.Own && detail.On:
			allowance.Extra = append(allowance.Extra, mwanachamaagency.ExtraDetail{Prompt: detail.Prompt, Required: detail.Required})
		case !detail.Own && (!detail.On || !detail.Required):
			allowance.Waived = append(allowance.Waived, detail.Prompt)
		}
	}
	return allowance
}

func chosenDetails(ctx context.Context, reg agencies.Registry, instanceID, recordCode string) (registerDetails, error) {
	cm, err := reg.CatalogManager(ctx, instanceID, formsCatalogMount)
	if err != nil {
		return registerDetails{}, nil
	}
	setting, err := cm.GetSetting(ctx, registerDetailsKeyPrefix+recordCode)
	if errors.Is(err, catalog.ErrSettingNotFound) {
		return registerDetails{}, nil
	}
	if err != nil {
		return registerDetails{}, err
	}
	var chosen registerDetails
	if err := json.Unmarshal([]byte(setting.Value), &chosen); err != nil {
		return registerDetails{}, nil
	}
	return chosen, nil
}

func chosenDetailsOfRecord(ctx context.Context, reg agencies.Registry, instanceID string, record agencymodels.Record) (registerDetails, error) {
	for _, name := range []string{record.Identity(), record.Code} {
		chosen, err := chosenDetails(ctx, reg, instanceID, name)
		if err != nil || len(chosen.Details) > 0 {
			return chosen, err
		}
	}
	return registerDetails{}, nil
}

func withChosenDetails(ctx context.Context, reg agencies.Registry, instanceID string, record agencymodels.Record) (context.Context, error) {
	chosen, err := chosenDetailsOfRecord(ctx, reg, instanceID, record)
	if err != nil {
		return ctx, err
	}
	return mwanachamaagency.WithRowAllowance(ctx, allowanceOf(chosen)), nil
}
