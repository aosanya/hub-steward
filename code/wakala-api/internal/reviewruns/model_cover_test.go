package reviewruns

import (
	"context"
	"errors"
	"strings"
	"testing"

	mwanachamaai "wakalaserver/modules/ai"
	aimodels "wakalaserver/modules/ai/models"
)

type fakeManager struct {
	mwanachamaai.Manager
	account    mwanachamaai.Account
	accountErr error
	reply      mwanachamaai.ChatReply
	chatErr    error
	gotInput   mwanachamaai.ChatInput
	gotAccount string
}

func (f *fakeManager) GetDefaultAccount(context.Context, string) (mwanachamaai.Account, error) {
	return f.account, f.accountErr
}

func (f *fakeManager) ChatAccount(_ context.Context, _, accountID string, in mwanachamaai.ChatInput) (mwanachamaai.ChatReply, error) {
	f.gotAccount = accountID
	f.gotInput = in
	return f.reply, f.chatErr
}

func replyOf(content, finish string) mwanachamaai.ChatReply {
	return mwanachamaai.ChatReply{Message: mwanachamaai.ChatMessage{Content: content}, InputTokens: 5, OutputTokens: 7, FinishReason: finish}
}

func TestAIModelAsksTheDefaultAccountAndCountsBothTokenKinds(t *testing.T) {
	m := &fakeManager{account: mwanachamaai.Account{ID: "acc"}, reply: replyOf("hello", "stop")}
	done, err := AIModel{Manager: m, AgencyID: "ag", Person: "p1"}.Complete(context.Background(), "sys", "usr")
	if err != nil {
		t.Fatal(err)
	}
	if done.Text != "hello" || done.Tokens != 12 {
		t.Errorf("done = %+v", done)
	}
	if m.gotAccount != "acc" || m.gotInput.Person != "p1" || m.gotInput.Kind != aimodels.KindAgencyReview || m.gotInput.MaxTokens != reviewMaxTokens {
		t.Errorf("call = %q %+v", m.gotAccount, m.gotInput)
	}
	if len(m.gotInput.Messages) != 2 || m.gotInput.Messages[0].Role != "system" || m.gotInput.Messages[1].Content != "usr" {
		t.Errorf("messages = %+v", m.gotInput.Messages)
	}
}

func TestAIModelTellsTheOwnerToMarkADefaultAccount(t *testing.T) {
	m := &fakeManager{accountErr: mwanachamaai.ErrNoDefaultAccount}
	_, err := AIModel{Manager: m}.Complete(context.Background(), "s", "u")
	if !errors.Is(err, ErrNoDefaultAccount) {
		t.Errorf("err = %v", err)
	}
}

func TestAIModelPassesOtherAccountAndChatErrorsThrough(t *testing.T) {
	boom := errors.New("boom")
	if _, err := (AIModel{Manager: &fakeManager{accountErr: boom}}).Complete(context.Background(), "s", "u"); !errors.Is(err, boom) {
		t.Errorf("account err = %v", err)
	}
	if _, err := (AIModel{Manager: &fakeManager{chatErr: boom}}).Complete(context.Background(), "s", "u"); !errors.Is(err, boom) {
		t.Errorf("chat err = %v", err)
	}
}

func TestAIModelNamesWhyAnswerIsMissingOrCut(t *testing.T) {
	cases := []struct {
		reply mwanachamaai.ChatReply
		want  error
	}{
		{replyOf("", "stop"), ErrEmptyAnswer},
		{replyOf("", "length"), ErrOutOfRoom},
		{replyOf("", "max_tokens"), ErrOutOfRoom},
		{replyOf("half an answ", "length"), ErrCutOff},
		{replyOf("half an answ", "max_tokens"), ErrCutOff},
	}
	for _, c := range cases {
		_, err := AIModel{Manager: &fakeManager{reply: c.reply}}.Complete(context.Background(), "s", "u")
		if !errors.Is(err, c.want) {
			t.Errorf("finish %q content %q: err = %v, want %v", c.reply.FinishReason, c.reply.Message.Content, err, c.want)
		}
	}
}

const goodAnswer = `Here: {"summary":"fine","findings":[]}`

func TestReadAreaParsesTheAnswerAndAddsTokens(t *testing.T) {
	model := &fakeModel{answer: Completion{Text: goodAnswer, Tokens: 99}}
	result, err := ReadArea(context.Background(), model, "sys", "draft text", AreaInput{Area: AreaProfile})
	if err != nil {
		t.Fatal(err)
	}
	if result.Summary != "fine" || result.Tokens != 99 {
		t.Errorf("result = %+v", result)
	}
	if model.system != "sys" || !strings.Contains(model.user, "draft text") {
		t.Errorf("model saw system %q user %q", model.system, model.user)
	}
}

func TestReadAreaStopsOnAModelErrorAndOnAnUnreadableAnswer(t *testing.T) {
	boom := errors.New("down")
	if _, err := ReadArea(context.Background(), &fakeModel{err: boom}, "s", "d", AreaInput{}); !errors.Is(err, boom) {
		t.Errorf("model err = %v", err)
	}
	if _, err := ReadArea(context.Background(), &fakeModel{answer: Completion{Text: "no json here"}}, "s", "d", AreaInput{}); err == nil {
		t.Error("an answer without JSON must be refused")
	}
}
