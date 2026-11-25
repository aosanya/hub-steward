package http

import (
	"github.com/modelcontextprotocol/go-sdk/mcp"

	mwanachamaagency "github.com/aosanya/mwanachama-backend-agency"
	"github.com/aosanya/mwanachama-backend-shared/dispatch"
)

const (
	designFromSpecTool = "agency_design_from_spec"
	runReviewTool      = "agency_run_review"
)

func agencyToolActions() map[string]string {
	actions := map[string]string{
		designFromSpecTool: LocalActions()[designFromSpecTool],
		runReviewTool:      hostToolActions()[runReviewTool],
	}
	spec, err := dispatch.Parse(mwanachamaagency.Operations())
	if err != nil {
		panic(err)
	}
	for _, op := range spec.Operations {
		if op.Tool != "" && op.Action != "" {
			actions[op.Tool] = op.Action
		}
	}
	return actions
}

func (d *Deps) guardAgencyMCPTools(server *mcp.Server) {
	d.guardToolPermissions(server, agencyToolActions())
	d.guardResidentToolPermissions(server, agencyToolActions())
	d.guardDesignerRowTools(server)
}
