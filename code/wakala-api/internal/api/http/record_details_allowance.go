package http

import (
	"context"
	"encoding/json"
	"errors"

	mwanachamaagency "wakalaserver/modules/agency"
	catalog "wakalaserver/modules/catalog"

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

func withChosenDetails(ctx context.Context, reg agencies.Registry, instanceID, recordCode string) (context.Context, error) {
	chosen, err := chosenDetails(ctx, reg, instanceID, recordCode)
	if err != nil {
		return ctx, err
	}
	return mwanachamaagency.WithRowAllowance(ctx, allowanceOf(chosen)), nil
}
