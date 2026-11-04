package testruns

import (
	"context"

	mwanachamacomm "wakalaserver/modules/comm"
	commroutes "wakalaserver/modules/comm/routes"
	"wakalaserver/modules/shared/dispatch"
)

const moduleComm = "comm"

type CommSource interface {
	Comm(ctx context.Context, runID string) (*mwanachamacomm.CommManager, error)
}

type CommModule struct {
	source  CommSource
	runID   string
	allowed func(role string) map[string]bool
}

func NewCommModule(source CommSource, runID string, allowed func(role string) map[string]bool) CommModule {
	return CommModule{source: source, runID: runID, allowed: allowed}
}

func (CommModule) Name() string { return moduleComm }

func (m CommModule) Play(ctx context.Context, call Call) (Outcome, error) {
	cm, err := m.source.Comm(ctx, m.runID)
	if err != nil {
		return Outcome{}, err
	}
	cm.UseBelonging(everyoneBelongs)
	cm.UseLeading(everyoneLeads)
	s, err := dispatch.Parse(mwanachamacomm.Operations())
	if err != nil {
		return Outcome{}, err
	}
	tools, err := dispatch.Tools(s, dispatch.Deps{
		Manager:   cm,
		Errors:    commroutes.Sentinels,
		Authorize: gate(m.allowed(call.Role)),
		Caller:    func(context.Context) string { return call.Role },
	})
	if err != nil {
		return Outcome{}, err
	}
	return playTool(ctx, moduleComm, tools, call)
}

func everyoneBelongs(context.Context, string, string) (bool, error) { return true, nil }

func everyoneLeads(context.Context, string, string) (bool, error) { return true, nil }
