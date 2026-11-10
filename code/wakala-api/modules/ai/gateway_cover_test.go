package ai

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"wakalaserver/modules/ai/models"
)

func TestTheGatewayClampsAnAskToTheLimitAndAddsOneWhenTheClientAskedForNone(t *testing.T) {
	cases := []struct {
		name    string
		payload map[string]any
		limit   int
		want    map[string]any
	}{
		{"no limit leaves the ask alone", map[string]any{"max_tokens": float64(5000)}, 0, map[string]any{"max_tokens": float64(5000)}},
		{"a bigger ask is cut", map[string]any{"max_tokens": float64(5000)}, 100, map[string]any{"max_tokens": 100}},
		{"a smaller ask stays", map[string]any{"max_tokens": float64(50)}, 100, map[string]any{"max_tokens": float64(50)}},
		{"no ask gets the limit", map[string]any{}, 100, map[string]any{"max_tokens": 100}},
		{"the completion key is cut too", map[string]any{"max_completion_tokens": float64(900)}, 100, map[string]any{"max_completion_tokens": 100}},
		{"a useless ask is dropped for the limit", map[string]any{"max_tokens": float64(-4), "max_completion_tokens": "lots"}, 100, map[string]any{"max_tokens": 100}},
	}
	for _, c := range cases {
		clampMaxTokens(c.payload, c.limit)
		if len(c.payload) != len(c.want) {
			t.Errorf("%s: payload = %v, want %v", c.name, c.payload, c.want)
			continue
		}
		for k, v := range c.want {
			if c.payload[k] != v {
				t.Errorf("%s: %s = %v, want %v", c.name, k, c.payload[k], v)
			}
		}
	}
}

func TestTheGatewayReadsTokenUseFromAnAnswerAndTreatsAnUnreadableOneAsNone(t *testing.T) {
	in, out := answerUsage([]byte(`{"usage":{"prompt_tokens":11,"completion_tokens":22}}`))
	if in != 11 || out != 22 {
		t.Fatalf("usage = %d, %d", in, out)
	}
	if in, out := answerUsage([]byte(`not json`)); in != 0 || out != 0 {
		t.Fatalf("an unreadable answer counts %d, %d", in, out)
	}
}

func TestAClaudeAnswerIsHandedBackInTheOpenAIShapeWithItsFinishReason(t *testing.T) {
	cases := map[string]string{"tool_use": "tool_calls", "max_tokens": "length", "refusal": "content_filter", "end_turn": "stop", "": "stop"}
	for claude, want := range cases {
		if got := openAIFinish(claude); got != want {
			t.Errorf("openAIFinish(%q) = %q, want %q", claude, got, want)
		}
	}
	answer := openAIAnswer("m1", Reply{ToolCalls: []ToolCall{{Name: "look", Arguments: json.RawMessage(`[1]`)}, {ID: "u1", Name: "peek", Arguments: json.RawMessage(`{"q":1}`)}}, InputTokens: 4, OutputTokens: 6, FinishReason: "tool_use"})
	choice := answer["choices"].([]map[string]any)[0]
	message := choice["message"].(map[string]any)
	calls := message["tool_calls"].([]map[string]any)
	if message["content"] != nil || calls[0]["id"] != "call-1" || calls[1]["id"] != "u1" || choice["finish_reason"] != "tool_calls" {
		t.Fatalf("answer = %v", answer)
	}
	if calls[0]["function"].(map[string]any)["arguments"] != "{}" {
		t.Fatalf("a call whose arguments are not an object must send {}, got %v", calls[0])
	}
	usage := answer["usage"].(map[string]int)
	if usage["total_tokens"] != 10 || answer["model"] != "m1" || !strings.HasPrefix(answer["id"].(string), "chatcmpl-") {
		t.Fatalf("answer = %v", answer)
	}
	plain := openAIAnswer("m1", Reply{Text: "hi"})["choices"].([]map[string]any)[0]["message"].(map[string]any)
	if plain["content"] != "hi" || plain["tool_calls"] != nil {
		t.Fatalf("plain message = %v", plain)
	}
}

func TestAnOpenAIBodyIsCarriedToClaudeWithItsSystemTextToolsAndTheSmallerTokenAsk(t *testing.T) {
	payload := map[string]any{
		"messages": []any{
			map[string]any{"role": "developer", "content": "be brief"},
			map[string]any{"role": "user", "content": []any{map[string]any{"type": "text", "text": "part one"}, map[string]any{"type": "text", "text": "part two"}}},
			map[string]any{"role": "assistant", "content": nil, "tool_calls": []any{map[string]any{"id": "c1", "function": map[string]any{"name": "look", "arguments": ` {"q":1} `}}}},
			map[string]any{"role": "tool", "tool_call_id": "c1", "content": "found"},
			map[string]any{"role": "function", "name": "old", "content": "legacy"},
			map[string]any{"role": "user", "content": "   "},
		},
		"tools":                 []any{map[string]any{"type": "function", "function": map[string]any{"name": "look", "description": "d"}}},
		"max_tokens":            float64(800),
		"max_completion_tokens": float64(300),
	}
	got, err := claudeRequest(payload, 0)
	if err != nil {
		t.Fatal(err)
	}
	if got.MaxTokens != 300 {
		t.Fatalf("max tokens = %d, want the smaller ask 300", got.MaxTokens)
	}
	if len(got.Messages) != 5 || got.Messages[0].Role != roleSystem || got.Messages[1].Content != "part one\npart two" {
		t.Fatalf("messages = %+v", got.Messages)
	}
	if string(got.Messages[2].ToolCalls[0].Arguments) != `{"q":1}` || got.Messages[4].Role != roleUser || got.Messages[4].Content != "old: legacy" {
		t.Fatalf("calls and function result = %+v", got.Messages)
	}
	if got.Tools[0].Parameters["type"] != "object" {
		t.Fatalf("a tool with no parameters must get an object schema: %v", got.Tools[0].Parameters)
	}
}

func TestAnOpenAIBodyClaudeCannotTakeIsRefusedWithTheReason(t *testing.T) {
	message := func(m map[string]any) map[string]any { return map[string]any{"messages": []any{m}} }
	cases := map[string]struct {
		payload map[string]any
		err     error
	}{
		"not a chat body":      {map[string]any{"messages": "text"}, errNotChatCompletions},
		"no messages":          {map[string]any{}, errNoMessages},
		"only a system prompt": {message(map[string]any{"role": "system", "content": "x"}), errOnlySystem},
		"an image":             {message(map[string]any{"role": "user", "content": []any{map[string]any{"type": "image_url"}}}), nil},
		"a number as content":  {message(map[string]any{"role": "user", "content": 4}), errUncarriable},
		"tool without id":      {message(map[string]any{"role": "tool", "content": "x"}), errToolMessageNoID},
		"call without id":      {message(map[string]any{"role": "assistant", "tool_calls": []any{map[string]any{"function": map[string]any{"name": "n"}}}}), errCallNoID},
		"call without name":    {message(map[string]any{"role": "assistant", "tool_calls": []any{map[string]any{"id": "a", "function": map[string]any{}}}}), errCallNoName},
		"call with array args": {message(map[string]any{"role": "assistant", "tool_calls": []any{map[string]any{"id": "a", "function": map[string]any{"name": "n", "arguments": "[1]"}}}}), errBadArguments},
		"a non-function tool":  {map[string]any{"messages": []any{map[string]any{"role": "user", "content": "x"}}, "tools": []any{map[string]any{"type": "retrieval"}}}, errNotFunction},
		"a tool with no name":  {map[string]any{"messages": []any{map[string]any{"role": "user", "content": "x"}}, "tools": []any{map[string]any{"type": "function", "function": map[string]any{}}}}, errToolNoName},
	}
	for name, c := range cases {
		_, err := claudeRequest(c.payload, 0)
		if err == nil || (c.err != nil && !errors.Is(err, c.err)) {
			t.Errorf("%s: err = %v, want %v", name, err, c.err)
		}
	}
}

func TestACallNamedInAnErrorSaysWhichCallItWas(t *testing.T) {
	_, err := claudeRequest(map[string]any{"messages": []any{map[string]any{"role": "assistant", "tool_calls": []any{map[string]any{"id": "c9", "function": map[string]any{"name": "look", "arguments": "[]"}}}}}}, 0)
	if err == nil || !strings.Contains(err.Error(), `"look"`) || !strings.Contains(err.Error(), "c9") {
		t.Fatalf("err = %v, want the call's name and id", err)
	}
}

func TestSmallerAskPrefersTheOnlyPositiveNumberThenTheLower(t *testing.T) {
	cases := [][3]int{{0, 0, 0}, {0, 5, 5}, {5, 0, 5}, {-1, 7, 7}, {9, 4, 4}, {4, 9, 4}}
	for _, c := range cases {
		if got := smallerAsk(c[0], c[1]); got != c[2] {
			t.Errorf("smallerAsk(%d, %d) = %d, want %d", c[0], c[1], got, c[2])
		}
	}
}

type gatewayRig struct {
	hub      *limitsHub
	upstream *httptest.Server
	seen     chan map[string]any
	reply    func(w http.ResponseWriter, r *http.Request)
	handler  http.Handler
}

const rigSeat = "seat-triage"

func newGatewayRig(t *testing.T, provider string) *gatewayRig {
	t.Helper()
	hub := newLimitsHub(t)
	rig := &gatewayRig{hub: hub, seen: make(chan map[string]any, 4)}
	rig.upstream = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, _ := io.ReadAll(r.Body)
		var body map[string]any
		_ = json.Unmarshal(raw, &body)
		rig.seen <- body
		rig.reply(w, r)
	}))
	t.Cleanup(rig.upstream.Close)
	ctx := context.Background()
	account, err := hub.m.CreateAccount(ctx, limitsAgency, Account{Name: "gw-" + provider, Provider: provider, BaseURL: rig.upstream.URL, ModelName: "model-x", Status: models.StatusEnabled})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := hub.m.SetAccountKey(ctx, limitsAgency, account.ID, KeyInput{Key: "gateway-test-key"}); err != nil {
		t.Fatal(err)
	}
	limit := 40
	role, err := hub.m.CreateAIRole(ctx, limitsAgency, models.AIRoleInput{Name: "gw-" + provider, Status: "enabled", TokensPerCall: &limit})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := hub.m.SetAIRoleMapping(ctx, limitsAgency, role.ID, AIRoleMappingInput{AccountID: account.ID, AgencyRoleID: rigSeat}); err != nil {
		t.Fatal(err)
	}
	rig.handler = NewGateway(hub.m, func(r *http.Request) (string, string, bool) {
		if r.Header.Get("X-Caller") == "" {
			return "", "", false
		}
		return limitsAgency, r.Header.Get("X-Caller"), true
	}, rig.upstream.Client())
	return rig
}

func (g *gatewayRig) post(seat, kind, person, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", strings.NewReader(body))
	req.Header.Set("X-Caller", seat)
	req.Header.Set(usageKindHeader, kind)
	req.Header.Set(usagePersonHeader, person)
	rec := httptest.NewRecorder()
	g.handler.ServeHTTP(rec, req)
	return rec
}

func refusalOf(t *testing.T, rec *httptest.ResponseRecorder) string {
	t.Helper()
	var out struct {
		Error struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatalf("body %s: %v", rec.Body.String(), err)
	}
	return out.Error.Message
}

const userAsks = `{"messages":[{"role":"user","content":"hello"}]}`

func TestTheGatewayRefusesWhatItCannotServeBeforeTouchingAnyModel(t *testing.T) {
	rig := newGatewayRig(t, models.ProviderOpenAICompatible)
	get := httptest.NewRecorder()
	rig.handler.ServeHTTP(get, httptest.NewRequest(http.MethodGet, "/", nil))
	if get.Code != http.StatusMethodNotAllowed {
		t.Errorf("GET = %d", get.Code)
	}
	cases := []struct {
		name           string
		seat, kind, in string
		status         int
		says           string
	}{
		{"unknown caller", "", "chat", userAsks, http.StatusUnauthorized, "the caller is not known"},
		{"broken body", rigSeat, "chat", "{", http.StatusBadRequest, "not valid JSON"},
		{"streaming", rigSeat, "chat", `{"stream":true}`, http.StatusBadRequest, "streaming is not supported"},
		{"no kind", rigSeat, "", userAsks, http.StatusBadRequest, "no kind of work"},
		{"a made-up kind", rigSeat, "dreaming", userAsks, http.StatusBadRequest, "not one of"},
		{"a seat with no AI role", "seat-other", "chat", userAsks, http.StatusNotFound, "no AI role speaks for this seat"},
	}
	for _, c := range cases {
		rec := rig.post(c.seat, c.kind, "ana", c.in)
		if rec.Code != c.status || !strings.Contains(refusalOf(t, rec), c.says) {
			t.Errorf("%s: %d %s, want %d containing %q", c.name, rec.Code, rec.Body.String(), c.status, c.says)
		}
	}
	if len(rig.seen) != 0 {
		t.Fatal("a model was called for a request that was refused")
	}
}

func TestAnOpenAICompatibleCallIsRelayedWithTheModelNameTheClampedAskAndItsUseCounted(t *testing.T) {
	rig := newGatewayRig(t, models.ProviderOpenAICompatible)
	rig.reply = func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer gateway-test-key" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		_, _ = w.Write([]byte(`{"choices":[{"message":{"role":"assistant","content":"hi"}}],"usage":{"prompt_tokens":5,"completion_tokens":6}}`))
	}
	rec := rig.post(rigSeat, "chat", "ana", `{"model":"liar","max_tokens":9999,"messages":[{"role":"user","content":"hello"}]}`)
	if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"content":"hi"`) {
		t.Fatalf("answer = %d %s", rec.Code, rec.Body.String())
	}
	sent := <-rig.seen
	if sent["model"] != "model-x" || sent["max_tokens"].(float64) != 40 {
		t.Fatalf("the model name and the cap are the hub's, not the client's: %v", sent)
	}
	usage, err := rig.hub.m.MyAssistantUsage(context.Background(), limitsAgency, "ana")
	if err != nil || usage.DayTokens != 11 {
		t.Fatalf("usage = %+v, %v; want the 5 + 6 tokens counted for ana", usage, err)
	}
}

func TestAClaudeCallIsAnsweredInTheOpenAIShapeAndItsUseIsCounted(t *testing.T) {
	rig := newGatewayRig(t, models.ProviderAnthropic)
	rig.reply = func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("x-api-key") != "gateway-test-key" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		_, _ = w.Write([]byte(`{"stop_reason":"tool_use","content":[{"type":"text","text":"checking"},{"type":"tool_use","id":"u1","name":"look","input":{"q":1}}],"usage":{"input_tokens":8,"output_tokens":9}}`))
	}
	rec := rig.post(rigSeat, "chat", "ben", `{"messages":[{"role":"system","content":"be brief"},{"role":"user","content":"hello"}],"max_tokens":9999}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("answer = %d %s", rec.Code, rec.Body.String())
	}
	var answer struct {
		Choices []struct {
			FinishReason string `json:"finish_reason"`
			Message      struct {
				Content   string `json:"content"`
				ToolCalls []struct {
					ID string `json:"id"`
				} `json:"tool_calls"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &answer); err != nil {
		t.Fatal(err)
	}
	choice := answer.Choices[0]
	if choice.FinishReason != "tool_calls" || choice.Message.Content != "checking" || choice.Message.ToolCalls[0].ID != "u1" {
		t.Fatalf("answer = %s", rec.Body.String())
	}
	sent := <-rig.seen
	if sent["system"] != "be brief" || sent["max_tokens"].(float64) != 40 {
		t.Fatalf("sent = %v", sent)
	}
	if usage, err := rig.hub.m.MyAssistantUsage(context.Background(), limitsAgency, "ben"); err != nil || usage.DayTokens != 17 {
		t.Fatalf("usage = %+v, %v", usage, err)
	}
}

func TestAClaudeCallThatCannotBeCarriedIsRefusedBeforeTheModelIsCalled(t *testing.T) {
	rig := newGatewayRig(t, models.ProviderAnthropic)
	rec := rig.post(rigSeat, "chat", "ben", `{"messages":[{"role":"system","content":"only me"}]}`)
	if rec.Code != http.StatusBadRequest || !strings.Contains(refusalOf(t, rec), errOnlySystem.Error()) {
		t.Fatalf("answer = %d %s", rec.Code, rec.Body.String())
	}
	if len(rig.seen) != 0 {
		t.Fatal("the model was called")
	}
}

func TestWhenTheModelFailsTheGatewayAnswersWithTheMatchingStatusAndSentence(t *testing.T) {
	cases := []struct {
		provider string
		status   int
		want     int
		says     string
	}{
		{models.ProviderOpenAICompatible, http.StatusInternalServerError, http.StatusBadGateway, modelErrored},
		{models.ProviderAnthropic, http.StatusUnauthorized, http.StatusBadGateway, TestRefused},
		{models.ProviderAnthropic, http.StatusForbidden, http.StatusBadGateway, TestForbidden},
		{models.ProviderAnthropic, http.StatusTooManyRequests, http.StatusTooManyRequests, TestRateLimited},
		{models.ProviderAnthropic, http.StatusInternalServerError, http.StatusBadGateway, modelErrored},
		{models.ProviderAnthropic, http.StatusFound, http.StatusBadGateway, TestRedirected},
	}
	for _, c := range cases {
		rig := newGatewayRig(t, c.provider)
		status := c.status
		rig.reply = func(w http.ResponseWriter, r *http.Request) {
			if status == http.StatusFound {
				http.Redirect(w, r, "http://elsewhere.invalid/x", status)
				return
			}
			w.WriteHeader(status)
		}
		rec := rig.post(rigSeat, "chat", "ana", userAsks)
		if rec.Code != c.want || refusalOf(t, rec) != c.says {
			t.Errorf("%s %d: %d %q, want %d %q", c.provider, c.status, rec.Code, refusalOf(t, rec), c.want, c.says)
		}
		if usage, _ := rig.hub.m.MyAssistantUsage(context.Background(), limitsAgency, "ana"); usage.DayTokens != 0 {
			t.Errorf("%s %d: a failed call counted %d tokens", c.provider, c.status, usage.DayTokens)
		}
	}
}

func TestAGatewayCallToAModelThatIsDownIsBadGateway(t *testing.T) {
	rig := newGatewayRig(t, models.ProviderOpenAICompatible)
	rig.upstream.Close()
	rec := rig.post(rigSeat, "chat", "ana", userAsks)
	if rec.Code != http.StatusBadGateway || refusalOf(t, rec) != modelUnreached {
		t.Fatalf("answer = %d %s", rec.Code, rec.Body.String())
	}
}

func TestAGatewayCallIsRefusedWhenTheRoleHasNoAccountItsDayIsUsedOrTheAccountIsOff(t *testing.T) {
	rig := newGatewayRig(t, models.ProviderOpenAICompatible)
	rig.reply = func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"usage":{"prompt_tokens":1,"completion_tokens":1}}`))
	}
	ctx := context.Background()
	bare, err := rig.hub.m.CreateAIRole(ctx, limitsAgency, models.AIRoleInput{Name: "bare", Status: "enabled"})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := rig.hub.m.SetAIRoleMapping(ctx, limitsAgency, bare.ID, AIRoleMappingInput{AgencyRoleID: "seat-bare"}); err != nil {
		t.Fatal(err)
	}
	if rec := rig.post("seat-bare", "chat", "ana", userAsks); rec.Code != http.StatusConflict || refusalOf(t, rec) != noAccountMapped {
		t.Errorf("a role with no account: %d %s", rec.Code, rec.Body.String())
	}
	mapped, err := rig.hub.m.ResolveAgencyRole(ctx, limitsAgency, rigSeat)
	if err != nil {
		t.Fatal(err)
	}
	one := 1
	limited, err := rig.hub.m.CreateAIRole(ctx, limitsAgency, models.AIRoleInput{Name: "limited", Status: "enabled", RequestsPerDay: &one})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := rig.hub.m.SetAIRoleMapping(ctx, limitsAgency, limited.ID, AIRoleMappingInput{AccountID: mapped.Account.ID, AgencyRoleID: "seat-limited"}); err != nil {
		t.Fatal(err)
	}
	if rec := rig.post("seat-limited", "chat", "ana", userAsks); rec.Code != http.StatusOK {
		t.Fatalf("the first request of the day: %d %s", rec.Code, rec.Body.String())
	}
	if rec := rig.post("seat-limited", "chat", "ana", userAsks); rec.Code != http.StatusTooManyRequests || refusalOf(t, rec) == "" {
		t.Errorf("a second request past one a day: %d %s", rec.Code, rec.Body.String())
	}
	<-rig.seen
	off := *mapped.Account
	off.Status = models.StatusDisabled
	if _, err := rig.hub.m.UpdateAccount(ctx, limitsAgency, off.ID, off); err != nil {
		t.Fatal(err)
	}
	if rec := rig.post(rigSeat, "chat", "ana", userAsks); rec.Code != http.StatusConflict || !strings.Contains(refusalOf(t, rec), "cannot be used through the gateway") {
		t.Errorf("an account that is off: %d %s", rec.Code, rec.Body.String())
	}
	if len(rig.seen) != 0 {
		t.Fatal("a model was called for a refused request")
	}
}
