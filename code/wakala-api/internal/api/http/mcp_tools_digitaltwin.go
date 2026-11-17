package http

import (
	"context"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	mwanachamadigitaltwin "wakalaserver/modules/digitaltwin"
	digitaltwinmcp "wakalaserver/modules/digitaltwin/mcp"
	digitaltwinroutes "wakalaserver/modules/digitaltwin/routes"

	"wakalaserver/internal/accounts"
)

func (d *Deps) resolveTwin(ctx context.Context, instanceID string) (mwanachamadigitaltwin.TwinManager, error) {
	if err := mustBeMounted(ctx, d.Registry, instanceID, "digitaltwin"); err != nil {
		return nil, err
	}
	if err := d.memberOrClearedResident(ctx, instanceID); err != nil {
		return nil, err
	}
	return d.Registry.TwinManager(ctx, instanceID)
}

func digitaltwinToolMount() digitaltwinroutes.Mount {
	return digitaltwinroutes.Mount{Caller: accounts.IDFromContext}
}

func digitaltwinToolActions() map[string]string {
	tools, err := digitaltwinroutes.BuildTools(struct {
		mwanachamadigitaltwin.TwinManager
	}{}, digitaltwinroutes.Mount{})
	if err != nil {
		panic(err)
	}
	actions := map[string]string{}
	for _, t := range tools {
		if digitaltwinmcp.Served(t.Action) {
			actions[t.Name] = t.Action
		}
	}
	return actions
}

func (d *Deps) registerDigitaltwinMCPTools(server *mcp.Server) {
	digitaltwinmcp.RegisterResolvedTools(server, d.resolveTwin, digitaltwinToolMount())
	d.guardToolPermissions(server, digitaltwinToolActions())
	d.guardResidentToolPermissions(server, digitaltwinToolActions())
}
