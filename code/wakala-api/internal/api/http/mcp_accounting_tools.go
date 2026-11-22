package http

import (
	"context"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	mwanachamaaccounting "github.com/aosanya/mwanachama-backend-accounting"

	"wakalaserver/internal/accountingtools"
	"wakalaserver/internal/accounts"
)

func (d *Deps) resolveLedger(ctx context.Context, instanceID string) (mwanachamaaccounting.LedgerRepository, error) {
	return d.ledgerFor(ctx, d.Registry, instanceID)
}

func accountingToolMount() accountingtools.Mount {
	return accountingtools.Mount{Caller: accounts.IDFromContext}
}

func accountingToolActions() map[string]string {
	tools, err := accountingtools.BuildTools(struct {
		mwanachamaaccounting.LedgerRepository
	}{}, accountingtools.Mount{})
	if err != nil {
		panic(err)
	}
	actions := map[string]string{}
	for _, t := range tools {
		actions[t.Name] = t.Action
	}
	return actions
}

func (d *Deps) registerAccountingMCPTools(server *mcp.Server) {
	accountingtools.RegisterResolvedTools(server, d.resolveLedger, accountingToolMount())
	d.guardToolPermissions(server, accountingToolActions())
	d.guardResidentToolPermissions(server, accountingToolActions())
}
