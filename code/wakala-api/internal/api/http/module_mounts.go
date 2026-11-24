package http

import (
	"context"
	"net/http"
	"slices"
	"strings"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	"github.com/aosanya/mwanachama-backend-agency/models"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

const listMountsTool = "agency_list_mounts"

const listMountsAction = "instance.mount.list"

type moduleMountsView struct {
	Module string               `json:"module"`
	Icon   string               `json:"icon,omitempty"`
	Mounts []models.ModuleMount `json:"mounts"`
}

type agencyMountsView struct {
	Modules []moduleMountsView `json:"modules"`
}

func mountToolActions() map[string]string {
	return map[string]string{listMountsTool: listMountsAction, listModuleToolsTool: listMountsAction}
}

func (d *Deps) registerModuleMountRoutes(mux *http.ServeMux, reg agencies.Registry, auth callers) {
	mux.HandleFunc("GET /instances/{instanceID}/mounts", auth.require(func(w http.ResponseWriter, r *http.Request) {
		out, err := d.agencyMounts(r.Context(), reg, r.PathValue("instanceID"))
		if err != nil {
			writeInstanceErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, out)
	}))
}

func (d *Deps) registerModuleMountTool(server *mcp.Server) {
	server.AddTool(&mcp.Tool{
		Name:        listMountsTool,
		Title:       "List the agency's modules and their names",
		Description: "Owners and agents only; a resident is refused. Every module the agency has switched on, each with the names it is mounted under, limited to the modules the caller's role may use.",
		InputSchema: map[string]any{
			"type":                 "object",
			"properties":           map[string]any{"instance_id": map[string]any{"type": "string", "description": "The agency to read."}},
			"required":             []string{"instance_id"},
			"additionalProperties": false,
		},
	}, func(ctx context.Context, req *mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		instanceID, _, err := splitFormsInstance(req.Params.Arguments)
		if err != nil {
			return toolError(err), nil
		}
		out, err := d.agencyMounts(ctx, d.Registry, instanceID)
		if err != nil {
			return toolError(err), nil
		}
		return &mcp.CallToolResult{
			Content:           []mcp.Content{&mcp.TextContent{Text: listMountsTool + " completed"}},
			StructuredContent: out,
		}, nil
	})
}

func (d *Deps) agencyMounts(ctx context.Context, reg agencies.Registry, instanceID string) (agencyMountsView, error) {
	if err := d.admittedHoldingAction(ctx, instanceID, listMountsAction); err != nil {
		return agencyMountsView{}, err
	}
	set, err := mountedSetOf(ctx, reg, instanceID)
	if err != nil {
		return agencyMountsView{}, err
	}
	may, err := d.moduleVisibility(ctx, reg, instanceID)
	if err != nil {
		return agencyMountsView{}, err
	}
	out := agencyMountsView{Modules: []moduleMountsView{}}
	for _, entry := range models.ModuleCatalog {
		mounts := set.mountsOf(entry.Code)
		if len(mounts) == 0 || !may(entry.Code) {
			continue
		}
		out.Modules = append(out.Modules, moduleMountsView{Module: entry.Code, Icon: entry.Icon, Mounts: mounts})
	}
	return out, nil
}

func (d *Deps) moduleVisibility(ctx context.Context, reg agencies.Registry, instanceID string) (func(code string) bool, error) {
	caller := accounts.IDFromContext(ctx)
	role, err := reg.RoleOf(ctx, instanceID, caller)
	if err != nil {
		return nil, err
	}
	if role == agencies.RoleAgent {
		return d.agentModuleVisibility(ctx, instanceID)
	}
	if role == agencies.RoleResident {
		codes, err := d.callerPermissionCodes(withPartitionContext(ctx, instanceID), instanceID)
		if err != nil {
			return nil, err
		}
		if len(codes) > 0 {
			return anyPermissionUnder(codes), nil
		}
	}
	if d.Permissions == nil {
		return func(string) bool { return true }, nil
	}
	actions, err := d.Permissions.ActionsAnywhere(ctx, caller)
	if err != nil {
		return nil, err
	}
	return anyActionUnder(actions), nil
}

func (d *Deps) agentModuleVisibility(ctx context.Context, instanceID string) (func(code string) bool, error) {
	codes, err := d.callerRolePermissionCodes(ctx, instanceID)
	if err != nil {
		return func(string) bool { return false }, nil
	}
	return seatedModuleVisibility(codes), nil
}

func seatedModuleVisibility(codes []string) func(code string) bool {
	if len(codes) == 0 {
		return func(string) bool { return false }
	}
	held := anyPermissionUnder(codes)
	return func(code string) bool { return held(code) || selfServiceModule(code) }
}

var seatedMayModule = anyActionUnder(seatedMayActions)

func selfServiceModule(code string) bool {
	return slices.Contains(seatedToolModules, code) || seatedMayModule(code)
}

func anyPermissionUnder(codes []string) func(code string) bool {
	held := allowedActions(codes)
	actions := make([]string, 0, len(held))
	for a := range held {
		actions = append(actions, a)
	}
	return anyActionUnder(actions)
}

var seatedToolModules = modulesOfSeatedMayTools()

func modulesOfSeatedMayTools() []string {
	modules := []string{}
	for tool, action := range LocalActions() {
		module, _, found := strings.Cut(tool, "_")
		if found && everySeatedAgentMay(action) && !slices.Contains(modules, module) {
			modules = append(modules, module)
		}
	}
	return modules
}

func anyActionUnder(actions []string) func(code string) bool {
	return func(code string) bool {
		for _, a := range actions {
			if strings.HasPrefix(a, code+".") || models.DeclaredModuleOfAction(a) == code {
				return true
			}
		}
		return false
	}
}
