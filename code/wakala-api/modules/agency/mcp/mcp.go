// Package mcp exposes this module's acts as Model Context Protocol tools.
//
// The per-entity tools are not written here: they come from
// agency.operations.json through mwanachama-backend-shared/dispatch, with
// each field's prose read off agency.blueprint.json, so a tool and its HTTP
// address say the same thing because they are the same declaration. What
// stays hand-written is what a single operation cannot express — the
// composite that builds a whole design in one call, the static type
// glossary, the inverse capability listing, and the dashboard.
//
// Every tool takes the instance it operates on: one mount serves many
// Agencies, so the manager is resolved per call through a ManagerResolver
// and the tool is rebuilt against it.
package mcp

import (
	"context"
	"fmt"

	"github.com/modelcontextprotocol/go-sdk/mcp"

	mwanachamaagency "wakalaserver/modules/agency"
	"wakalaserver/modules/shared/dispatch"
)

// ManagerResolver turns a caller-supplied id into the AgencyManager that id
// names. How the id is interpreted is entirely the mounting host's
// decision — a single-Agency host can ignore it and always return the same
// manager; a multi-Agency host (e.g. mwanachama-wakala-api's own Registry)
// resolves it per call.
type ManagerResolver func(ctx context.Context, id string) (mwanachamaagency.AgencyManager, error)

func RegisterTools(server *mcp.Server, resolve ManagerResolver) {
	RegisterToolsAs(server, resolve, nil)
}

func RegisterToolsAs(server *mcp.Server, resolve ManagerResolver, caller dispatch.Caller) {
	if err := registerDeclaredTools(server, resolve, caller); err != nil {
		panic(fmt.Sprintf("agency tools: %v", err))
	}
	registerCompositeTools(server, resolve)
	registerCatalogTools(server)
	registerDashboardUI(server)
}

// ListResult wraps a List/Match tool's slice: MCP's spec defines
// CallToolResult.structuredContent as a JSON object, and the go-sdk
// otherwise serializes a bare slice return type directly into it — a shape
// a schema-strict client rejects even though the go-sdk's own test client
// tolerates it. Every List/Match tool in this package returns one of
// these, never a bare slice.
type ListResult[T any] struct {
	Items []T `json:"items" jsonschema:"the matching items"`
}

// DeleteResult is the result shape for a tool wrapping a manager method
// that returns only an error (Delete*/Remove*) — AddTool needs some result
// type, and a bare bool reads clearly on the wire.
type DeleteResult struct {
	Deleted bool `json:"deleted"`
}

// instanceOnlyParams is the params shape for a tool needing only which
// Agency to act on — e.g. agency_get_agency.
type instanceOnlyParams struct {
	InstanceID string `json:"instance_id" jsonschema:"which Agency this operates on, as resolved by the mounting host"`
}

// instanceAndDraftParams is the params shape for a List call scoped to a
// Draft — every Goal/Workflow/WorkItem/Role/RoleAssignment row belongs to
// one (AGD-006), so DraftID always names a real Draft.
type instanceAndDraftParams struct {
	InstanceID string `json:"instance_id" jsonschema:"which Agency this operates on, as resolved by the mounting host"`
	DraftID    string `json:"draft_id" jsonschema:"the Draft to scope to"`
}

// summary builds a *mcp.CallToolResult carrying a one-line human-readable
// sentence as its Content, in place of the go-sdk's default behavior of
// JSON-dumping the whole return value there. StructuredContent is
// unaffected either way — the go-sdk always fills it from the handler's
// actual typed return value, regardless of what Content this produces — so
// this only changes what a human (or an LLM) reading the call log sees,
// never what a programmatic caller reads back. Only ever worth calling on
// a tool's success path: the go-sdk discards whatever *mcp.CallToolResult
// a handler returned the moment it also returns a non-nil error, replacing
// it with its own error-shaped result — so an error path can keep
// returning nil here exactly as before.
func summary(format string, args ...any) *mcp.CallToolResult {
	return &mcp.CallToolResult{Content: []mcp.Content{&mcp.TextContent{Text: fmt.Sprintf(format, args...)}}}
}

// summaryWithContext behaves like summary, but appends a second Content
// block after the human-readable summary line: plain text meant for an
// LLM's own conversation context, not a human reading a call log — e.g. a
// dashboard tool's caller (mwanachama-wakala-studio's native shortcuts
// panel) folds this straight into the chat transcript so the model can act
// on data it never itself asked a tool for. Always plain text, never the
// dashboard's ui:// HTML resource. contextText is built by the caller from
// explicit, named fields (see e.g. raci.go's rolesContextText) rather than
// a blind struct/JSON dump, so leaving a field out of an LLM's context
// later is just editing that call site, not this helper.
func summaryWithContext(summaryText, contextText string) *mcp.CallToolResult {
	return &mcp.CallToolResult{Content: []mcp.Content{
		&mcp.TextContent{Text: summaryText},
		&mcp.TextContent{Text: contextText},
	}}
}
