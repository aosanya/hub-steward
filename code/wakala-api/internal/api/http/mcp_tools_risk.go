package http

import (
	"context"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	mwanachamariskmanager "wakalaserver/modules/riskmanager"
	riskmcp "wakalaserver/modules/riskmanager/mcp"
	riskroutes "wakalaserver/modules/riskmanager/routes"
)

type riskToolShape struct {
	mwanachamariskmanager.RiskManager
}

func riskToolActions() map[string]string {
	tools, err := riskroutes.BuildTools(riskToolShape{}, riskroutes.Mount{})
	if err != nil {
		panic(err)
	}
	actions := map[string]string{}
	for _, t := range tools {
		actions[t.Name] = t.Action
	}
	return actions
}

func (d *Deps) registerRiskMCPTools(server *mcp.Server) {
	resolve := func(ctx context.Context, instanceID string) (mwanachamariskmanager.RiskManager, error) {
		return riskManagerFor(ctx, d.Registry, instanceID)
	}
	if err := riskmcp.RegisterTools(server, resolve, riskMount()); err != nil {
		panic(err)
	}
	d.guardToolPermissions(server, riskToolActions())
}
