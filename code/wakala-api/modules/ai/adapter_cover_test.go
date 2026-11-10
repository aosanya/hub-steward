package ai

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"wakalaserver/modules/ai/models"
)

func bodyOf(t *testing.T, req *http.Request) map[string]any {
	t.Helper()
	raw, err := io.ReadAll(req.Body)
	if err != nil {
		t.Fatal(err)
	}
	var out map[string]any
	if err := json.Unmarshal(raw, &out); err != nil {
		t.Fatalf("body %s: %v", raw, err)
	}
	return out
}

func TestAnOpenAIRequestGoesToChatCompletionsWithABearerKeyAndFunctionTools(t *testing.T) {
	a := Account{BaseURL: "https://models.example/v1/", ModelName: "m1"}
	req, err := openAIAdapter{}.BuildRequest(context.Background(), a, "sekret", Request{Prompt: "hi", MaxTokens: 50, Tools: []Tool{{Name: "look", Description: "d", Parameters: map[string]any{"type": "object"}}}})
	if err != nil {
		t.Fatal(err)
	}
	if req.URL.String() != "https://models.example/v1/chat/completions" || req.Header.Get("Authorization") != "Bearer sekret" {
		t.Fatalf("url %s, auth header set %v", req.URL, req.Header.Get("Authorization") != "")
	}
	body := bodyOf(t, req)
	tools := body["tools"].([]any)
	if body["model"] != "m1" || body["max_tokens"].(float64) != 50 || tools[0].(map[string]any)["type"] != "function" {
		t.Fatalf("body = %v", body)
	}
}

func TestAnAnthropicRequestCarriesTheKeyInItsOwnHeaderAndSchemasWithAType(t *testing.T) {
	a := Account{BaseURL: "https://claude.example", ModelName: "c1"}
	req, err := anthropicAdapter{}.BuildRequest(context.Background(), a, "sekret", Request{
		Messages:  []Message{{Role: roleSystem, Content: "be brief"}, {Role: roleUser, Content: "hi"}},
		MaxTokens: 10,
		Tools:     []Tool{{Name: "look", Parameters: map[string]any{"properties": map[string]any{"q": map[string]any{"type": "string"}}}}},
	})
	if err != nil {
		t.Fatal(err)
	}
	if req.URL.Path != "/v1/messages" || req.Header.Get("x-api-key") != "sekret" || req.Header.Get("anthropic-version") != anthropicVersion {
		t.Fatalf("url %s, headers %v", req.URL, req.Header)
	}
	body := bodyOf(t, req)
	schema := body["tools"].([]any)[0].(map[string]any)["input_schema"].(map[string]any)
	if body["system"] != "be brief" || schema["type"] != "object" || schema["properties"] == nil {
		t.Fatalf("body = %v", body)
	}
}

func TestAToolSchemaThatAlreadyHasATypeIsSentAsItIs(t *testing.T) {
	given := map[string]any{"type": "object", "required": []string{"q"}}
	got := objectSchema(given)
	if got["type"] != "object" || got["required"] == nil || len(got) != 2 {
		t.Fatalf("schema = %v", got)
	}
}

func TestAGeminiRequestTakesOnlyAPromptAndNamesTheModelInThePath(t *testing.T) {
	a := Account{BaseURL: "https://gem.example", ModelName: "gem 1"}
	req, err := geminiAdapter{}.BuildRequest(context.Background(), a, "sekret", Request{Prompt: "hi", MaxTokens: 5, Tools: []Tool{{Name: "look"}}})
	if err != nil {
		t.Fatal(err)
	}
	if req.URL.EscapedPath() != "/v1beta/models/"+url.PathEscape("gem 1")+":generateContent" || req.Header.Get("x-goog-api-key") != "sekret" {
		t.Fatalf("url %s", req.URL)
	}
	if bodyOf(t, req)["tools"] == nil {
		t.Fatal("the tool declarations were dropped")
	}
	if _, err := (geminiAdapter{}).BuildRequest(context.Background(), a, "k", Request{Messages: []Message{{Role: roleUser, Content: "x"}}}); !errors.Is(err, errNoHistory) {
		t.Fatalf("a conversation to a provider without history = %v", err)
	}
}

func TestAnOpenAIAnswerGivesTextToolCallsAndTokenCounts(t *testing.T) {
	got, err := openAIAdapter{}.ParseReply([]byte(`{"choices":[{"finish_reason":"tool_calls","message":{"content":"ok","tool_calls":[{"id":"c1","function":{"name":"look","arguments":"{\"q\":1}"}}]}}],"usage":{"prompt_tokens":7,"completion_tokens":9}}`))
	if err != nil {
		t.Fatal(err)
	}
	if got.Text != "ok" || got.InputTokens != 7 || got.OutputTokens != 9 || got.FinishReason != "tool_calls" || got.ToolCalls[0].Name != "look" || string(got.ToolCalls[0].Arguments) != `{"q":1}` {
		t.Fatalf("reply = %+v", got)
	}
	if _, err := (openAIAdapter{}).ParseReply([]byte(`{"choices":[]}`)); err == nil {
		t.Fatal("an answer with no choices must be an error")
	}
	if _, err := (openAIAdapter{}).ParseReply([]byte(`nope`)); err == nil {
		t.Fatal("an answer that is not JSON must be an error")
	}
}

func TestAnAnthropicAnswerJoinsTextBlocksAndKeepsToolUse(t *testing.T) {
	got, err := anthropicAdapter{}.ParseReply([]byte(`{"stop_reason":"tool_use","content":[{"type":"text","text":"a"},{"type":"text","text":"b"},{"type":"tool_use","id":"u1","name":"look","input":{"q":2}},{"type":"thinking"}],"usage":{"input_tokens":3,"output_tokens":4}}`))
	if err != nil {
		t.Fatal(err)
	}
	if got.Text != "ab" || got.FinishReason != "tool_use" || got.InputTokens != 3 || got.OutputTokens != 4 || len(got.ToolCalls) != 1 || got.ToolCalls[0].ID != "u1" {
		t.Fatalf("reply = %+v", got)
	}
	if _, err := (anthropicAdapter{}).ParseReply([]byte(`{`)); err == nil {
		t.Fatal("a broken answer must be an error")
	}
}

func TestAGeminiAnswerGivesTextAndFunctionCalls(t *testing.T) {
	got, err := geminiAdapter{}.ParseReply([]byte(`{"candidates":[{"finishReason":"STOP","content":{"parts":[{"text":"hi "},{"functionCall":{"name":"look","args":{"q":3}}},{"text":"there"}]}}],"usageMetadata":{"promptTokenCount":2,"candidatesTokenCount":5}}`))
	if err != nil {
		t.Fatal(err)
	}
	if got.Text != "hi there" || got.InputTokens != 2 || got.OutputTokens != 5 || got.ToolCalls[0].Name != "look" {
		t.Fatalf("reply = %+v", got)
	}
	if _, err := (geminiAdapter{}).ParseReply([]byte(`{"candidates":[]}`)); err == nil {
		t.Fatal("an answer with no candidates must be an error")
	}
}

func TestCallingAProviderThatHasNoAdapterIsAnError(t *testing.T) {
	_, outcome := Call(context.Background(), http.DefaultClient, Account{Provider: "nobody"}, "k", Request{Prompt: "x"})
	if outcome != ProbeError {
		t.Fatalf("outcome = %v, want ProbeError", outcome)
	}
}

func TestCallTurnsEachStatusTheProviderAnswersWithIntoAnOutcome(t *testing.T) {
	cases := map[int]ProbeOutcome{
		http.StatusOK:              ProbeOK,
		http.StatusUnauthorized:    ProbeRefused,
		http.StatusForbidden:       ProbeForbidden,
		http.StatusTooManyRequests: ProbeRateLimited,
		http.StatusBadRequest:      ProbeError,
		http.StatusBadGateway:      ProbeError,
	}
	for status, want := range cases {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(status)
			_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"ok"}}]}`))
		}))
		a := Account{Provider: models.ProviderOpenAICompatible, BaseURL: server.URL, ModelName: "m"}
		reply, outcome := Call(context.Background(), server.Client(), a, "k", Request{Prompt: "x"})
		server.Close()
		if outcome != want {
			t.Errorf("status %d: outcome %v, want %v", status, outcome, want)
		}
		if want == ProbeOK && reply.Text != "ok" {
			t.Errorf("status %d: reply %q", status, reply.Text)
		}
	}
}

func TestCallWithAnAnswerItCannotReadIsAnErrorAndAnUnreachableHostIsUnreached(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { _, _ = w.Write([]byte(`{"choices":[]}`)) }))
	a := Account{Provider: models.ProviderOpenAICompatible, BaseURL: server.URL, ModelName: "m"}
	if _, outcome := Call(context.Background(), server.Client(), a, "k", Request{Prompt: "x"}); outcome != ProbeError {
		t.Fatalf("an answer with no choices: %v", outcome)
	}
	server.Close()
	if _, outcome := Call(context.Background(), http.DefaultClient, a, "k", Request{Prompt: "x"}); outcome != ProbeUnreached {
		t.Fatalf("a closed host: %v", outcome)
	}
	gemini := Account{Provider: models.ProviderGemini, BaseURL: "http://x.invalid", ModelName: "m"}
	if _, outcome := Call(context.Background(), http.DefaultClient, gemini, "k", Request{Messages: []Message{{Role: roleUser, Content: "x"}}}); outcome != ProbeUnreached {
		t.Fatalf("a request that cannot be built: %v", outcome)
	}
}

func TestAKeyedRequestNeverFollowsARedirectToAnotherHost(t *testing.T) {
	var reached bool
	other := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { reached = true }))
	defer other.Close()
	first := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, other.URL+"/steal", http.StatusTemporaryRedirect)
	}))
	defer first.Close()
	a := Account{Provider: models.ProviderAnthropic, BaseURL: first.URL, ModelName: "m"}
	_, outcome := Call(context.Background(), first.Client(), a, "k", Request{Prompt: "x"})
	if outcome != ProbeRedirected || reached {
		t.Fatalf("outcome %v, other host reached %v: a key must not leave the host it was given for", outcome, reached)
	}
}

func TestARedirectOnTheSameHostIsFollowedUntilTenHops(t *testing.T) {
	first, _ := http.NewRequest(http.MethodPost, "http://h.example/a", strings.NewReader(""))
	same, _ := http.NewRequest(http.MethodPost, "http://h.example/b", strings.NewReader(""))
	if err := stayOnTheHost(same, []*http.Request{first}); err != nil {
		t.Fatalf("same host: %v", err)
	}
	via := make([]*http.Request, maxRedirects)
	for i := range via {
		via[i] = first
	}
	if err := stayOnTheHost(same, via); err == nil {
		t.Fatal("ten hops must stop")
	}
	other, _ := http.NewRequest(http.MethodPost, "https://h.example/b", strings.NewReader(""))
	if err := stayOnTheHost(other, []*http.Request{first}); !errors.Is(err, http.ErrUseLastResponse) {
		t.Fatalf("another scheme = %v, want the last response", err)
	}
}

func TestOnlyProvidersWithAnAdapterAreKnown(t *testing.T) {
	if !HasAdapter(models.ProviderAnthropic) || HasAdapter("nobody") {
		t.Fatal("HasAdapter disagrees with the adapter table")
	}
}
