package http

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	agencymodels "wakalaserver/modules/agency/models"
	mwanachamaaudit "wakalaserver/modules/audit"
	auditmcp "wakalaserver/modules/audit/mcp"
	auditroutes "wakalaserver/modules/audit/routes"

	"wakalaserver/internal/agencies"
)

const (
	auditViewPermission = "audit.view"
	auditListTool       = "audit_list_entries"
	auditListAction     = "audit.entry.list"
)

type auditShape struct{ mwanachamaaudit.AuditManager }

func auditToolActions() map[string]string {
	out := map[string]string{}
	addToolActions(out, sameToolName, auditroutes.Tools(auditShape{}))
	return out
}

func (d *Deps) registerAuditMCPTools(server *mcp.Server) {
	manager := d.Audit
	if manager == nil {
		manager = auditShape{}
	}
	auditmcp.RegisterTools(server, manager)
	server.AddReceivingMiddleware(d.guardAuditTools)
	server.AddReceivingMiddleware(d.recordAuditedWrites)
}

func (d *Deps) guardAuditTools(next mcp.MethodHandler) mcp.MethodHandler {
	return func(ctx context.Context, method string, req mcp.Request) (mcp.Result, error) {
		call, ok := req.(*mcp.CallToolRequest)
		if !ok || method != "tools/call" || call.Params == nil || call.Params.Name != auditListTool {
			return next(ctx, method, req)
		}
		if err := d.auditReadAllowed(ctx, call.Params.Arguments); err != nil {
			return toolError(err), nil
		}
		return next(ctx, method, req)
	}
}

func (d *Deps) auditReadAllowed(ctx context.Context, raw json.RawMessage) error {
	if d.Audit == nil || d.Registry == nil {
		return errAuditUnavailable
	}
	var args struct {
		InstanceID string `json:"instance_id"`
	}
	if json.Unmarshal(raw, &args) != nil || args.InstanceID == "" {
		return errAuditNeedsAgency
	}
	role, err := admittedRole(ctx, d.Registry, args.InstanceID)
	if err != nil {
		return err
	}
	if role == agencies.RoleOwner {
		return nil
	}
	ctx = withPartitionContext(ctx, args.InstanceID)
	if d.callerHoldsAction(ctx, role, auditListAction) {
		return nil
	}
	return auditPermissionMissing()
}

func (d *Deps) callerHoldsAction(ctx context.Context, role, action string) bool {
	if role == agencies.RoleAgent {
		return agentPermissioned(role, d.Registry, d.agencyRolePermissions, nil)(ctx, action) == nil
	}
	return d.heldRolesAllow(ctx, d.Registry, action)
}

func auditPermissionMissing() error {
	name := auditViewPermission
	if p, ok := agencymodels.LookupPermission(auditViewPermission); ok {
		name = p.Name
	}
	return fmt.Errorf("you need the permission %q (%s) in this agency to read its audit log; ask its owner to give it to one of your roles", name, auditViewPermission)
}

var (
	errAuditUnavailable = errors.New("the audit log is not available on this server")
	errAuditNeedsAgency = errors.New("name the agency whose audit log you want to read (instance_id)")
)
