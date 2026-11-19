# Modules moved to sibling repositories

A module listed here is no longer a folder under `code/wakala-api/modules`. The hub imports the sibling repository at a tag, with no `replace` line, and the hub keeps only the wiring around it (routes mounts, permission checks, per-agency managers, MCP tool registration).

| Module | Sibling repository | Tag | Moved on | Notes |
|---|---|---|---|---|
| `actor` | `github.com/aosanya/mwanachama-backend-actor` | v0.1.0 | 2026-11-19 | The package is named `mwanachamaactor`, as the hub copy was; the subpackages are `models` and `routes`. The sibling refuses a malformed or an empty name before the plaintext check and treats a delegation whose `ends_at` is in the past as created and already ended, where the hub copy refused it. |
| `custody` | `github.com/aosanya/mwanachama-backend-custody` | v0.1.0 | 2026-11-19 | The package is named `mwanachamacustody`, where the hub copy was `custody`; the hub files that imported it as `custody` keep that name through an import alias. The error prefix is `mwanachamacustody:`. Publishing a consent text retries and numbers the next label from the highest `v<number>`; a duplicate consent version answers 409 and names the fields, where the hub copy answered 500. |

Each sibling lists every difference from the hub copy it replaced in its own `documentation/3. implementation/hub-import-drift.md`.

## What stays in the hub

| Module | Hub files |
|---|---|
| `actor` | `internal/api/http/step_approval_refusal.go`, `definition_role_kinds.go`, `resident_actor.go`, `membership.go`, `join_routes.go`, `mcp_visible.go`, `mcp_tool_actions.go`; `internal/agencies/approval_limits.go`, `registry.go`, `caches.go`; the actor entries of `modules/agency/models/permissions_catalog.json` |
| `custody` | `internal/api/http/custody_routes.go`, `operation_routes.go`, `mcp_tools_custody.go`, `mcp_audit_paper_consent.go`, `custody_consent_language.go`, `consent_required.go`, `resident_grants.go`; `internal/agencies/registry.go`, `caches.go`, `mounts.go`, `consent_gate.go`, `consent_withdrawal.go`, `earlier_withdrawals.go`; `internal/accounts/router.go`; the custody entries of `modules/agency/models/permissions_catalog.json` and `modules_catalog.json` |
