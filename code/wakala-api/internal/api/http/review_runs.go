package http

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
	"wakalaserver/internal/reviewruns"
)

var (
	errReviewDraftMissing = errors.New("Name the draft to review")
	errReviewNotServed    = errors.New("Reviews are not served by this server")
)

type ReviewRunner interface {
	Start(ctx context.Context, instanceID, draftID, startedBy, area string) (reviewruns.Page, error)
	Resume(ctx context.Context) error
}

type reviewRunRequest struct {
	DraftID string `json:"draft_id"`
	Area    string `json:"area"`
}

func (d *Deps) registerReviewRunRoutes(mux *http.ServeMux, auth callers) {
	mux.HandleFunc("POST /instances/{instanceID}/review-runs", auth.require(d.postReviewRun))
}

func (d *Deps) postReviewRun(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	instanceID := r.PathValue("instanceID")
	caller := accounts.IDFromContext(ctx)
	role, err := d.Registry.RoleOf(ctx, instanceID, caller)
	if caller == "" || err != nil || (role != agencies.RoleOwner && role != agencies.RoleAgent) {
		writeErr(w, http.StatusNotFound, agencies.ErrInstanceNotFound.Error())
		return
	}
	var req reviewRunRequest
	if err := readJSON(r, &req); err != nil || strings.TrimSpace(req.DraftID) == "" {
		writeErr(w, http.StatusBadRequest, errReviewDraftMissing.Error())
		return
	}
	page, err := d.startReview(ctx, instanceID, strings.TrimSpace(req.DraftID), caller, strings.TrimSpace(req.Area))
	if err != nil {
		writeErr(w, reviewRefusalStatus(err), err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, page)
}

func (d *Deps) startReview(ctx context.Context, instanceID, draftID, startedBy, area string) (reviewruns.Page, error) {
	if d.Reviews == nil {
		return reviewruns.Page{}, errReviewNotServed
	}
	return d.Reviews.Start(ctx, instanceID, draftID, startedBy, area)
}

func reviewRefusalStatus(err error) int {
	switch {
	case errors.Is(err, reviewruns.ErrReviewAlreadyRuns):
		return http.StatusConflict
	case errors.Is(err, reviewruns.ErrNoDefaultAccount):
		return http.StatusUnprocessableEntity
	case errors.Is(err, errReviewNotServed):
		return http.StatusNotImplemented
	}
	return http.StatusInternalServerError
}

type mcpRunReviewParams struct {
	InstanceID string `json:"instance_id" jsonschema:"the Agency Instance whose draft is reviewed"`
	DraftID    string `json:"draft_id" jsonschema:"the draft to review"`
	Area       string `json:"area,omitempty" jsonschema:"the one part to review: profile, goals, objectives, roles_agents, workflows, risks or tests; leave out to review every part"`
}

func (d *Deps) registerReviewRunMCPTools(server *mcp.Server) {
	mcp.AddTool(server, &mcp.Tool{Name: "agency_run_review", Title: "Run review", Description: "Start a review of one draft, or of one part of it when area is given, and answer at once with the review and its parts, all reading. The reviewers run in the background on the hub's default AI account; read the result with agency_get_review. Refused with a plain sentence when no default AI account is set or when a review of the draft is already running."}, d.mcpRunReview)
}

func (d *Deps) mcpRunReview(ctx context.Context, _ *mcp.CallToolRequest, p mcpRunReviewParams) (*mcp.CallToolResult, reviewruns.Page, error) {
	caller := accounts.IDFromContext(ctx)
	role, err := d.Registry.RoleOf(ctx, p.InstanceID, caller)
	if caller == "" || err != nil || (role != agencies.RoleOwner && role != agencies.RoleAgent) {
		return nil, reviewruns.Page{}, agencies.ErrInstanceNotFound
	}
	if strings.TrimSpace(p.DraftID) == "" {
		return nil, reviewruns.Page{}, errReviewDraftMissing
	}
	page, err := d.startReview(ctx, p.InstanceID, strings.TrimSpace(p.DraftID), caller, strings.TrimSpace(p.Area))
	if err != nil {
		return nil, reviewruns.Page{}, err
	}
	return textResult("Started review %s of draft %s", page.Review.ID, p.DraftID), page, nil
}
