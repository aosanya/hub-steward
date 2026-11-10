package ai

import (
	"encoding/json"
	"errors"
	"reflect"
	"strings"
	"testing"

	"wakalaserver/modules/ai/models"
)

func TestAnOpenAIConversationWithNoMessagesCarriesThePromptAsOneUserMessage(t *testing.T) {
	got := openAIMessages(Request{Prompt: "hello"})
	want := []map[string]any{{"role": "user", "content": "hello"}}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("messages = %v, want %v", got, want)
	}
}

func TestAnAssistantMessageWithToolCallsCarriesThemAsFunctionCallsWithObjectArguments(t *testing.T) {
	got := openAIMessage(Message{Role: roleAssistant, ToolCalls: []ToolCall{{ID: "c1", Name: "look", Arguments: json.RawMessage(`{"q":"x"}`)}, {ID: "c2", Name: "bare"}}})
	if got["content"] != nil {
		t.Fatalf("content = %v, want nil when the assistant only called tools", got["content"])
	}
	calls := got["tool_calls"].([]map[string]any)
	if len(calls) != 2 {
		t.Fatalf("calls = %v", calls)
	}
	first := calls[0]["function"].(map[string]any)
	if first["name"] != "look" || first["arguments"] != `{"q":"x"}` {
		t.Fatalf("first call = %v", first)
	}
	if calls[1]["function"].(map[string]any)["arguments"] != "{}" {
		t.Fatalf("a call with no arguments must send {}, got %v", calls[1])
	}
}

func TestAnAssistantMessageWithTextAndToolCallsKeepsItsText(t *testing.T) {
	got := openAIMessage(Message{Role: roleAssistant, Content: "one moment", ToolCalls: []ToolCall{{ID: "c1", Name: "look"}}})
	if got["content"] != "one moment" {
		t.Fatalf("content = %v", got["content"])
	}
}

func TestAToolMessageAnswersTheCallItNames(t *testing.T) {
	got := openAIMessage(Message{Role: roleTool, ToolCallID: "c1", Content: "result"})
	want := map[string]any{"role": "tool", "tool_call_id": "c1", "content": "result"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("message = %v, want %v", got, want)
	}
}

func TestAnAnthropicConversationJoinsSystemMessagesAndFoldsToolResultsIntoOneUserTurn(t *testing.T) {
	system, messages := anthropicMessages(Request{Messages: []Message{
		{Role: roleSystem, Content: "be brief"},
		{Role: roleSystem, Content: "be kind"},
		{Role: roleUser, Content: "find it"},
		{Role: roleAssistant, Content: "looking", ToolCalls: []ToolCall{{ID: "a", Name: "look", Arguments: json.RawMessage(`{"q":1}`)}, {ID: "b", Name: "peek"}}},
		{Role: roleTool, ToolCallID: "a", Content: "found a"},
		{Role: roleTool, ToolCallID: "b", Content: "found b"},
	}})
	if system != "be brief\n\nbe kind" {
		t.Fatalf("system = %q", system)
	}
	if len(messages) != 3 {
		t.Fatalf("messages = %d, want user, assistant, one user turn of results: %v", len(messages), messages)
	}
	results := messages[2]["content"].([]map[string]any)
	if messages[2]["role"] != "user" || len(results) != 2 || results[1]["tool_use_id"] != "b" {
		t.Fatalf("results turn = %v", messages[2])
	}
	blocks := messages[1]["content"].([]map[string]any)
	if len(blocks) != 3 || blocks[0]["type"] != "text" || blocks[1]["type"] != "tool_use" || blocks[2]["id"] != "b" {
		t.Fatalf("assistant blocks = %v", blocks)
	}
}

func TestAnAnthropicToolResultAfterAPlainUserMessageStartsItsOwnTurn(t *testing.T) {
	_, messages := anthropicMessages(Request{Messages: []Message{
		{Role: roleUser, Content: "go"},
		{Role: roleTool, ToolCallID: "a", Content: "r"},
	}})
	if len(messages) != 2 {
		t.Fatalf("a plain user message is text, so the result needs its own turn: %v", messages)
	}
}

func TestAnAnthropicPromptWithNoMessagesHasNoSystemText(t *testing.T) {
	system, messages := anthropicMessages(Request{Prompt: "hi"})
	if system != "" || len(messages) != 1 || messages[0]["content"] != "hi" {
		t.Fatalf("system %q, messages %v", system, messages)
	}
}

func TestAnAssistantMessageWithBlankTextCarriesOnlyItsCalls(t *testing.T) {
	blocks := anthropicBlocks(Message{Role: roleAssistant, Content: "   ", ToolCalls: []ToolCall{{ID: "a", Name: "look"}}})
	if len(blocks) != 1 || blocks[0]["type"] != "tool_use" {
		t.Fatalf("blocks = %v", blocks)
	}
	if string(blocks[0]["input"].(json.RawMessage)) != "{}" {
		t.Fatalf("input = %s", blocks[0]["input"])
	}
}

func validChatInput() ChatInput {
	return ChatInput{Messages: []ChatMessage{{Role: roleUser, Content: "hi"}}}
}

func enabledChatAccount() Account {
	return Account{Status: models.StatusEnabled, Provider: models.ProviderAnthropic}
}

func TestAChatWithAnAccountThatIsOffOrCannotChatIsRefusedBeforeAnythingElse(t *testing.T) {
	off := enabledChatAccount()
	off.Status = "disabled"
	if err := checkChat(off, validChatInput()); !errors.Is(err, ErrAccountOff) {
		t.Fatalf("an account that is off: %v", err)
	}
	gemini := enabledChatAccount()
	gemini.Provider = models.ProviderGemini
	if err := checkChat(gemini, validChatInput()); !errors.Is(err, ErrChatUnsupported) {
		t.Fatalf("a provider without chat: %v", err)
	}
	if err := checkChat(enabledChatAccount(), validChatInput()); err != nil {
		t.Fatalf("a good chat: %v", err)
	}
}

func TestAChatNamingARoleNeedsAKindOfWorkThatExists(t *testing.T) {
	in := validChatInput()
	in.RoleID = "role-1"
	if err := checkChat(enabledChatAccount(), in); !errors.Is(err, ErrInvalidChat) || !strings.Contains(err.Error(), "no kind of work") {
		t.Fatalf("role without kind: %v", err)
	}
	in.Kind = "dreaming"
	if err := checkChat(enabledChatAccount(), in); !errors.Is(err, ErrInvalidChat) || !strings.Contains(err.Error(), kindSentence) {
		t.Fatalf("unknown kind: %v", err)
	}
	in.Kind = models.KindChat
	if err := checkChat(enabledChatAccount(), in); err != nil {
		t.Fatalf("known kind: %v", err)
	}
}

func chatWith(messages ...ChatMessage) ChatInput { return ChatInput{Messages: messages} }

func TestAChatThatBreaksARuleSaysWhichRuleAndWhichMessage(t *testing.T) {
	cases := map[string]struct {
		in   ChatInput
		says string
	}{
		"no messages":        {ChatInput{}, "messages are required"},
		"too many messages":  {ChatInput{Messages: make([]ChatMessage, maxChatMessages+1)}, "at most 200 messages"},
		"too many tools":     {ChatInput{Messages: validChatInput().Messages, Tools: make([]ChatTool, maxChatTools+1)}, "at most 128 tools"},
		"negative max":       {ChatInput{Messages: validChatInput().Messages, MaxTokens: -1}, "max_tokens cannot be negative"},
		"blank user":         {chatWith(ChatMessage{Role: roleUser, Content: " "}), "message 1: content is required"},
		"blank system":       {chatWith(ChatMessage{Role: roleSystem}), "message 1: content is required"},
		"empty assistant":    {chatWith(ChatMessage{Role: roleUser, Content: "a"}, ChatMessage{Role: roleAssistant}), "message 2: an assistant message needs content or tool_calls"},
		"tool without id":    {chatWith(ChatMessage{Role: roleTool, Content: "x"}), "message 1: a tool message needs its tool_call_id"},
		"unknown role":       {chatWith(ChatMessage{Role: "robot", Content: "x"}), "message 1: role must be system, user, assistant or tool"},
		"user with calls":    {chatWith(ChatMessage{Role: roleUser, Content: "x", ToolCalls: []ChatToolCall{{ID: "a", Name: "n"}}}), "message 1: only an assistant message carries tool_calls"},
		"call without id":    {chatWith(ChatMessage{Role: roleAssistant, ToolCalls: []ChatToolCall{{Name: "n"}}}), "each tool call needs an id and a name"},
		"call without name":  {chatWith(ChatMessage{Role: roleAssistant, ToolCalls: []ChatToolCall{{ID: "a"}}}), "each tool call needs an id and a name"},
		"array arguments":    {chatWith(ChatMessage{Role: roleAssistant, ToolCalls: []ChatToolCall{{ID: "a", Name: "n", Arguments: json.RawMessage(`[1]`)}}}), "tool call a arguments must be an object"},
		"tool with no name":  {ChatInput{Messages: validChatInput().Messages, Tools: []ChatTool{{}}}, "each tool needs a name"},
		"tool listed twice":  {ChatInput{Messages: validChatInput().Messages, Tools: []ChatTool{{Name: "a"}, {Name: "a"}}}, "tool a is listed twice"},
		"conversation large": {chatWith(ChatMessage{Role: roleUser, Content: strings.Repeat("x", maxChatBytes+1)}), "the conversation is too long"},
	}
	for name, c := range cases {
		err := validChat(c.in)
		if !errors.Is(err, ErrInvalidChat) || !strings.Contains(err.Error(), c.says) {
			t.Errorf("%s: err = %v, want it to say %q", name, err, c.says)
		}
	}
}

func TestAnAssistantMessageWithObjectOrNullArgumentsIsAccepted(t *testing.T) {
	for _, args := range []json.RawMessage{nil, json.RawMessage(`null`), json.RawMessage(`{"a":1}`)} {
		in := chatWith(ChatMessage{Role: roleAssistant, ToolCalls: []ChatToolCall{{ID: "a", Name: "n", Arguments: args}}})
		if err := validChat(in); err != nil {
			t.Errorf("arguments %s: %v", args, err)
		}
	}
}

func TestAChatRequestCarriesMessagesToolsAndAClampedTokenCount(t *testing.T) {
	in := ChatInput{
		Messages: []ChatMessage{
			{Role: roleUser, Content: "hi"},
			{Role: roleAssistant, ToolCalls: []ChatToolCall{{ID: "a", Name: "look", Arguments: json.RawMessage(`not json`)}}},
		},
		Tools:     []ChatTool{{Name: "look", Description: "d"}},
		MaxTokens: 99999,
	}
	got := chatRequest(in, 500)
	if got.MaxTokens != 500 {
		t.Fatalf("max tokens = %d, want the limit 500", got.MaxTokens)
	}
	if string(got.Messages[1].ToolCalls[0].Arguments) != "{}" {
		t.Fatalf("unreadable arguments must become {}, got %s", got.Messages[1].ToolCalls[0].Arguments)
	}
	schema := got.Tools[0].Parameters
	if schema["type"] != "object" {
		t.Fatalf("a tool with no parameters needs an empty object schema, got %v", schema)
	}
}

func TestChatMaxTokensUsesTheDefaultTheCeilingAndTheLimit(t *testing.T) {
	cases := []struct{ asked, limit, want int }{
		{0, 0, defaultChatTokens},
		{-5, 0, defaultChatTokens},
		{2000, 0, 2000},
		{maxChatTokens + 1, 0, maxChatTokens},
		{2000, 300, 300},
		{100, 300, 100},
	}
	for _, c := range cases {
		if got := chatMaxTokens(c.asked, c.limit); got != c.want {
			t.Errorf("chatMaxTokens(%d, %d) = %d, want %d", c.asked, c.limit, got, c.want)
		}
	}
}

func TestAChatReplyNumbersCallsThatCameWithoutAnID(t *testing.T) {
	got := chatReply(Reply{Text: "ok", ToolCalls: []ToolCall{{Name: "a", Arguments: json.RawMessage(`[]`)}, {ID: "x", Name: "b", Arguments: json.RawMessage(`{"k":1}`)}}, InputTokens: 3, OutputTokens: 4, FinishReason: "tool_use"})
	calls := got.Message.ToolCalls
	if calls[0].ID != "call-1" || string(calls[0].Arguments) != "{}" || calls[1].ID != "x" {
		t.Fatalf("calls = %+v", calls)
	}
	if got.InputTokens != 3 || got.OutputTokens != 4 || got.FinishReason != "tool_use" || got.Message.Role != roleAssistant {
		t.Fatalf("reply = %+v", got)
	}
}
