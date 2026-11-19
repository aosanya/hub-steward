package mwanachamacomm_test

import (
	"context"
	"errors"
	"testing"

	comm "wakalaserver/modules/comm"
	"wakalaserver/modules/comm/models"
)

func raisingManager(t *testing.T, rule comm.RecipientRule) *comm.CommManager {
	t.Helper()
	m, _, _ := gatedManagerOn(t, nil)
	m.UseRaisable(func(models.NotificationEvent) bool { return true })
	m.UseRecipientRule(rule)
	return m
}

func raiseListFor(m *comm.CommManager, recipient string) error {
	_, err := m.RaiseNotificationFor(context.Background(), "owner-1", recipient, models.CategoryTask, models.EventPaymentListHandedOver, models.SubjectReport, "2026-11-19", map[string]string{"total": "1 000 Ft"})
	return err
}

func TestARecipientTheRuleRefusesIsNeverToldAndNothingIsStored(t *testing.T) {
	m := raisingManager(t, func(_ context.Context, _ models.NotificationEvent, recipient string) error {
		if recipient == "resident-1" {
			return errors.New("not staff")
		}
		return nil
	})
	err := raiseListFor(m, "resident-1")
	if !errors.Is(err, models.ErrNotificationNotRaisable) {
		t.Fatalf("raising for a refused recipient = %v, want ErrNotificationNotRaisable", err)
	}
	if err := raiseListFor(m, "staff-1"); err != nil {
		t.Fatalf("raising for an allowed recipient = %v, want accepted", err)
	}
}

func TestWithNoRecipientRuleEveryRaisableEventStillGoesToAnyone(t *testing.T) {
	m := raisingManager(t, nil)
	if err := raiseListFor(m, "resident-1"); err != nil {
		t.Fatalf("raising with no recipient rule = %v, want accepted", err)
	}
}
