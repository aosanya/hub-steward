package agencies

import (
	"context"
	"errors"

	mwanachamaaccounting "github.com/aosanya/mwanachama-backend-accounting"
	mwanachamacatalog "github.com/aosanya/mwanachama-backend-catalog"
)

const (
	PaymentOverpaymentSetting = "payment_overpayment"
	overpaymentAllowedValue   = "allowed"
)

func settingAllows(value string, err error, allowed string) (bool, error) {
	if errors.Is(err, mwanachamacatalog.ErrSettingNotFound) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return value == allowed, nil
}

func (r *registry) overpaymentAllowedIn(instanceID string) mwanachamaaccounting.OverpaymentAllowed {
	return func(ctx context.Context) (bool, error) {
		catalog, err := r.CatalogManager(ctx, instanceID, MountFormRecords)
		if err != nil {
			return false, err
		}
		setting, err := catalog.GetSetting(ctx, PaymentOverpaymentSetting)
		return settingAllows(setting.Value, err, overpaymentAllowedValue)
	}
}
