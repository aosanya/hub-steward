package reviewruns

import (
	"context"
	"errors"
	"time"

	mwanachamaai "wakalaserver/modules/ai"
	aimodels "wakalaserver/modules/ai/models"
)

var (
	ErrNoDefaultAccount = errors.New("Mark a default AI account under Models before running a review")
	ErrEmptyAnswer      = errors.New("The AI account sent back an empty answer")
	ErrOutOfRoom        = errors.New("The AI account used its whole answer allowance before it wrote an answer")
	ErrCutOff           = errors.New("The AI account used its whole answer allowance before it finished the answer")
)

const (
	reviewMaxTokens   = 16384
	reviewCallTimeout = 10 * time.Minute
)

type Completion struct {
	Text   string
	Tokens int
}

type Model interface {
	Complete(ctx context.Context, system, user string) (Completion, error)
}

type AIModel struct {
	Manager  mwanachamaai.Manager
	AgencyID string
	Person   string
}

func (m AIModel) Complete(ctx context.Context, system, user string) (Completion, error) {
	account, err := m.Manager.GetDefaultAccount(ctx, m.AgencyID)
	if errors.Is(err, mwanachamaai.ErrNoDefaultAccount) {
		return Completion{}, ErrNoDefaultAccount
	}
	if err != nil {
		return Completion{}, err
	}
	reply, err := m.Manager.ChatAccount(ctx, m.AgencyID, account.ID, mwanachamaai.ChatInput{Messages: []mwanachamaai.ChatMessage{
		{Role: "system", Content: system},
		{Role: "user", Content: user},
	}, MaxTokens: reviewMaxTokens, Timeout: reviewCallTimeout, Kind: aimodels.KindAgencyReview, Person: m.Person})
	if err != nil {
		return Completion{}, err
	}
	if reply.Message.Content == "" {
		return Completion{}, emptyAnswer(reply.FinishReason)
	}
	if ranOut(reply.FinishReason) {
		return Completion{}, ErrCutOff
	}
	return Completion{Text: reply.Message.Content, Tokens: reply.InputTokens + reply.OutputTokens}, nil
}

func ReadArea(ctx context.Context, model Model, system, draft string, in AreaInput) (AreaResult, error) {
	done, err := model.Complete(ctx, system, UserMessage(in, draft))
	if err != nil {
		return AreaResult{}, err
	}
	result, err := ParseAreaResult(done.Text, in.Previous)
	if err != nil {
		return AreaResult{}, err
	}
	result.Tokens = done.Tokens
	return result, nil
}

func ranOut(finishReason string) bool {
	return finishReason == "length" || finishReason == "max_tokens"
}

func emptyAnswer(finishReason string) error {
	if ranOut(finishReason) {
		return ErrOutOfRoom
	}
	return ErrEmptyAnswer
}
