package agencies

import (
	"context"
	"errors"
	"testing"

	commmodels "wakalaserver/modules/comm/models"
)

func ruleFor(staff map[string]bool, widened bool) RaiseRecipientRule {
	return PaymentListRecipientRule(
		func(_ context.Context, _ string, recipient string) (bool, error) { return staff[recipient], nil },
		func(context.Context, string) (bool, error) { return widened, nil },
	)
}

func TestTheUnpaidListGoesToAStaffRecipientAndIsRefusedForAResident(t *testing.T) {
	rule := ruleFor(map[string]bool{"clerk": true}, false)
	ctx := context.Background()
	if err := rule(ctx, "i-1", commmodels.EventPaymentListHandedOver, "clerk"); err != nil {
		t.Fatalf("a staff recipient = %v, want accepted", err)
	}
	if err := rule(ctx, "i-1", commmodels.EventPaymentListHandedOver, "neighbour"); err == nil {
		t.Fatalf("a resident recipient was accepted, want a refusal")
	}
}

func TestTheOwnersSettingWidensTheUnpaidListToAnyone(t *testing.T) {
	rule := ruleFor(map[string]bool{}, true)
	if err := rule(context.Background(), "i-1", commmodels.EventPaymentListHandedOver, "neighbour"); err != nil {
		t.Fatalf("a resident recipient with the setting widened = %v, want accepted", err)
	}
}

func TestTheRecipientRuleLeavesEveryOtherEventAlone(t *testing.T) {
	rule := ruleFor(map[string]bool{}, false)
	if err := rule(context.Background(), "i-1", commmodels.EventReportHandedOver, "neighbour"); err != nil {
		t.Fatalf("report_handed_over to a resident = %v, want untouched", err)
	}
}

func TestAFailedPermissionReadRefusesTheUnpaidList(t *testing.T) {
	boom := errors.New("read failed")
	rule := PaymentListRecipientRule(
		func(context.Context, string, string) (bool, error) { return false, boom },
		func(context.Context, string) (bool, error) { return false, nil },
	)
	if err := rule(context.Background(), "i-1", commmodels.EventPaymentListHandedOver, "clerk"); err == nil {
		t.Fatalf("a failed read accepted the recipient, want a refusal")
	}
}
