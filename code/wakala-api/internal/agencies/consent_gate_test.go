package agencies

import (
	"context"
	"errors"
	"testing"
)

func TestConsentGateIsAbsentUntilTheRegistryIsTold(t *testing.T) {
	r := &registry{}
	if g := r.consentGateIn("i-1"); g != nil {
		t.Fatalf("gate = %v, want nil with no consent option", g)
	}
}

func TestConsentGatePassesWhenCustodyIsNotMounted(t *testing.T) {
	r := &registry{consentRequired: func(context.Context, string) (bool, error) { return false, nil }}
	if err := r.consentGateIn("i-1").Check(context.Background(), "mem-1"); err != nil {
		t.Fatalf("Check = %v, want nil", err)
	}
}

func TestConsentGateFailsClosedWhenTheMountCannotBeRead(t *testing.T) {
	boom := errors.New("read failed")
	r := &registry{consentRequired: func(context.Context, string) (bool, error) { return false, boom }}
	if err := r.consentGateIn("i-1").Check(context.Background(), "mem-1"); !errors.Is(err, boom) {
		t.Fatalf("Check = %v, want the read error", err)
	}
}
