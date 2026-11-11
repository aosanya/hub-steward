package agencies

import (
	"context"
	"testing"
)

func TestConsentGateLetsAnAgentPostWithoutAConsentRecord(t *testing.T) {
	reg, id := registryWithMembers(t, map[string]string{"helper": RoleAgent})
	reg.consentRequired = func(context.Context, string) (bool, error) { return true, nil }
	if err := reg.consentGateIn(id).Check(context.Background(), "helper"); err != nil {
		t.Fatalf("Check = %v, want nil for an agent", err)
	}
}
