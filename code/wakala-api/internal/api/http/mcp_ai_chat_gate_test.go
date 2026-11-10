package http

import (
	"context"
	"slices"
	"testing"

	agencymodels "wakalaserver/modules/agency/models"
	ai "wakalaserver/modules/ai"
)

func withAITools(d *Deps) {
	d.AI = func(context.Context, string) (ai.Manager, error) { return nil, nil }
}

func TestACallerWithOnlyAIChatMayChatAndPickAModelButNotSpendOrListAccounts(t *testing.T) {
	chat, ok := agencymodels.LookupPermission("ai.chat")
	if !ok {
		t.Fatal("no ai.chat permission in the catalog")
	}
	w := newGroupRoleWalk(t)
	withAITools(w.deps)
	m := newMCPServers(w.deps)
	hidden := m.hiddenTools(chat.Actions, nil)
	for _, tool := range []string{"ai_chat_account", "ai_list_chat_models", "ai_pick_chat_model"} {
		if slices.Contains(hidden, tool) {
			t.Errorf("a caller holding only ai.chat does not see %s", tool)
		}
	}
	for _, tool := range []string{"ai_record_usage", "ai_list_accounts", "ai_check_limits", "ai_list_usage", "ai_list_models", "ai_update_account", "ai_set_account_key"} {
		if !slices.Contains(hidden, tool) {
			t.Errorf("a caller holding only ai.chat sees %s", tool)
		}
	}
}

func TestAIUseStillOpensTheUsageRecordingTool(t *testing.T) {
	use, ok := agencymodels.LookupPermission("ai.use")
	if !ok {
		t.Fatal("no ai.use permission in the catalog")
	}
	w := newGroupRoleWalk(t)
	withAITools(w.deps)
	m := newMCPServers(w.deps)
	if hidden := m.hiddenTools(use.Actions, nil); slices.Contains(hidden, "ai_record_usage") {
		t.Fatal("a caller holding ai.use does not see ai_record_usage: the test above proves nothing")
	}
}
