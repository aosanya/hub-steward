package agencies

import (
	"context"
	"errors"
	"fmt"

	mwanachamacatalog "wakalaserver/modules/catalog"
	commmodels "wakalaserver/modules/comm/models"
)

const (
	PaymentListRecipientPermission = "payment.receive_unpaid_list"
	PaymentListRecipientsSetting   = "unpaid_list_recipients"
	paymentListRecipientsAnyone    = "anyone"
)

type RaiseRecipientRule func(ctx context.Context, instanceID string, event commmodels.NotificationEvent, recipientID string) error

type HoldsPermission func(ctx context.Context, instanceID, actorID string) (bool, error)

type RecipientsWidened func(ctx context.Context, instanceID string) (bool, error)

func WithPaymentListHolders(holds HoldsPermission) Option {
	return func(r *registry) { r.paymentListHolds = holds }
}

func PaymentListRecipientRule(holds HoldsPermission, widened RecipientsWidened) RaiseRecipientRule {
	return func(ctx context.Context, instanceID string, event commmodels.NotificationEvent, recipientID string) error {
		if event != commmodels.EventPaymentListHandedOver {
			return nil
		}
		open, err := widened(ctx, instanceID)
		if err != nil {
			return fmt.Errorf("the list of who has not paid cannot go out: %w", err)
		}
		if open {
			return nil
		}
		held, err := holds(ctx, instanceID, recipientID)
		if err != nil {
			return fmt.Errorf("the list of who has not paid cannot go out: %w", err)
		}
		if !held {
			return fmt.Errorf("only a person whose seat receives the list of who has not paid may be sent it")
		}
		return nil
	}
}

func (r *registry) paymentListWidenedIn(ctx context.Context, instanceID string) (bool, error) {
	catalog, err := r.CatalogManager(ctx, instanceID, MountCatalog)
	if err != nil {
		return false, err
	}
	setting, err := catalog.GetSetting(ctx, PaymentListRecipientsSetting)
	if errors.Is(err, mwanachamacatalog.ErrSettingNotFound) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return setting.Value == paymentListRecipientsAnyone, nil
}
