package ai

import (
	"context"
	"errors"
	"testing"
	"time"
)

func (h *limitsHub) mine(t *testing.T, person string) AssistantUsage {
	t.Helper()
	got, err := h.m.MyAssistantUsage(context.Background(), limitsAgency, person)
	if err != nil {
		t.Fatalf("MyAssistantUsage(%q) = %v", person, err)
	}
	return got
}

func TestAPersonWithNoLimitAndNoUseSeesZerosAndNothingReached(t *testing.T) {
	h := newLimitsHub(t)
	got := h.mine(t, "ana")
	if got != (AssistantUsage{}) {
		t.Fatalf("usage = %+v, want all zeros and nothing reached", got)
	}
}

func TestAPersonSeesTheirOwnDayAndMonthCountBesideTheLimits(t *testing.T) {
	h := newLimitsHub(t)
	h.set(t, 100, 1000)
	h.spend(t, "ana", 60)
	got := h.mine(t, "ana")
	want := AssistantUsage{DayTokens: 60, MonthTokens: 60, DayLimit: 100, MonthLimit: 1000}
	if got != want {
		t.Fatalf("usage = %+v, want %+v", got, want)
	}
}

func TestAPersonWhoReachedTheirDayIsToldTheDayWasReached(t *testing.T) {
	h := newLimitsHub(t)
	h.set(t, 100, 1000)
	h.spend(t, "ana", 100)
	if got := h.mine(t, "ana"); got.Reached != "day" {
		t.Fatalf("reached = %q, want day", got.Reached)
	}
}

func TestAPersonWhoReachedOnlyTheirMonthIsToldTheMonthWasReached(t *testing.T) {
	h := newLimitsHub(t)
	h.set(t, 1000, 100)
	earlier := h.clock.AddDate(0, 0, -5)
	*h.clock = earlier
	h.spend(t, "ana", 100)
	*h.clock = earlier.AddDate(0, 0, 5)
	got := h.mine(t, "ana")
	if got.Reached != "month" || got.DayTokens != 0 || got.MonthTokens != 100 {
		t.Fatalf("usage = %+v, want month reached with 0 today and 100 this month", got)
	}
}

func TestAnotherPersonsUseIsNeverInMyCount(t *testing.T) {
	h := newLimitsHub(t)
	h.set(t, 100, 1000)
	h.spend(t, "ana", 500)
	got := h.mine(t, "ben")
	if got.DayTokens != 0 || got.MonthTokens != 0 || got.Reached != "" {
		t.Fatalf("ben's usage = %+v, want none of ana's use in it", got)
	}
}

func TestLastMonthsUseIsNotInThisMonthsCount(t *testing.T) {
	h := newLimitsHub(t)
	h.set(t, 0, 100)
	*h.clock = time.Date(2026, 10, 31, 23, 0, 0, 0, time.UTC)
	h.spend(t, "ana", 500)
	*h.clock = time.Date(2026, 11, 1, 0, 30, 0, 0, time.UTC)
	got := h.mine(t, "ana")
	if got.MonthTokens != 0 || got.Reached != "" {
		t.Fatalf("usage = %+v, want last month left out", got)
	}
}

func TestACallWithNoCallerPersonShowsNothingAndIsRefused(t *testing.T) {
	h := newLimitsHub(t)
	h.spend(t, "ana", 500)
	_, err := h.m.MyAssistantUsage(context.Background(), limitsAgency, "")
	if !errors.Is(err, ErrInvalidAccount) {
		t.Fatalf("a call with no caller person = %v, want ErrInvalidAccount", err)
	}
}
