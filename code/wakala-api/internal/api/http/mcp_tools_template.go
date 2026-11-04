package http

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	catalog "wakalaserver/modules/catalog"

	"wakalaserver/internal/accounts"
	"wakalaserver/internal/templates"
)

const templateMintAction = "catalog.template.mint"

func (d *Deps) registerTemplateMCPTools(server *mcp.Server) {
	if d.Catalog == nil {
		return
	}
	mcp.AddTool(server, &mcp.Tool{
		Name:  "catalog_template_mint",
		Title: "Mint Agency Template",
		Description: "Mint one agency template into the catalog from its content alone — roles, goals, " +
			"objectives, workflows (each naming its objectives), work items, step RACI, controls (each optionally attached to one target; values and rules are no longer accepted, send them as controls) and enabled modules, each referenced by a " +
			"key you choose. The server mints every id, code and timestamp, wires the references, renders the " +
			"whole agency document in the import shape and stores it as a pending catalog entry, with the " +
			"readme, sales notes and module configs as its private parts. Send the content, never a rendered " +
			"document: this exists so a template need not be transcribed to be published. Refuses, naming every " +
			"problem at once, a key that is not declared, a workflow with no objective, a module the model's own catalog does not have, and anything missing the " +
			"prose that makes it usable.",
	}, d.mcpMintTemplate)
}

type mintTemplateResult struct {
	Slug          string `json:"slug"`
	Visibility    string `json:"visibility"`
	DocumentBytes int    `json:"document_bytes"`
	Roles         int    `json:"roles"`
	Goals         int    `json:"goals"`
	Objectives    int    `json:"objectives"`
	Workflows     int    `json:"workflows"`
	WorkItems     int    `json:"work_items"`
	Modules       int    `json:"modules_enabled"`
}

func (d *Deps) mcpMintTemplate(ctx context.Context, _ *mcp.CallToolRequest, spec templates.Spec) (*mcp.CallToolResult, mintTemplateResult, error) {
	if authorize := d.authorizer(catalogScope); authorize != nil {
		if err := authorize(ctx, templateMintAction); err != nil {
			return nil, mintTemplateResult{}, err
		}
	}
	if strings.TrimSpace(spec.Slug) == "" {
		return nil, mintTemplateResult{}, fmt.Errorf("slug must not be empty")
	}
	built, err := templates.Build(spec, time.Now())
	if err != nil {
		return nil, mintTemplateResult{}, err
	}

	entry, err := d.Catalog.CreateEntry(ctx, catalog.Entry{
		Slug:        spec.Slug,
		Name:        spec.Name,
		Summary:     spec.Summary,
		Doc:         string(built.Document),
		SubmittedBy: accounts.IDFromContext(ctx),
	})
	if err != nil {
		return nil, mintTemplateResult{}, err
	}

	private := catalog.EntryPrivate{Slug: spec.Slug, Readme: built.Readme, Sales: built.Sales}
	if len(built.ModuleConfigs) > 0 {
		private.ModuleConfigs = string(built.ModuleConfigs)
	}
	if private.Readme != "" || private.Sales != "" || private.ModuleConfigs != "" {
		if _, err := d.Catalog.PutPrivate(ctx, private); err != nil {
			return nil, mintTemplateResult{}, err
		}
	}

	out := mintTemplateResult{
		Slug:          entry.Slug,
		Visibility:    string(entry.Visibility),
		DocumentBytes: len(built.Document),
		Roles:         len(spec.Roles),
		Goals:         len(spec.Goals),
		Objectives:    len(spec.Objectives),
		Workflows:     len(spec.Workflows),
		WorkItems:     len(spec.WorkItems),
		Modules:       len(spec.Modules),
	}
	return textResult("Minted %q as %s — %d roles, %d goals, %d objectives, %d work items, %d modules, %d bytes of document",
		out.Slug, out.Visibility, out.Roles, out.Goals, out.Objectives, out.WorkItems, out.Modules, out.DocumentBytes), out, nil
}
