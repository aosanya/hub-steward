package http

import (
	"context"
	"errors"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	agencymcp "wakalaserver/modules/agency/mcp"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
	"wakalaserver/internal/apikeys"
)

var (
	errServiceUnknown    = errors.New("that service does not exist or has no live key")
	errServiceNeedsRole  = errors.New("agency_role_id is required: a service is always linked to an agency role")
	errServiceNotGranted = errors.New("that service is not granted in this agency")
)

type serviceGrantRequest struct {
	Service      string `json:"service"`
	AgencyRoleID string `json:"agency_role_id"`
}

type serviceGrant struct {
	InstanceID   string `json:"instance_id"`
	Service      string `json:"service"`
	Subject      string `json:"subject"`
	AgencyRoleID string `json:"agency_role_id"`
}

type grantedService struct {
	Service      string    `json:"service"`
	Subject      string    `json:"subject"`
	AgencyRoleID string    `json:"agency_role_id"`
	Since        time.Time `json:"since"`
}

type serviceRevocation struct {
	InstanceID string `json:"instance_id"`
	Service    string `json:"service"`
	Subject    string `json:"subject"`
}

func (d *Deps) grantService(ctx context.Context, instanceID, service, agencyRoleID string) (serviceGrant, error) {
	if err := mustOwnAgency(ctx, d.Registry, instanceID); err != nil {
		return serviceGrant{}, err
	}
	service, agencyRoleID = strings.TrimSpace(service), strings.TrimSpace(agencyRoleID)
	if !apikeys.ValidServiceName(service) {
		return serviceGrant{}, apikeys.ErrInvalidService
	}
	if agencyRoleID == "" {
		return serviceGrant{}, errServiceNeedsRole
	}
	if !d.serviceHasALiveKey(ctx, service) {
		return serviceGrant{}, errServiceUnknown
	}
	if _, err := d.agencyRolePermissions(context.WithValue(ctx, partitionKey{}, instanceID), agencyRoleID); err != nil {
		return serviceGrant{}, errUnknownAgencyRole
	}
	subject := apikeys.ServiceCaller(service)
	current, err := d.Registry.RoleOf(ctx, instanceID, subject)
	if err != nil {
		return serviceGrant{}, err
	}
	if current == agencies.RoleOwner {
		return serviceGrant{}, errAgentAlreadyOwner
	}
	grants, ok := d.Registry.(agencies.AgentGrants)
	if !ok {
		return serviceGrant{}, errRoleLinksNotServed
	}
	if err := grants.GrantAgentRole(ctx, instanceID, subject, agencyRoleID); err != nil {
		return serviceGrant{}, err
	}
	return serviceGrant{InstanceID: instanceID, Service: service, Subject: subject, AgencyRoleID: agencyRoleID}, nil
}

func (d *Deps) serviceHasALiveKey(ctx context.Context, service string) bool {
	if d.APIKeys == nil {
		return false
	}
	live, err := d.APIKeys.LiveServices(ctx)
	return err == nil && slices.Contains(live, service)
}

func (d *Deps) grantedServices(ctx context.Context, instanceID string) ([]grantedService, error) {
	caller := accounts.IDFromContext(ctx)
	member, err := d.Registry.IsMember(ctx, instanceID, caller)
	if err != nil {
		return nil, err
	}
	if !member {
		return nil, agencies.ErrInstanceNotFound
	}
	members, err := d.Registry.Members(ctx, instanceID)
	if err != nil {
		return nil, err
	}
	links, _ := d.Registry.(agencies.AgencyRoleLinks)
	out := []grantedService{}
	for _, m := range members {
		if m.Role != agencies.RoleAgent || !apikeys.IsServiceCaller(m.UserID) {
			continue
		}
		var linked string
		if links != nil {
			linked, err = links.AgencyRoleOf(ctx, instanceID, m.UserID)
			if err != nil {
				return nil, err
			}
		}
		out = append(out, grantedService{Service: apikeys.ServiceOf(m.UserID), Subject: m.UserID, AgencyRoleID: linked, Since: m.CreatedAt})
	}
	return out, nil
}

func (d *Deps) revokeServiceGrant(ctx context.Context, instanceID, service string) (serviceRevocation, error) {
	if err := mustOwnAgency(ctx, d.Registry, instanceID); err != nil {
		return serviceRevocation{}, err
	}
	service = strings.TrimSpace(service)
	if !apikeys.ValidServiceName(service) {
		return serviceRevocation{}, apikeys.ErrInvalidService
	}
	subject := apikeys.ServiceCaller(service)
	role, err := d.Registry.RoleOf(ctx, instanceID, subject)
	if err != nil {
		return serviceRevocation{}, err
	}
	if role != agencies.RoleAgent {
		return serviceRevocation{}, errServiceNotGranted
	}
	if err := d.Registry.RemoveMember(ctx, instanceID, subject); err != nil {
		return serviceRevocation{}, err
	}
	return serviceRevocation{InstanceID: instanceID, Service: service, Subject: subject}, nil
}

func writeServiceGrantErr(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, errServiceNeedsRole), errors.Is(err, apikeys.ErrInvalidService):
		writeErr(w, http.StatusBadRequest, err.Error())
	case errors.Is(err, errServiceUnknown), errors.Is(err, errServiceNotGranted):
		writeErr(w, http.StatusNotFound, err.Error())
	case errors.Is(err, errUnknownAgencyRole):
		writeErr(w, http.StatusUnprocessableEntity, err.Error())
	case errors.Is(err, errAgentAlreadyOwner), errors.Is(err, agencies.ErrAlreadyOwner):
		writeErr(w, http.StatusConflict, errAgentAlreadyOwner.Error())
	case errors.Is(err, errRoleLinksNotServed):
		writeErr(w, http.StatusNotImplemented, err.Error())
	default:
		writeAddAgentErr(w, err)
	}
}

func (d *Deps) postServiceGrant(w http.ResponseWriter, r *http.Request) {
	var in serviceGrantRequest
	if err := readJSON(r, &in); err != nil {
		writeErr(w, http.StatusBadRequest, "invalid request body")
		return
	}
	out, err := d.grantService(r.Context(), r.PathValue("instanceID"), in.Service, in.AgencyRoleID)
	if err != nil {
		writeServiceGrantErr(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, out)
}

func (d *Deps) getServiceGrants(w http.ResponseWriter, r *http.Request) {
	out, err := d.grantedServices(r.Context(), r.PathValue("instanceID"))
	if err != nil {
		writeServiceGrantErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (d *Deps) deleteServiceGrant(w http.ResponseWriter, r *http.Request) {
	if _, err := d.revokeServiceGrant(r.Context(), r.PathValue("instanceID"), r.PathValue("service")); err != nil {
		writeServiceGrantErr(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (d *Deps) registerServiceGrantRoutes(mux *http.ServeMux, auth callers) {
	mux.HandleFunc("POST /instances/{instanceID}/services", auth.require(d.postServiceGrant))
	mux.HandleFunc("GET /instances/{instanceID}/services", auth.require(d.getServiceGrants))
	mux.HandleFunc("DELETE /instances/{instanceID}/services/{service}", auth.require(d.deleteServiceGrant))
}

type mcpGrantServiceParams struct {
	InstanceID   string `json:"instance_id" jsonschema:"the Agency Instance to grant the service in"`
	Service      string `json:"service" jsonschema:"the service name, for example hub-steward"`
	AgencyRoleID string `json:"agency_role_id" jsonschema:"the agency role whose permissions the service holds in this agency"`
}

type mcpListServicesParams struct {
	InstanceID string `json:"instance_id" jsonschema:"the Agency Instance whose granted services to list"`
}

type mcpRevokeServiceParams struct {
	InstanceID string `json:"instance_id" jsonschema:"the Agency Instance to take the service out of"`
	Service    string `json:"service" jsonschema:"the service name, for example hub-steward"`
}

func (d *Deps) registerServiceGrantMCPTools(server *mcp.Server) {
	mcp.AddTool(server, &mcp.Tool{Name: "agency_grant_service", Title: "Grant Service", Description: "Owner only: let a platform service (for example hub-steward) work in this Agency as an agent holding one agency role's permissions. The role is required. A service that does not exist, a missing role and an owner are refused."}, d.mcpGrantService)
	mcp.AddTool(server, &mcp.Tool{Name: "agency_list_services", Title: "List Services", Description: "List the platform services granted in this Agency with the agency role each holds. Members only."}, d.mcpListServices)
	mcp.AddTool(server, &mcp.Tool{Name: "agency_revoke_service", Title: "Revoke Service", Description: "Owner only: take a platform service out of this Agency at once."}, d.mcpRevokeService)
}

func (d *Deps) mcpGrantService(ctx context.Context, _ *mcp.CallToolRequest, p mcpGrantServiceParams) (*mcp.CallToolResult, serviceGrant, error) {
	out, err := d.grantService(ctx, p.InstanceID, p.Service, p.AgencyRoleID)
	if err != nil {
		return nil, serviceGrant{}, err
	}
	return textResult("Granted %s in %s as an agent with agency role %s", out.Service, out.InstanceID, out.AgencyRoleID), out, nil
}

func (d *Deps) mcpListServices(ctx context.Context, _ *mcp.CallToolRequest, p mcpListServicesParams) (*mcp.CallToolResult, agencymcp.ListResult[grantedService], error) {
	out, err := d.grantedServices(ctx, p.InstanceID)
	if err != nil {
		return nil, agencymcp.ListResult[grantedService]{}, err
	}
	return textResult("Found %d granted service(s)", len(out)), agencymcp.ListResult[grantedService]{Items: out}, nil
}

func (d *Deps) mcpRevokeService(ctx context.Context, _ *mcp.CallToolRequest, p mcpRevokeServiceParams) (*mcp.CallToolResult, serviceRevocation, error) {
	out, err := d.revokeServiceGrant(ctx, p.InstanceID, p.Service)
	if err != nil {
		return nil, serviceRevocation{}, err
	}
	return textResult("Revoked %s in %s", out.Service, out.InstanceID), out, nil
}
