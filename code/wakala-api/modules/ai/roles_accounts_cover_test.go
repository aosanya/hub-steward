package ai

import (
	"context"
	"errors"
	"testing"
	"time"

	"wakalaserver/modules/ai/models"
)

func intp(n int) *int { return &n }

func (h *limitsHub) aiRole(t *testing.T, name string, in models.AIRoleInput) AIRole {
	t.Helper()
	in.Name, in.Status = name, "enabled"
	role, err := h.m.CreateAIRole(context.Background(), limitsAgency, in)
	if err != nil {
		t.Fatal(err)
	}
	return role
}

func (h *limitsHub) chatAccount(t *testing.T, name string, chat bool) Account {
	t.Helper()
	a, err := h.m.CreateAccount(context.Background(), limitsAgency, Account{Name: name, Provider: models.ProviderOpenAICompatible, BaseURL: "http://models.invalid", ModelName: name + "-model", Status: models.StatusEnabled, ChatEnabled: chat})
	if err != nil {
		t.Fatal(err)
	}
	return a
}

func TestChangingARolesFineTuningKeepsTheOldTextAsARevisionThatCanBeRestored(t *testing.T) {
	h := newLimitsHub(t)
	ctx := context.Background()
	role := h.aiRole(t, "triager", models.AIRoleInput{FineTuning: "first words"})
	if _, err := h.m.UpdateAIRole(ctx, limitsAgency, role.ID, "ana", models.AIRoleInput{Name: "triager", Status: "enabled", FineTuning: "second words"}); err != nil {
		t.Fatal(err)
	}
	revisions, err := h.m.ListAIRoleRevisions(ctx, limitsAgency, role.ID)
	if err != nil || len(revisions) != 1 || revisions[0].FineTuning != "first words" || revisions[0].SavedBy != "ana" {
		t.Fatalf("revisions = %+v, %v; want the first words saved by ana", revisions, err)
	}
	*h.clock = h.clock.Add(time.Minute)
	restored, err := h.m.RestoreAIRoleRevision(ctx, limitsAgency, role.ID, revisions[0].ID, "ben")
	if err != nil || restored.FineTuning != "first words" {
		t.Fatalf("restored = %+v, %v", restored, err)
	}
	after, _ := h.m.ListAIRoleRevisions(ctx, limitsAgency, role.ID)
	if len(after) != 2 || after[0].FineTuning != "second words" {
		t.Fatalf("a restore must keep the text it replaced as the newest revision: %+v", after)
	}
}

func TestRenamingARoleOrChangingItsDescriptionLeavesNoRevision(t *testing.T) {
	h := newLimitsHub(t)
	ctx := context.Background()
	role := h.aiRole(t, "triager", models.AIRoleInput{FineTuning: "words"})
	if _, err := h.m.UpdateAIRole(ctx, limitsAgency, role.ID, "ana", models.AIRoleInput{Name: "sorter", Description: "new", Status: "enabled", FineTuning: "words"}); err != nil {
		t.Fatal(err)
	}
	if revisions, _ := h.m.ListAIRoleRevisions(ctx, limitsAgency, role.ID); len(revisions) != 0 {
		t.Fatalf("only tuned fields make a revision, got %+v", revisions)
	}
}

func TestRoleLimitsAreSavedWithARevisionAndAnUnchangedSetMakesNone(t *testing.T) {
	h := newLimitsHub(t)
	ctx := context.Background()
	role := h.aiRole(t, "triager", models.AIRoleInput{FineTuning: "words", TokensPerDay: intp(100)})
	same := models.Limits{TokensPerDay: intp(100)}
	if _, err := h.m.SetAIRoleLimits(ctx, limitsAgency, role.ID, "ana", same); err != nil {
		t.Fatal(err)
	}
	if revisions, _ := h.m.ListAIRoleRevisions(ctx, limitsAgency, role.ID); len(revisions) != 0 {
		t.Fatalf("an unchanged limit made a revision: %+v", revisions)
	}
	changed, err := h.m.SetAIRoleLimits(ctx, limitsAgency, role.ID, "ana", models.Limits{TokensPerDay: intp(50), RequestsPerWeek: intp(7)})
	if err != nil || *changed.TokensPerDay != 50 || *changed.RequestsPerWeek != 7 || changed.TokensPerMonth != nil {
		t.Fatalf("limits = %+v, %v", changed, err)
	}
	revisions, _ := h.m.ListAIRoleRevisions(ctx, limitsAgency, role.ID)
	if len(revisions) != 1 || *revisions[0].TokensPerDay != 100 {
		t.Fatalf("the old limit must be kept as a revision: %+v", revisions)
	}
	if _, err := h.m.SetAIRoleLimits(ctx, limitsAgency, role.ID, "ana", models.Limits{TokensPerDay: intp(-1)}); !errors.Is(err, ErrInvalidRole) {
		t.Fatalf("a negative limit = %v", err)
	}
}

func TestARoleNeedsItsOwnWordsWhenTheAgencysAreSwitchedOffAndItsNameIsUnique(t *testing.T) {
	h := newLimitsHub(t)
	ctx := context.Background()
	h.aiRole(t, "triager", models.AIRoleInput{})
	if _, err := h.m.CreateAIRole(ctx, limitsAgency, models.AIRoleInput{Name: "triager", Status: "enabled"}); !errors.Is(err, ErrDuplicateRoleName) {
		t.Fatalf("a repeated name = %v", err)
	}
	other := h.aiRole(t, "other", models.AIRoleInput{})
	if _, err := h.m.UpdateAIRole(ctx, limitsAgency, other.ID, "ana", models.AIRoleInput{Name: "triager", Status: "enabled"}); !errors.Is(err, ErrDuplicateRoleName) {
		t.Fatalf("renaming onto another role = %v", err)
	}
	off := false
	if _, err := h.m.UpdateAIRole(ctx, limitsAgency, other.ID, "ana", models.AIRoleInput{Name: "other", Status: "enabled", UseAgencyInstructions: &off}); !errors.Is(err, ErrInvalidRole) {
		t.Fatalf("no agency words and no own words = %v", err)
	}
	if _, err := h.m.UpdateAIRole(ctx, limitsAgency, "nobody", "ana", models.AIRoleInput{Name: "x", Status: "enabled"}); !errors.Is(err, ErrRoleNotFound) {
		t.Fatalf("an unknown role = %v", err)
	}
	if _, err := h.m.RestoreAIRoleRevision(ctx, limitsAgency, other.ID, "nope", "ana"); !errors.Is(err, ErrRevisionNotFound) {
		t.Fatalf("an unknown revision = %v", err)
	}
	if _, err := h.m.ListAIRoleRevisions(ctx, limitsAgency, "nobody"); !errors.Is(err, ErrRoleNotFound) {
		t.Fatalf("revisions of an unknown role = %v", err)
	}
}

func TestListingRolesByTheSeatTheyAreMappedToAndDeletingARoleWithItsRevisions(t *testing.T) {
	h := newLimitsHub(t)
	ctx := context.Background()
	a := h.aiRole(t, "a", models.AIRoleInput{FineTuning: "x"})
	b := h.aiRole(t, "b", models.AIRoleInput{})
	if _, err := h.m.SetAIRoleMapping(ctx, limitsAgency, a.ID, AIRoleMappingInput{AgencyRoleID: "seat-1"}); err != nil {
		t.Fatal(err)
	}
	all, _ := h.m.ListAIRoles(ctx, limitsAgency)
	seat, _ := h.m.ListAIRolesOfSeat(ctx, limitsAgency, "seat-1")
	if len(all) != 2 || len(seat) != 1 || seat[0].ID != a.ID {
		t.Fatalf("all %d, seat %+v", len(all), seat)
	}
	if _, err := h.m.UpdateAIRole(ctx, limitsAgency, a.ID, "ana", models.AIRoleInput{Name: "a", Status: "enabled", FineTuning: "y"}); err != nil {
		t.Fatal(err)
	}
	gone, err := h.m.DeleteAIRole(ctx, limitsAgency, a.ID)
	if err != nil || gone.ID != a.ID {
		t.Fatalf("deleted = %+v, %v", gone, err)
	}
	if _, err := h.m.GetAIRole(ctx, limitsAgency, a.ID); !errors.Is(err, ErrRoleNotFound) {
		t.Fatalf("a deleted role is still there: %v", err)
	}
	if left, _ := h.m.ListAIRoles(ctx, limitsAgency); len(left) != 1 || left[0].ID != b.ID {
		t.Fatalf("left = %+v", left)
	}
	if _, err := h.m.DeleteAIRole(ctx, limitsAgency, a.ID); !errors.Is(err, ErrRoleNotFound) {
		t.Fatalf("deleting twice = %v", err)
	}
}

func TestOnlyOneAccountIsTheDefaultAndNoneIsAnErrorThatSaysWhatToDo(t *testing.T) {
	h := newLimitsHub(t)
	ctx := context.Background()
	if _, err := h.m.GetDefaultAccount(ctx, "agency-without-accounts"); !errors.Is(err, ErrNoDefaultAccount) {
		t.Fatalf("no default = %v", err)
	}
	second := h.chatAccount(t, "second", false)
	if _, err := h.m.SetDefaultAccount(ctx, limitsAgency, h.account.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := h.m.SetDefaultAccount(ctx, limitsAgency, second.ID); err != nil {
		t.Fatal(err)
	}
	got, err := h.m.GetDefaultAccount(ctx, limitsAgency)
	if err != nil || got.ID != second.ID {
		t.Fatalf("default = %+v, %v; want the second", got, err)
	}
	first, _ := h.m.GetAccount(ctx, limitsAgency, h.account.ID)
	if first.IsDefault {
		t.Fatal("two accounts are the default")
	}
	if _, err := h.m.SetDefaultAccount(ctx, limitsAgency, "nobody"); !errors.Is(err, ErrAccountNotFound) {
		t.Fatalf("an unknown account = %v", err)
	}
}

func TestAPersonSeesOnlyTheModelsMeantForChatAndTheirPickIsMarked(t *testing.T) {
	h := newLimitsHub(t)
	ctx := context.Background()
	quiet := h.chatAccount(t, "quiet", false)
	fast := h.chatAccount(t, "fast", true)
	list, err := h.m.ListChatModels(ctx, limitsAgency, "ana")
	if err != nil || len(list) != 2 || !list[0].Picked || list[1].Picked {
		t.Fatalf("list = %+v, %v; want the two chat models with the first picked", list, err)
	}
	if list[0].Label != "m" || list[1].Label != "fast-model" {
		t.Fatalf("a model without a label shows its model name: %+v", list)
	}
	picked, err := h.m.PickChatModel(ctx, limitsAgency, "ana", models.ChatPickInput{AccountID: fast.ID})
	if err != nil || !picked[1].Picked || picked[0].Picked {
		t.Fatalf("after the pick = %+v, %v", picked, err)
	}
	other, _ := h.m.ListChatModels(ctx, limitsAgency, "ben")
	if !other[0].Picked {
		t.Fatalf("another person keeps the first model: %+v", other)
	}
	if _, err := h.m.PickChatModel(ctx, limitsAgency, "ana", models.ChatPickInput{AccountID: quiet.ID}); !errors.Is(err, ErrChatModelUnavailable) {
		t.Fatalf("a model that is not for chat = %v", err)
	}
	if _, err := h.m.PickChatModel(ctx, limitsAgency, "", models.ChatPickInput{AccountID: fast.ID}); !errors.Is(err, ErrInvalidAccount) {
		t.Fatalf("a pick without a person = %v", err)
	}
	if _, err := h.m.PickChatModel(ctx, limitsAgency, "ana", models.ChatPickInput{AccountID: "nobody"}); !errors.Is(err, ErrAccountNotFound) {
		t.Fatalf("an unknown model = %v", err)
	}
}

func TestDeletingAnAccountLeavesItsRolesWithoutOneAndForgetsPicksOfIt(t *testing.T) {
	h := newLimitsHub(t)
	ctx := context.Background()
	fast := h.chatAccount(t, "fast", true)
	role := h.aiRole(t, "triager", models.AIRoleInput{FineTuning: "x"})
	if _, err := h.m.SetAIRoleMapping(ctx, limitsAgency, role.ID, AIRoleMappingInput{AccountID: fast.ID, AgencyRoleID: "seat-1"}); err != nil {
		t.Fatal(err)
	}
	if _, err := h.m.PickChatModel(ctx, limitsAgency, "ana", models.ChatPickInput{AccountID: fast.ID}); err != nil {
		t.Fatal(err)
	}
	if _, err := h.m.DeleteAccount(ctx, limitsAgency, fast.ID); err != nil {
		t.Fatal(err)
	}
	released, _ := h.m.GetAIRole(ctx, limitsAgency, role.ID)
	if released.AccountID != "" || released.AgencyRoleID != "seat-1" {
		t.Fatalf("the role must lose its account and keep its seat: %+v", released)
	}
	list, _ := h.m.ListChatModels(ctx, limitsAgency, "ana")
	if len(list) != 1 || list[0].ID != h.account.ID || !list[0].Picked {
		t.Fatalf("chat models after the delete = %+v", list)
	}
	if accounts, _ := h.m.ListAccounts(ctx, limitsAgency); len(accounts) != 1 {
		t.Fatalf("accounts = %+v", accounts)
	}
	if _, err := h.m.DeleteAccount(ctx, limitsAgency, fast.ID); !errors.Is(err, ErrAccountNotFound) {
		t.Fatalf("deleting twice = %v", err)
	}
}

func TestAccountLimitsAreSavedAndANegativeOneIsRefused(t *testing.T) {
	h := newLimitsHub(t)
	ctx := context.Background()
	saved, err := h.m.SetAccountLimits(ctx, limitsAgency, h.account.ID, models.Limits{TokensPerCall: intp(30), RequestsPerMinute: intp(2)})
	if err != nil || *saved.TokensPerCall != 30 || *saved.RequestsPerMinute != 2 {
		t.Fatalf("saved = %+v, %v", saved, err)
	}
	if _, err := h.m.SetAccountLimits(ctx, limitsAgency, h.account.ID, models.Limits{TokensPerDay: intp(-5)}); !errors.Is(err, ErrInvalidAccount) {
		t.Fatalf("a negative limit = %v", err)
	}
	if _, err := h.m.SetAccountLimits(ctx, limitsAgency, "nobody", models.Limits{}); !errors.Is(err, ErrAccountNotFound) {
		t.Fatalf("an unknown account = %v", err)
	}
}
