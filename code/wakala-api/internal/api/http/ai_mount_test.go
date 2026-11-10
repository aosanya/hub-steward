package http

import (
	"context"
	"testing"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

func TestTheChatShareIsCountedForAPersonAndNeverForAnAIAgent(t *testing.T) {
	ctx := accounts.WithID(context.Background(), "acct-1")
	cases := []struct {
		name   string
		role   string
		action string
		want   string
	}{
		{"a person chatting", "member", aiChatAction, "acct-1"},
		{"the owner chatting", agencies.RoleOwner, aiChatAction, "acct-1"},
		{"an AI agent chatting", agencies.RoleAgent, aiChatAction, ""},
		{"an AI agent doing something else", agencies.RoleAgent, "ai.chat_model.pick", "acct-1"},
	}
	for _, c := range cases {
		if got := aiMountFor(c.role, c.action).Caller(ctx); got != c.want {
			t.Errorf("%s: share counted for %q, want %q", c.name, got, c.want)
		}
	}
}
