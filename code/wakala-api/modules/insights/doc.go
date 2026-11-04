// Package mwanachamainsights records insights — a short summary of a
// stretch of work, plus any repetitive tasks/friction ("challenges") and
// shortcut/tooling ideas ("suggestions") it surfaced — and InsightNotes,
// append-only follow-ups attached to an existing Insight so a later remark
// on the same topic extends it instead of duplicating its Summary. It
// exposes [InsightManager], the single interface for creating and reading
// both.
//
// # It names no domain, and that is the point
//
// Nothing here knows what an observation is about. It records that one was
// made. The rule is one sentence: a word that means something in one domain
// and nothing in another does not belong in this package. SubjectID passes
// it; AgencyID, which it used to be called, does not — a clinic has no
// agencies. One exception is deliberate and documented: Repo, which fails
// the rule but is a published argument of the live insight_create tool. See
// CLAUDE.md and requirements decision #19.
//
// A worked comparison — one store, two domains:
//
//	Insight       a working session's friction  |  a shift's repeated hand-off
//	InsightNote   another session confirming it |  another shift reporting it again
//	SubjectID     which agency it concerned     |  which ward
//	ContextID     which draft was open          |  (unused)
//
// # Storage
//
// The objects are declared in insights.blueprint.json and a domain spec
// names them; spec.Migrate creates a table per declared object, so there
// are no row structs and no AutoMigrate. The join between a declared column
// and a Go field is the field's name, put through specstore's rule:
// SubjectID is subject_id. Deliberately not the json tag, which is a
// presentation choice.
//
// Provision adopts a pre-conversion table set — the <instance>_<object>
// names GORM's AutoMigrate produced — including the agency_id and draft_id
// column renames, so existing rows are not orphaned by the move.
//
// Layout:
//   - models/     — the Insight/InsightNote types and the Source constants
//   - blueprint.go — the embedded blueprint and operations, and LoadSpec
//   - store.go     — the roles and the specstore wrappers
//   - validate.go  — the declared rules, and Check without a database
//   - patterns.go  — the named pattern registry, empty for now
//   - provision.go — spec.Migrate plus the legacy adoption
//   - insight.go, insightnote.go — InsightManager and its methods
//   - errors.go    — sentinel errors
//   - routes/      — the declared route table, and the MCP tool definitions
//   - mcp/         — registers those tools onto an MCP server
//   - cmd/ddl      — prints the DDL a spec would run
package mwanachamainsights
