package ai

import (
	"context"
	"errors"
	"testing"

	"wakalaserver/modules/ai/models"
)

const (
	composedModel   = "Győr gyors"
	decomposedModel = "Győr gyors"
)

func TestAccountNames_ADecomposedTwinOfAnAccountNameIsASecondAccount(t *testing.T) {
	h := newLimitsHub(t)
	ctx := context.Background()
	h.chatAccount(t, composedModel, false)
	_, err := h.m.CreateAccount(ctx, limitsAgency, Account{Name: decomposedModel, Provider: models.ProviderOpenAICompatible, BaseURL: "http://models.invalid", ModelName: "m", Status: models.StatusEnabled})
	if !errors.Is(err, ErrDuplicateName) {
		t.Fatalf("create the decomposed twin = %v, want ErrDuplicateName", err)
	}
	other := h.chatAccount(t, "other", false)
	other.Name = decomposedModel
	if _, err := h.m.UpdateAccount(ctx, limitsAgency, other.ID, other); !errors.Is(err, ErrDuplicateName) {
		t.Fatalf("rename onto the decomposed twin = %v, want ErrDuplicateName", err)
	}
}

func TestAccountNames_AnAccountMayTakeItsOwnNameInAnotherForm(t *testing.T) {
	h := newLimitsHub(t)
	made := h.chatAccount(t, composedModel, false)
	made.Name = decomposedModel
	if _, err := h.m.UpdateAccount(context.Background(), limitsAgency, made.ID, made); err != nil {
		t.Fatalf("an account may take its own name in another form: %v", err)
	}
}

func TestAIRoleNames_ADecomposedTwinOfARoleNameIsASecondRole(t *testing.T) {
	h := newLimitsHub(t)
	ctx := context.Background()
	h.aiRole(t, composedModel, models.AIRoleInput{})
	if _, err := h.m.CreateAIRole(ctx, limitsAgency, models.AIRoleInput{Name: decomposedModel, Status: "enabled"}); !errors.Is(err, ErrDuplicateRoleName) {
		t.Fatalf("create the decomposed twin = %v, want ErrDuplicateRoleName", err)
	}
	other := h.aiRole(t, "other", models.AIRoleInput{})
	if _, err := h.m.UpdateAIRole(ctx, limitsAgency, other.ID, "ana", models.AIRoleInput{Name: decomposedModel, Status: "enabled"}); !errors.Is(err, ErrDuplicateRoleName) {
		t.Fatalf("rename onto the decomposed twin = %v, want ErrDuplicateRoleName", err)
	}
}

func TestAIRoleNames_ARoleMayTakeItsOwnNameInAnotherForm(t *testing.T) {
	h := newLimitsHub(t)
	made := h.aiRole(t, composedModel, models.AIRoleInput{})
	if _, err := h.m.UpdateAIRole(context.Background(), limitsAgency, made.ID, "ana", models.AIRoleInput{Name: decomposedModel, Status: "enabled"}); err != nil {
		t.Fatalf("a role may take its own name in another form: %v", err)
	}
}
