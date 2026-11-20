package http

import (
	"context"
	"testing"

	mwanachamacomm "github.com/aosanya/mwanachama-backend-comm"
	commmodels "github.com/aosanya/mwanachama-backend-comm/models"

	"wakalaserver/internal/agencies"
)

func unpaidListComm(t *testing.T, w stepRunWalk, setting string) *mwanachamacomm.CommManager {
	t.Helper()
	ctx := context.Background()
	nobodyHoldsTheSeat := func(context.Context, string, string) (bool, error) { return false, nil }
	reg, err := agencies.NewRegistry(w.db, agencies.WithPaymentListHolders(nobodyHoldsTheSeat))
	if err != nil {
		t.Fatalf("NewRegistry: %v", err)
	}
	if setting != "" {
		settings, err := w.deps.Registry.CatalogManager(ctx, w.instance, formsCatalogMount)
		if err != nil {
			t.Fatalf("CatalogManager: %v", err)
		}
		if _, err := settings.PutSetting(ctx, agencies.PaymentListRecipientsSetting, setting); err != nil {
			t.Fatalf("PutSetting: %v", err)
		}
	}
	comm, err := reg.CommManager(ctx, w.instance)
	if err != nil {
		t.Fatalf("CommManager: %v", err)
	}
	return comm
}

func unpaidListRoster(t *testing.T, w stepRunWalk, setting string) int {
	t.Helper()
	comm := unpaidListComm(t, w, setting)
	people, err := comm.ListRaiseRecipients(context.Background(), string(commmodels.EventPaymentListHandedOver))
	if err != nil {
		t.Fatalf("ListRaiseRecipients: %v", err)
	}
	return len(people)
}

func TestTheUnpaidListRosterHoldsNobodyWhenTheOwnerHasNotWidenedIt(t *testing.T) {
	w := referral(t)

	if got := unpaidListRoster(t, w, ""); got != 0 {
		t.Fatalf("roster with no setting and nobody in the seat = %d people, want 0", got)
	}
}

func TestTheUnpaidListRosterHoldsEveryoneOnceTheOwnerSetsItToAnyoneThroughTheCatalogSettings(t *testing.T) {
	w := referral(t)

	if got := unpaidListRoster(t, w, "anyone"); got == 0 {
		t.Fatalf("roster with the setting at anyone = %d people, want everyone", got)
	}
}

func raiseUnpaidListFor(t *testing.T, w stepRunWalk, setting, recipient string) error {
	t.Helper()
	comm := unpaidListComm(t, w, setting)
	_, err := comm.RaiseNotificationFor(context.Background(), recipient, recipient, commmodels.CategoryTask, commmodels.EventPaymentListHandedOver, commmodels.SubjectReport, "report-1", map[string]string{})
	return err
}

func TestAResidentIsSentTheUnpaidListOnlyOnceTheOwnerSetsItToAnyone(t *testing.T) {
	w := referral(t)
	resident := "resident-1"

	if err := raiseUnpaidListFor(t, w, "", resident); err == nil {
		t.Fatalf("a resident was sent the list with no setting, want a refusal")
	}
	if err := raiseUnpaidListFor(t, w, "anyone", resident); err != nil {
		t.Fatalf("a resident with the setting at anyone = %v, want accepted", err)
	}
}
