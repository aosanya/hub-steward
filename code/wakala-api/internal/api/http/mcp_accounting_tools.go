package http

import (
	"context"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	mwanachamaaccounting "wakalaserver/modules/accounting"
	accountingmcp "wakalaserver/modules/accounting/mcp"
	accountingroutes "wakalaserver/modules/accounting/routes"

	"wakalaserver/internal/accounts"
)

func (d *Deps) resolveLedger(ctx context.Context, instanceID string) (mwanachamaaccounting.LedgerRepository, error) {
	return ledgerFor(ctx, d.Registry, instanceID)
}

func accountingToolMount() accountingroutes.Mount {
	return accountingroutes.Mount{Caller: accounts.IDFromContext}
}

func accountingToolActions() map[string]string {
	tools, err := accountingroutes.BuildTools(struct {
		mwanachamaaccounting.LedgerRepository
	}{}, accountingroutes.Mount{})
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
	accountingmcp.RegisterResolvedTools(server, d.resolveLedger, accountingToolMount())
	d.guardToolPermissions(server, accountingToolActions())
}
