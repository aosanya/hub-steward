// mcp_tools_instance.go exposes wakala-api's own Registry (decision #15) —
// the layer above mwanachama-backend-agency's single-Agency-per-manager
// model that lets multiple Agencies coexist. Every agency_* tool
// (mwanachama-backend-agency's own mcp package, decision #16) resolves a
// caller-supplied instance_id to one AgencyManager via
// resolveAgencyManager; agency_create_instance/agency_list_instances are
// how an MCP caller gets one to resolve in the first place — previously
// only possible over the session-gated POST /instances REST route (the
// same route Studio's "+ New agency" button calls).
package http

import (
	"context"
	"fmt"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
	agencymcp "wakalaserver/modules/agency/mcp"
	mwanachamaagencymodels "wakalaserver/modules/agency/models"
)

func (d *Deps) registerInstanceMCPTools(server *mcp.Server) {
	mcp.AddTool(server, &mcp.Tool{Name: "agency_create_instance", Title: "Register Agency", Description: "Register a new Agency Instance and create its underlying Agency document (name) in one call — the MCP equivalent of Studio's \"+ New agency\" button. Returns the instance_id every other agency_* tool requires."}, d.mcpCreateInstance)
	mcp.AddTool(server, &mcp.Tool{Name: "agency_add_agent", Title: "Add Agent", Description: "Owner only: add a caller (by user_id) to an Agency Instance with the agent role. A non-owner is refused."}, d.mcpAddAgent)
	mcp.AddTool(server, &mcp.Tool{Name: "agency_list_instances", Title: "List Agencies", Description: "List every registered Agency Instance. Call this first to find the instance_id every other tool requires."}, d.mcpListInstances)
	d.registerInstanceSettingsMCPTools(server)
	d.registerServiceGrantMCPTools(server)
	d.registerCallerRolesMCPTool(server)
	d.registerGroupRoleMCPTools(server)
}

type mcpCreateInstanceParams struct {
	Name string `json:"name" jsonschema:"the new Agency's name"`
}

func (d *Deps) mcpCreateInstance(ctx context.Context, _ *mcp.CallToolRequest, p mcpCreateInstanceParams) (*mcp.CallToolResult, agencies.Instance, error) {
	if p.Name == "" {
		return nil, agencies.Instance{}, fmt.Errorf("name must not be empty")
	}
	caller := accounts.IDFromContext(ctx)
	if caller == "" {
		return nil, agencies.Instance{}, fmt.Errorf("authentication required")
	}
	if isMachineCaller(caller) {
		return nil, agencies.Instance{}, errMachineCannotCreate
	}
	if err := checkInstanceRoom(ctx, d.Registry, caller, p.Name); err != nil {
		return nil, agencies.Instance{}, err
	}
	out, err := d.Registry.CreateInstance(ctx, p.Name)
	if err != nil {
		return nil, agencies.Instance{}, err
	}
	if err := d.Registry.AddMember(ctx, out.ID, caller, agencies.RoleOwner); err != nil {
		return nil, agencies.Instance{}, err
	}
	mgr, err := d.Registry.AgencyManager(ctx, out.ID)
	if err != nil {
		return nil, agencies.Instance{}, err
	}
	if _, err := mgr.CreateAgency(ctx, mwanachamaagencymodels.Agency{Name: p.Name}); err != nil {
		return nil, agencies.Instance{}, err
	}
	return textResult("Registered Agency Instance %q (%s)", out.Name, out.ID), out, nil
}

type mcpAddAgentParams struct {
	InstanceID string `json:"instance_id" jsonschema:"the Agency Instance to add the agent to"`
	UserID     string `json:"user_id" jsonschema:"the caller to add with the agent role"`
}

func (d *Deps) mcpAddAgent(ctx context.Context, _ *mcp.CallToolRequest, p mcpAddAgentParams) (*mcp.CallToolResult, agentMembership, error) {
	out, err := addAgent(ctx, d.Registry, p.InstanceID, p.UserID)
	if err != nil {
		return nil, agentMembership{}, err
	}
	return textResult("Added %s to %s as an agent", out.UserID, out.InstanceID), out, nil
}

func (d *Deps) mcpListInstances(ctx context.Context, _ *mcp.CallToolRequest, _ struct{}) (*mcp.CallToolResult, agencymcp.ListResult[agencies.Instance], error) {
	out, err := d.Registry.InstancesFor(ctx, accounts.IDFromContext(ctx))
	return textResult("Found %d registered Agency Instance(s)", len(out)), agencymcp.ListResult[agencies.Instance]{Items: out}, err
}

// textResult builds a *mcp.CallToolResult carrying a one-line
// human-readable sentence as its Content, in place of the go-sdk's default
// behavior of JSON-dumping the whole return value there — mirrors
// mwanachama-backend-agency/mcp's own unexported summary helper, since this
// file's tools aren't part of that package. StructuredContent is
// unaffected either way; only ever worth calling on a tool's success path
// (see that package's summary doc comment for why).
func textResult(format string, args ...any) *mcp.CallToolResult {
	return &mcp.CallToolResult{Content: []mcp.Content{&mcp.TextContent{Text: fmt.Sprintf(format, args...)}}}
}
