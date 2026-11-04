package testruns

import (
	"context"

	mwanachamaforms "wakalaserver/modules/forms"
	formsroutes "wakalaserver/modules/forms/routes"
)

const moduleForms = "forms"

type FormsSource interface {
	Forms(ctx context.Context, runID string) (mwanachamaforms.FormManager, error)
}

type FormsModule struct {
	source  FormsSource
	runID   string
	allowed func(role string) map[string]bool
}

func NewFormsModule(source FormsSource, runID string, allowed func(role string) map[string]bool) FormsModule {
	return FormsModule{source: source, runID: runID, allowed: allowed}
}

func (FormsModule) Name() string { return moduleForms }

func (m FormsModule) Play(ctx context.Context, call Call) (Outcome, error) {
	fm, err := m.source.Forms(ctx, m.runID)
	if err != nil {
		return Outcome{}, err
	}
	permitted := m.allowed(call.Role)
	tools, err := formsroutes.BuildGatedTools(fm, formsroutes.Mount{
		Caller:    func(context.Context) string { return call.Role },
		Authorize: gate(permitted),
	})
	if err != nil {
		return Outcome{}, err
	}
	return playTool(ctx, moduleForms, tools, call)
}
