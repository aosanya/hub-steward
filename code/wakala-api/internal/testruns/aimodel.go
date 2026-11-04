package testruns

import (
	"context"

	mwanachamaai "wakalaserver/modules/ai"
	aimodels "wakalaserver/modules/ai/models"
)

type AIModel struct {
	Manager  mwanachamaai.Manager
	AgencyID string
	Person   string
}

func (m AIModel) Chat(ctx context.Context, in mwanachamaai.ChatInput) (mwanachamaai.ChatReply, error) {
	account, err := m.Manager.GetDefaultAccount(ctx, m.AgencyID)
	if err != nil {
		return mwanachamaai.ChatReply{}, err
	}
	in.Kind, in.Person = aimodels.KindTestRun, m.Person
	return m.Manager.ChatAccount(ctx, m.AgencyID, account.ID, in)
}

type AIMeter struct {
	Manager   mwanachamaai.Manager
	AgencyID  string
	AccountID string
	RoleID    string
	Person    string
}

func (m AIMeter) Check(ctx context.Context, runID, _ string) (Decision, error) {
	d, err := m.Manager.CheckLimits(ctx, m.AgencyID, mwanachamaai.CheckInput{AccountID: m.AccountID, RoleID: m.RoleID, TestRunID: runID})
	if err != nil {
		return Decision{}, err
	}
	return Decision{Allowed: d.Allowed, Reason: d.Reason, BudgetReached: d.BudgetReached}, nil
}

func (m AIMeter) Record(ctx context.Context, runID, step string, tokensIn, tokensOut int) error {
	_, err := m.Manager.RecordUsage(ctx, m.AgencyID, mwanachamaai.UsageInput{AccountID: m.AccountID, RoleID: m.RoleID, TokensIn: tokensIn, TokensOut: tokensOut, TestRunID: runID, Step: step, Kind: aimodels.KindTestRun, Person: m.Person})
	return err
}

func NewAI(m mwanachamaai.Manager, agencyID, person string) (Model, Meter, error) {
	account, err := m.GetDefaultAccount(context.Background(), agencyID)
	if err != nil {
		return nil, nil, err
	}
	return AIModel{Manager: m, AgencyID: agencyID, Person: person}, AIMeter{Manager: m, AgencyID: agencyID, AccountID: account.ID, Person: person}, nil
}
