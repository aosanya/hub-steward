package ai

import (
	"context"
	"errors"
	"strings"
	"testing"
)

func (h *limitsHub) setOwner(t *testing.T, ownerDay, ownerMonth, day, month int) {
	t.Helper()
	in := AssistantLimits{TokensPerPersonDay: day, TokensPerPersonMonth: month, OwnerTokensPerPersonDay: ownerDay, OwnerTokensPerPersonMonth: ownerMonth}
	if _, err := h.m.SetAssistantLimits(context.Background(), limitsAgency, in); err != nil {
		t.Fatal(err)
	}
}

func TestTheOwnersPairIsReadBackAsSet(t *testing.T) {
	h := newLimitsHub(t)
	h.setOwner(t, 500, 9000, 100, 2000)
	got, err := h.m.GetAssistantLimits(context.Background(), limitsAgency)
	if err != nil || got.OwnerTokensPerPersonDay != 500 || got.OwnerTokensPerPersonMonth != 9000 || got.TokensPerPersonDay != 100 || got.TokensPerPersonMonth != 2000 {
		t.Fatalf("limits read back = %+v, %v", got, err)
	}
}

func TestANegativeOwnerNumberIsRefused(t *testing.T) {
	h := newLimitsHub(t)
	_, err := h.m.SetAssistantLimits(context.Background(), limitsAgency, AssistantLimits{OwnerTokensPerPersonMonth: -1})
	if !errors.Is(err, ErrInvalidAccount) {
		t.Fatalf("a negative owner month number = %v, want ErrInvalidAccount", err)
	}
}

func TestTheOwnerIsHeldToTheOwnersDayNumberNotThePeoplesNumber(t *testing.T) {
	h := newLimitsHub(t)
	h.owners["boss"] = true
	h.setOwner(t, 50, 0, 1000, 0)
	h.spend(t, "boss", 50)
	_, err := h.ask("boss", "")
	if !errors.Is(err, ErrAssistantLimit) || !strings.HasPrefix(err.Error(), "assistant limit: day") {
		t.Fatalf("the owner at their own day number = %v, want 'assistant limit: day'", err)
	}
	if h.calls.Load() != 0 {
		t.Fatal("the model was called for an owner at their limit")
	}
}

func TestTheOwnerIsHeldToTheOwnersMonthNumber(t *testing.T) {
	h := newLimitsHub(t)
	h.owners["boss"] = true
	h.setOwner(t, 0, 80, 0, 100000)
	h.spend(t, "boss", 80)
	_, err := h.ask("boss", "")
	if !errors.Is(err, ErrAssistantLimit) || !strings.HasPrefix(err.Error(), "assistant limit: month") {
		t.Fatalf("the owner at their own month number = %v, want 'assistant limit: month'", err)
	}
}

func TestAnOwnerWithNoOwnerNumberHasNoLimitEvenWhenThePeoplesNumberIsSet(t *testing.T) {
	h := newLimitsHub(t)
	h.owners["boss"] = true
	h.setOwner(t, 0, 0, 100, 100)
	h.spend(t, "boss", 5000)
	if _, err := h.ask("boss", ""); err != nil {
		t.Fatalf("an owner with no owner number = %v, want no limit", err)
	}
}

func TestAPersonIsStillHeldToThePeoplesNumberWhenTheOwnerHasAGenerousOne(t *testing.T) {
	h := newLimitsHub(t)
	h.setOwner(t, 100000, 100000, 100, 0)
	h.spend(t, "ana", 100)
	if _, err := h.ask("ana", ""); !errors.Is(err, ErrAssistantLimit) {
		t.Fatalf("a person at the people's number = %v, want the limit", err)
	}
}

func TestTheOwnerSeesTheirOwnNumbersInTheirUsage(t *testing.T) {
	h := newLimitsHub(t)
	h.owners["boss"] = true
	h.setOwner(t, 50, 900, 1000, 20000)
	h.spend(t, "boss", 60)
	got, err := h.m.MyAssistantUsage(context.Background(), limitsAgency, "boss")
	if err != nil {
		t.Fatal(err)
	}
	if got.DayLimit != 50 || got.MonthLimit != 900 || got.DayTokens != 60 || got.Reached != "day" {
		t.Fatalf("the owner's usage = %+v, want the owner's limits 50 and 900 and day reached", got)
	}
	person, err := h.m.MyAssistantUsage(context.Background(), limitsAgency, "ana")
	if err != nil {
		t.Fatal(err)
	}
	if person.DayLimit != 1000 || person.MonthLimit != 20000 || person.Reached != "" {
		t.Fatalf("a person's usage = %+v, want the people's limits", person)
	}
}

func TestAnOwnerWithNoOwnerNumberSeesNoLimitInTheirUsage(t *testing.T) {
	h := newLimitsHub(t)
	h.owners["boss"] = true
	h.setOwner(t, 0, 0, 100, 100)
	h.spend(t, "boss", 5000)
	got, err := h.m.MyAssistantUsage(context.Background(), limitsAgency, "boss")
	if err != nil {
		t.Fatal(err)
	}
	if got.DayLimit != 0 || got.MonthLimit != 0 || got.Reached != "" {
		t.Fatalf("an owner with no number = %+v, want no limit and nothing reached", got)
	}
}
