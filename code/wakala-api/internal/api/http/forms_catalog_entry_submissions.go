package http

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	catalog "wakalaserver/modules/catalog"
	formsmodels "wakalaserver/modules/forms/models"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/agencies"
)

const (
	entrySubmissionsAction   = "catalog.entry.submissions"
	entrySubmissionsToolName = "forms_catalog_entry_submissions_mine"
	entrySubmissionsPath     = formsCatalogInstancePrefix + "/entries/{slug}/submissions/mine"
)

type submissionLister interface {
	ListSubmissions(ctx context.Context, formID, memberID, periodKey, recordRowID string) ([]formsmodels.Submission, error)
}

func entrySubmissionsOf(ctx context.Context, entry catalog.Entry, forms submissionLister, memberID string) ([]formsmodels.Submission, error) {
	formID := catalog.FormIDOf(entry)
	if formID == "" {
		return []formsmodels.Submission{}, nil
	}
	sent, err := forms.ListSubmissions(ctx, formID, memberID, "", "")
	if err != nil {
		return nil, err
	}
	if sent == nil {
		sent = []formsmodels.Submission{}
	}
	return sent, nil
}

func (d *Deps) callersSubmissionsForEntry(ctx context.Context, instanceID, slug string) ([]formsmodels.Submission, error) {
	caller := accounts.IDFromContext(ctx)
	if caller == "" {
		return nil, agencies.ErrInstanceNotFound
	}
	role, err := d.Registry.RoleOf(ctx, instanceID, caller)
	if err != nil {
		return nil, err
	}
	if err := mustBeMounted(ctx, d.Registry, instanceID, "forms"); err != nil {
		return nil, err
	}
	if d.linkedAgentRefused(ctx, instanceID, entrySubmissionsAction) {
		return nil, agencies.ErrInstanceNotFound
	}
	cm, err := d.Registry.CatalogManager(ctx, instanceID, formsCatalogMount)
	if err != nil {
		return nil, err
	}
	var entry catalog.Entry
	if role == agencies.RoleOwner || role == agencies.RoleAgent {
		entry, err = cm.GetEntry(ctx, slug)
	} else {
		entry, err = cm.OpenEntry(ctx, slug, "")
	}
	if err != nil {
		return nil, err
	}
	fm, err := d.Registry.FormManager(ctx, instanceID)
	if err != nil {
		return nil, err
	}
	return entrySubmissionsOf(ctx, entry, fm, caller)
}

func (d *Deps) registerFormsCatalogEntrySubmissions(mux *http.ServeMux, auth callers) {
	mux.HandleFunc("GET "+entrySubmissionsPath, auth.require(func(w http.ResponseWriter, r *http.Request) {
		sent, err := d.callersSubmissionsForEntry(r.Context(), r.PathValue("instanceID"), r.PathValue("slug"))
		if err != nil {
			writeInstanceErr(w, err)
			return
		}
		writeJSON(w, http.StatusOK, sent)
	}))
}

func (d *Deps) registerFormsCatalogEntrySubmissionsTool(server *mcp.Server) {
	schema := withAgencyInstance(entrySubmissionsToolName, json.RawMessage(`{"type":"object","additionalProperties":false,"properties":{"slug":{"type":"string","description":"The catalogue entry, a service, whose form the submissions were sent on."}},"required":["slug"]}`), "The agency whose forms catalog this call reads.")
	server.AddTool(&mcp.Tool{
		Name:        entrySubmissionsToolName,
		Title:       "My submissions for a service",
		Description: "List the caller's own submissions to the form that applies for one catalogue entry (its form_id). An entry with no form_id returns an empty list.",
		InputSchema: schema,
	}, func(ctx context.Context, req *mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		instanceID, rest, err := splitFormsInstance(req.Params.Arguments)
		if err != nil {
			return toolError(err), nil
		}
		var args struct {
			Slug string `json:"slug"`
		}
		if err := json.Unmarshal(rest, &args); err != nil || args.Slug == "" {
			return toolError(catalog.ErrInvalidEntry), nil
		}
		sent, err := d.callersSubmissionsForEntry(ctx, instanceID, args.Slug)
		if err != nil {
			return toolError(err), nil
		}
		return toolValue(sent), nil
	})
}
