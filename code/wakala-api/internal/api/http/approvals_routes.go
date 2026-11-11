package http

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/modelcontextprotocol/go-sdk/mcp"
	"wakalaserver/modules/shared/dispatch"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
	"wakalaserver/internal/approvals"
	agencymcp "wakalaserver/modules/agency/mcp"
)

func approvalsFor(ctx context.Context, reg agencies.Registry, instanceID string) (*approvals.Store, error) {
	if err := mustBeMember(ctx, reg, instanceID); err != nil {
		return nil, err
	}
	return reg.Approvals(ctx, instanceID)
}

func proposeApproval(ctx context.Context, reg agencies.Registry, instanceID, kind, summary, payload string) (approvals.Approval, error) {
	st, err := approvalsFor(ctx, reg, instanceID)
	if err != nil {
		return approvals.Approval{}, err
	}
	return st.Propose(ctx, accounts.IDFromContext(ctx), kind, summary, payload)
}

func listApprovals(ctx context.Context, reg agencies.Registry, instanceID, status string) ([]approvals.Approval, error) {
	st, err := approvalsFor(ctx, reg, instanceID)
	if err != nil {
		return nil, err
	}
	return st.List(ctx, status)
}

func getApproval(ctx context.Context, reg agencies.Registry, instanceID, id string) (approvals.Approval, error) {
	st, err := approvalsFor(ctx, reg, instanceID)
	if err != nil {
		return approvals.Approval{}, err
	}
	return st.Get(ctx, id)
}

func decideApproval(ctx context.Context, reg agencies.Registry, env applyEnv, instanceID, id, decision, reason, payloadPatch string, seenAmendments *int) (approvals.Approval, error) {
	if err := mustOwnAgency(ctx, reg, instanceID); err != nil {
		return approvals.Approval{}, err
	}
	st, err := reg.Approvals(ctx, instanceID)
	if err != nil {
		return approvals.Approval{}, err
	}
	out, err := decideStored(ctx, st, id, accounts.IDFromContext(ctx), decision, reason, payloadPatch, seenAmendments)
	if err != nil || out.Status != approvals.StatusApproved {
		return out, err
	}
	return applyApproved(ctx, reg, env, instanceID, st, out)
}

func decideStored(ctx context.Context, st *approvals.Store, id, decider, decision, reason, payloadPatch string, seenAmendments *int) (approvals.Approval, error) {
	if seenAmendments == nil {
		return st.Decide(ctx, id, decider, decision, reason, payloadPatch)
	}
	return st.DecideSeen(ctx, id, decider, decision, reason, payloadPatch, *seenAmendments)
}

func amendApproval(ctx context.Context, reg agencies.Registry, instanceID, id, summary, payloadPatch string) (approvals.Approval, error) {
	if err := mustBeMember(ctx, reg, instanceID); err != nil {
		return approvals.Approval{}, err
	}
	caller := accounts.IDFromContext(ctx)
	role, err := reg.RoleOf(ctx, instanceID, caller)
	if err != nil {
		return approvals.Approval{}, err
	}
	st, err := reg.Approvals(ctx, instanceID)
	if err != nil {
		return approvals.Approval{}, err
	}
	return st.Amend(ctx, id, caller, role == agencies.RoleOwner, summary, payloadPatch)
}

func writeApprovalErr(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, dispatch.ErrForbidden), errors.Is(err, approvals.ErrNotProposer):
		writeErr(w, http.StatusForbidden, err.Error())
	case errors.Is(err, approvals.ErrInvalid), errors.Is(err, approvals.ErrBadDecision),
		errors.Is(err, approvals.ErrPatchNeedsApproval), errors.Is(err, approvals.ErrBadPatch), errors.Is(err, approvals.ErrPayloadNotObject), errors.Is(err, approvals.ErrNothingToAmend):
		writeErr(w, http.StatusBadRequest, err.Error())
	case errors.Is(err, approvals.ErrNotFound):
		writeErr(w, http.StatusNotFound, err.Error())
	case errors.Is(err, ErrApplyFailed):
		writeErr(w, http.StatusUnprocessableEntity, err.Error())
	case errors.Is(err, approvals.ErrAlreadyDecided), errors.Is(err, approvals.ErrChangedSinceRead):
		writeErr(w, http.StatusConflict, err.Error())
	default:
		writeInstanceErr(w, err)
	}
}

type proposeApprovalRequest struct {
	Kind    string          `json:"kind"`
	Summary string          `json:"summary"`
	Payload json.RawMessage `json:"payload"`
}

type decideApprovalRequest struct {
	Decision     string          `json:"decision"`
	Reason       string          `json:"reason"`
	PayloadPatch json.RawMessage `json:"payload_patch"`

	SeenAmendments *int `json:"seen_amendments"`
}

type amendApprovalRequest struct {
	Summary      string          `json:"summary"`
	PayloadPatch json.RawMessage `json:"payload_patch"`
}

func (d *Deps) registerApprovalRoutes(mux *http.ServeMux, auth callers) {
	reg := d.Registry
	mux.HandleFunc("POST /instances/{instanceID}/approvals", auth.require(func(w http.ResponseWriter, r *http.Request) {
		var in proposeApprovalRequest
		if err := readJSON(r, &in); err != nil {
			writeReadErr(w, err)
			return
		}
		out, err := proposeApproval(r.Context(), reg, r.PathValue("instanceID"), in.Kind, in.Summary, string(in.Payload))
		if err != nil {
			writeApprovalErr(w, err)
			return
		}
		writeJSON(w, http.StatusCreated, out)
	}))
	mux.HandleFunc("GET /instances/{instanceID}/approvals", auth.require(func(w http.ResponseWriter, r *http.Request) {
		out, err := listApprovals(r.Context(), reg, r.PathValue("instanceID"), r.URL.Query().Get("status"))
		if err != nil {
			writeApprovalErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"items": out})
	}))
	mux.HandleFunc("GET /instances/{instanceID}/approvals/{approvalID}", auth.require(func(w http.ResponseWriter, r *http.Request) {
		out, err := getApproval(r.Context(), reg, r.PathValue("instanceID"), r.PathValue("approvalID"))
		if err != nil {
			writeApprovalErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, out)
	}))
	mux.HandleFunc("POST /instances/{instanceID}/approvals/{approvalID}/decision", auth.require(func(w http.ResponseWriter, r *http.Request) {
		var in decideApprovalRequest
		if err := readJSON(r, &in); err != nil {
			writeReadErr(w, err)
			return
		}
		out, err := decideApproval(r.Context(), reg, d.applyEnv(), r.PathValue("instanceID"), r.PathValue("approvalID"), in.Decision, in.Reason, string(in.PayloadPatch), in.SeenAmendments)
		if err != nil {
			writeApprovalErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, out)
	}))
	mux.HandleFunc("POST /instances/{instanceID}/approvals/{approvalID}/amendment", auth.require(func(w http.ResponseWriter, r *http.Request) {
		var in amendApprovalRequest
		if err := readJSON(r, &in); err != nil {
			writeReadErr(w, err)
			return
		}
		out, err := amendApproval(r.Context(), reg, r.PathValue("instanceID"), r.PathValue("approvalID"), in.Summary, string(in.PayloadPatch))
		if err != nil {
			writeApprovalErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, out)
	}))
}

type mcpProposeWriteParams struct {
	InstanceID string `json:"instance_id" jsonschema:"the Agency Instance the proposal belongs to"`
	Kind       string `json:"kind" jsonschema:"what kind of write is proposed"`
	Summary    string `json:"summary" jsonschema:"one line an owner reads to decide"`
	Payload    string `json:"payload,omitempty" jsonschema:"the proposed write, as JSON text"`
}

type mcpListApprovalsParams struct {
	InstanceID string `json:"instance_id" jsonschema:"the Agency Instance to list"`
	Status     string `json:"status,omitempty" jsonschema:"pending, approved or refused; empty lists all"`
}

type mcpGetApprovalParams struct {
	InstanceID string `json:"instance_id" jsonschema:"the Agency Instance the proposal belongs to"`
	ApprovalID string `json:"approval_id" jsonschema:"the proposal to read"`
}

type mcpDecideApprovalParams struct {
	InstanceID     string `json:"instance_id" jsonschema:"the Agency Instance the proposal belongs to"`
	ApprovalID     string `json:"approval_id" jsonschema:"the proposal to decide"`
	Decision       string `json:"decision" jsonschema:"approved or refused"`
	Reason         string `json:"reason,omitempty" jsonschema:"why, shown to the agent"`
	PayloadPatch   string `json:"payload_patch,omitempty" jsonschema:"only when approving: a JSON object as text, applied to the proposal's payload as a JSON merge patch (RFC 7386); a key sets or replaces a value and null removes it"`
	SeenAmendments *int   `json:"seen_amendments,omitempty" jsonschema:"how many amendments the proposal had when you read it; the decision is refused with a conflict if it has more now, so read it again"`
}

type mcpAmendApprovalParams struct {
	InstanceID   string `json:"instance_id" jsonschema:"the Agency Instance the proposal belongs to"`
	ApprovalID   string `json:"approval_id" jsonschema:"the pending proposal to amend"`
	Summary      string `json:"summary,omitempty" jsonschema:"replaces the proposal's summary when given"`
	PayloadPatch string `json:"payload_patch,omitempty" jsonschema:"a JSON object as text, applied to the proposal's payload as a JSON merge patch (RFC 7386); a key sets or replaces a value and null removes it"`
}

func (d *Deps) registerApprovalMCPTools(server *mcp.Server) {
	mcp.AddTool(server, &mcp.Tool{Name: "agency_propose_write", Title: "Propose Write", Description: "Propose a write for an owner of the agency to approve: kind, summary and the payload as JSON text. Any member may propose; it starts pending."}, d.mcpProposeWrite)
	mcp.AddTool(server, &mcp.Tool{Name: "agency_list_approvals", Title: "List Approvals", Description: "List an agency's proposals, newest first, optionally by status (pending, approved, refused)."}, d.mcpListApprovals)
	mcp.AddTool(server, &mcp.Tool{Name: "agency_get_approval", Title: "Get Approval", Description: "Read one proposal by id with everything its log is built from: the draft (proposed_by, proposed_at), each amendment, the decision (decided_by, decided_at, reason) and, when approved, the patched payload and the patch, and the steps taken after approving (applied: a JSON list of at, by and step)."}, d.mcpGetApproval)
	mcp.AddTool(server, &mcp.Tool{Name: "agency_decide_approval", Title: "Decide Approval", Description: "Owner only: approve or refuse a pending proposal. When approving, an optional payload_patch (a JSON object as text) changes values in the proposal's payload at that moment as a JSON merge patch; the approval then carries the patched payload and the patch. An agent is refused."}, d.mcpDecideApproval)
	mcp.AddTool(server, &mcp.Tool{Name: "agency_amend_approval", Title: "Amend Approval", Description: "Change a proposal that is still pending, keeping its id: an optional new summary and an optional payload_patch (a JSON object as text, applied to the payload as a JSON merge patch). Only the proposer or an owner may amend; an approved or refused proposal is refused."}, d.mcpAmendApproval)
}

func (d *Deps) mcpProposeWrite(ctx context.Context, _ *mcp.CallToolRequest, p mcpProposeWriteParams) (*mcp.CallToolResult, approvals.Approval, error) {
	out, err := proposeApproval(ctx, d.Registry, p.InstanceID, p.Kind, p.Summary, p.Payload)
	if err != nil {
		return nil, approvals.Approval{}, err
	}
	return textResult("Proposed %s %q (%s), pending", out.Kind, out.Summary, out.ID), out, nil
}

func (d *Deps) mcpListApprovals(ctx context.Context, _ *mcp.CallToolRequest, p mcpListApprovalsParams) (*mcp.CallToolResult, agencymcp.ListResult[approvals.Approval], error) {
	out, err := listApprovals(ctx, d.Registry, p.InstanceID, p.Status)
	if err != nil {
		return nil, agencymcp.ListResult[approvals.Approval]{}, err
	}
	return textResult("Found %d approval(s)", len(out)), agencymcp.ListResult[approvals.Approval]{Items: out}, nil
}

func (d *Deps) mcpGetApproval(ctx context.Context, _ *mcp.CallToolRequest, p mcpGetApprovalParams) (*mcp.CallToolResult, approvals.Approval, error) {
	out, err := getApproval(ctx, d.Registry, p.InstanceID, p.ApprovalID)
	if err != nil {
		return nil, approvals.Approval{}, err
	}
	return textResult("%s %q (%s)", out.Status, out.Summary, out.ID), out, nil
}

func (d *Deps) mcpDecideApproval(ctx context.Context, _ *mcp.CallToolRequest, p mcpDecideApprovalParams) (*mcp.CallToolResult, approvals.Approval, error) {
	out, err := decideApproval(ctx, d.Registry, d.applyEnv(), p.InstanceID, p.ApprovalID, p.Decision, p.Reason, p.PayloadPatch, p.SeenAmendments)
	if err != nil {
		return nil, approvals.Approval{}, err
	}
	return textResult("%s %q (%s)", out.Status, out.Summary, out.ID), out, nil
}

func (d *Deps) mcpAmendApproval(ctx context.Context, _ *mcp.CallToolRequest, p mcpAmendApprovalParams) (*mcp.CallToolResult, approvals.Approval, error) {
	out, err := amendApproval(ctx, d.Registry, p.InstanceID, p.ApprovalID, p.Summary, p.PayloadPatch)
	if err != nil {
		return nil, approvals.Approval{}, err
	}
	return textResult("Amended %q (%s), still pending", out.Summary, out.ID), out, nil
}
