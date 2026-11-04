package mcp

import (
	"context"
	_ "embed"
	"strings"

	"github.com/modelcontextprotocol/go-sdk/mcp"
	"wakalaserver/modules/shared/mcpui"
)

// dashboardUIResourceURI is the ui:// resource agency_get_agency,
// agency_list_roles, and agency_list_goals all link to via Meta (MCP Apps
// extension, SEP-1865): whichever of the three an agent calls first, the
// host renders the same View — a home menu of actions (Add/View Role,
// Add/View Goal, General Information) rather than three separate
// single-purpose widgets. A host that doesn't understand _meta.ui (Claude
// Code, most non-Apps clients) just ignores it and shows the tool's raw
// JSON as always.
const dashboardUIResourceURI = "ui://wakala/dashboard"

// dashboardUIType classifies this View for a UI Apps host like
// wakala-studio, via a custom "wakala/type" _meta key — ui.resourceUri
// itself (SEP-1865) only signals "this tool opens a View", not where a
// host should place it. "shortcut" marks a persistent action panel a host
// should keep pinned (e.g. its sidebar) rather than opening a fresh
// instance inline per tool call; a future one-off View (e.g. a
// toast-style alert) would carry "notification" here instead.
const dashboardUIType = "shortcut"

// dashboardUIMeta is the MCP Apps ui: linking (SEP-1865), plus
// dashboardUIType, shared by every tool that opens the dashboard View.
var dashboardUIMeta = mcp.Meta{
	"ui":          map[string]any{"resourceUri": dashboardUIResourceURI},
	"wakala/type": dashboardUIType,
}

// registerDashboardUI adds the dashboard View as an MCP resource.
func registerDashboardUI(server *mcp.Server) {
	server.AddResource(&mcp.Resource{
		URI:      dashboardUIResourceURI,
		Name:     "agency-dashboard",
		Title:    "Agency Dashboard",
		MIMEType: dashboardUIMimeType,
	}, func(_ context.Context, _ *mcp.ReadResourceRequest) (*mcp.ReadResourceResult, error) {
		return &mcp.ReadResourceResult{
			Contents: []*mcp.ResourceContents{{
				URI:      dashboardUIResourceURI,
				MIMEType: dashboardUIMimeType,
				Text:     dashboardUIHTML,
			}},
		}, nil
	})
}

// dashboardUIMimeType is fixed by the MCP Apps spec — a host looks for
// exactly this value to know a resource is a renderable View, not an
// ordinary HTML document.
const dashboardUIMimeType = "text/html;profile=mcp-app"

// dashboardUIPage is a self-contained View: no build step, no npm
// dependency — this repo has no JS toolchain, so a hand-rolled
// postMessage/JSON-RPC client (per SEP-1865's wire protocol) is less
// machinery than wiring one in. It's a small client-side router over one
// menu and three sections (General/Roles/Goals), each fetching its own
// data on demand via tools/call rather than trusting whichever tool's
// result happened to trigger the render — all three entry tools take
// instance_id, so the initial ui/notifications/tool-input notification is
// enough to drive every section regardless of which one opened the View.
// Kept in dashboard_ui.html, not inline, so it can be edited as plain
// HTML/CSS/JS rather than a Go string literal. It carries no styling of
// its own — dashboardUIHTML below splices in mcpui.ThemeCSS, the visual
// design system shared with every other MCP dashboard in this workspace.
//
//go:embed dashboard_ui.html
var dashboardUIPage string

// dashboardUIHTML is dashboardUIPage with mcpui.ThemeCSS spliced in as a
// <style> block right after <meta charset>, so this View renders with the
// same look as mwanachama-wakala-studio (and any other repo's MCP
// dashboard) without duplicating the palette/typography/component rules
// here. Computed once at package init — cheap string work, not a
// per-request cost.
var dashboardUIHTML = strings.Replace(
	dashboardUIPage,
	`<meta charset="utf-8">`,
	`<meta charset="utf-8">`+"\n<style>"+mcpui.ThemeCSS+"</style>",
	1,
)
