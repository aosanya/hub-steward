package http

import (
	"context"
	"errors"
	"testing"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
	ai "wakalaserver/modules/ai"
	airoutes "wakalaserver/modules/ai/routes"
)

func residentGateWalk(t *testing.T) groupRoleWalk {
	t.Helper()
	w := newGroupRoleWalk(t)
	withAITools(w.deps)
	perms := map[string][]string{
		w.roles["Worker"]: {"task.read", "task.edit", "mount.list", "ai.chat"},
		w.roles["Reader"]: {"task.read"},
	}
	w.deps.rolePermissionsOverride = func(_ context.Context, roleID string) ([]string, error) {
		return perms[roleID], nil
	}
	return w
}

func asPerson(id string) context.Context {
	return accounts.WithID(context.Background(), id)
}

func aiToolActions(t *testing.T) map[string]string {
	t.Helper()
	out := map[string]string{}
	for _, tool := range airoutes.Tools(struct{ ai.Manager }{}) {
		out[tool.Name] = tool.Action
	}
	return out
}

func TestAResidentInAGroupWhoseRoleHoldsMountListListsTheMounts(t *testing.T) {
	w := residentGateWalk(t)
	id, _ := w.resident(t, "Kofi", "Dev")
	w.giveRole(t, "Dev", "Worker")

	view, err := w.deps.agencyMounts(asPerson(id), w.deps.Registry, w.instance)
	if err != nil {
		t.Fatalf("a Backlog worker lists the mounts: %v", err)
	}
	if len(view.Modules) == 0 {
		t.Fatal("a Backlog worker sees no module in the mount list")
	}
}

func TestAResidentWhoseRoleLacksMountListIsRefusedTheMountsWithTheSameTextAsAStranger(t *testing.T) {
	w := residentGateWalk(t)
	reader, _ := w.resident(t, "Amina", "Support")
	w.giveRole(t, "Support", "Reader")
	noRole, _ := w.resident(t, "Zuri", "Ops")

	for name, id := range map[string]string{"role without mount.list": reader, "group with no role": noRole, "stranger": "a-stranger"} {
		_, err := w.deps.agencyMounts(asPerson(id), w.deps.Registry, w.instance)
		if !errors.Is(err, agencies.ErrInstanceNotFound) {
			t.Errorf("%s lists the mounts: %v, want the instance-not-found refusal", name, err)
		}
	}
}

func TestAResidentWhoseRoleHoldsAIChatMayChatAndPickAModelButNotListAccountsOrSpend(t *testing.T) {
	w := residentGateWalk(t)
	id, _ := w.resident(t, "Kofi", "Dev")
	w.giveRole(t, "Dev", "Worker")
	actions := aiToolActions(t)

	for _, name := range []string{"ai_chat_account", "ai_list_chat_models", "ai_pick_chat_model", "ai_get_assistant_limits"} {
		if _, err := w.deps.aiAdmitted(asPerson(id), w.instance, actions[name]); err != nil {
			t.Errorf("a Backlog worker is refused %s: %v", name, err)
		}
	}
	for _, name := range []string{"ai_list_accounts", "ai_record_usage", "ai_check_limits", "ai_update_account", "ai_set_account_key", "ai_set_assistant_limits"} {
		if _, err := w.deps.aiAdmitted(asPerson(id), w.instance, actions[name]); err == nil {
			t.Errorf("a Backlog worker is let through %s", name)
		}
	}
}

func TestAResidentWithoutAIChatIsRefusedTheChatToolsWithTheSameTextAsAStranger(t *testing.T) {
	w := residentGateWalk(t)
	reader, _ := w.resident(t, "Amina", "Support")
	w.giveRole(t, "Support", "Reader")
	noRole, _ := w.resident(t, "Zuri", "Ops")
	actions := aiToolActions(t)

	for name, id := range map[string]string{"role without ai.chat": reader, "group with no role": noRole, "stranger": "a-stranger"} {
		_, err := w.deps.aiAdmitted(asPerson(id), w.instance, actions["ai_list_chat_models"])
		if !errors.Is(err, agencies.ErrInstanceNotFound) {
			t.Errorf("%s lists the chat models: %v, want the instance-not-found refusal", name, err)
		}
	}
}

func TestTheOwnerStillListsTheMountsAndChatModels(t *testing.T) {
	w := residentGateWalk(t)
	actions := aiToolActions(t)
	ownerID := "test-owner"
	if _, err := w.deps.agencyMounts(asPerson(ownerID), w.deps.Registry, w.instance); err != nil {
		t.Fatalf("the owner lists the mounts: %v", err)
	}
	if _, err := w.deps.aiAdmitted(asPerson(ownerID), w.instance, actions["ai_list_accounts"]); err != nil {
		t.Fatalf("the owner lists the AI accounts: %v", err)
	}
}
