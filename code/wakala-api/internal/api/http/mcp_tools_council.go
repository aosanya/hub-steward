package http

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"slices"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	agencymodels "github.com/aosanya/mwanachama-backend-agency/models"
	mwanachamacouncil "github.com/aosanya/mwanachama-backend-council"
	councilmcp "github.com/aosanya/mwanachama-backend-council/mcp"
	councilroutes "github.com/aosanya/mwanachama-backend-council/routes"

	"wakalaserver/internal/agencies"
)

const councilModule = "council"

var councilPermissionsLeastFirst = []string{"council.view", "council.manage"}

type councilShape struct {
	mwanachamacouncil.CouncilManager
}

func councilToolActions() map[string]string {
	out := map[string]string{}
	addToolActions(out, sameToolName, councilroutes.Tools(councilShape{}))
	return out
}

func (d *Deps) registerCouncilMCPTools(server *mcp.Server) {
	manager := d.Council
	if manager == nil {
		manager = councilShape{}
	}
	councilmcp.RegisterTools(server, manager)
	server.AddReceivingMiddleware(d.guardCouncilTools(councilToolActions()))
}

func (d *Deps) guardCouncilTools(actions map[string]string) func(mcp.MethodHandler) mcp.MethodHandler {
	return func(next mcp.MethodHandler) mcp.MethodHandler {
		return func(ctx context.Context, method string, req mcp.Request) (mcp.Result, error) {
			call, ok := req.(*mcp.CallToolRequest)
			if !ok || method != "tools/call" || call.Params == nil {
				return next(ctx, method, req)
			}
			action, guarded := actions[call.Params.Name]
			if !guarded {
				return next(ctx, method, req)
			}
			if err := d.councilCallAllowed(ctx, call.Params.Arguments, action); err != nil {
				return toolError(err), nil
			}
			return next(ctx, method, req)
		}
	}
}

func (d *Deps) councilCallAllowed(ctx context.Context, raw json.RawMessage, action string) error {
	if d.Council == nil || d.Registry == nil {
		return errCouncilUnavailable
	}
	var args struct {
		InstanceID string `json:"instance_id"`
	}
	if json.Unmarshal(raw, &args) != nil || args.InstanceID == "" {
		return errCouncilNeedsAgency
	}
	role, err := admittedRole(ctx, d.Registry, args.InstanceID)
	if err != nil {
		return err
	}
	if err := mustBeMounted(ctx, d.Registry, args.InstanceID, councilModule); err != nil {
		return err
	}
	if role == agencies.RoleOwner {
		return nil
	}
	if d.callerHoldsAction(withPartitionContext(ctx, args.InstanceID), role, action) {
		return nil
	}
	return councilPermissionMissing(action)
}

func councilPermissionMissing(action string) error {
	code := councilPermissionFor(action)
	name := code
	if p, ok := agencymodels.LookupPermission(code); ok {
		name = p.Name
	}
	return fmt.Errorf("you need the permission %q (%s) in this agency to do this with its council; ask its owner to give it to one of your roles", name, code)
}

func councilPermissionFor(action string) string {
	for _, code := range councilPermissionsLeastFirst {
		if p, ok := agencymodels.LookupPermission(code); ok && slices.Contains(p.Actions, action) {
			return code
		}
	}
	return councilPermissionsLeastFirst[len(councilPermissionsLeastFirst)-1]
}

var (
	errCouncilUnavailable = errors.New("the council is not available on this server")
	errCouncilNeedsAgency = errors.New("name the agency whose council you want (instance_id)")
)
