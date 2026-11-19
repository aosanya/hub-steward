# Modules moved to sibling repositories

A module listed here is no longer a folder under `code/wakala-api/modules`. The hub imports the sibling repository at a tag, with no `replace` line, and the hub keeps only the wiring around it (routes mounts, permission checks, per-agency managers, MCP tool registration).

| Module | Sibling repository | Tag | Moved on | Notes |
|---|---|---|---|---|
| `actor` | `github.com/aosanya/mwanachama-backend-actor` | v0.1.0 | 2026-11-19 | The package is named `mwanachamaactor`, as the hub copy was; the subpackages are `models` and `routes`. The sibling refuses a malformed or an empty name before the plaintext check and treats a delegation whose `ends_at` is in the past as created and already ended, where the hub copy refused it. |
| `custody` | `github.com/aosanya/mwanachama-backend-custody` | v0.1.0 | 2026-11-19 | The package is named `mwanachamacustody`, where the hub copy was `custody`; the hub files that imported it as `custody` keep that name through an import alias. The error prefix is `mwanachamacustody:`. Publishing a consent text retries and numbers the next label from the highest `v<number>`; a duplicate consent version answers 409 and names the fields, where the hub copy answered 500. |
| `ai` | `github.com/aosanya/mwanachama-backend-ai` | v0.1.0 | 2026-11-19 | Imported under the aliases the hub already used (`ai`, `mwanachamaai`, `aimodels`, `airoutes`). The sibling carries the `connection_test` usage kind the hub copy lacked, so a working Test connection click counts as one `connection_test` request in the usage breakdown. The sibling's `mcp` package is not used; the hub builds its AI tools in `internal/api/http/mcp_tools_ai.go`. |
| `assetmanager` | `github.com/aosanya/mwanachama-backend-assetmanager` | v0.1.0 | 2026-11-19 | The package is named `mwanachamaassetmanager`, so the hub imports it under that alias (and under `assetmanager` in one file). Asset updates take `models.AssetUpdate` with an optional `version`, as before; the sibling adds the refusal of a serial tag race (`ErrAssetSerialTagExists`). |

Each sibling lists every difference from the hub copy it replaced in its own `documentation/3. implementation/hub-import-drift.md`.

## What stays in the hub

| Module | Hub files |
|---|---|
| `actor` | `internal/api/http/step_approval_refusal.go`, `definition_role_kinds.go`, `resident_actor.go`, `membership.go`, `join_routes.go`, `mcp_visible.go`, `mcp_tool_actions.go`; `internal/agencies/approval_limits.go`, `registry.go`, `caches.go`; the actor entries of `modules/agency/models/permissions_catalog.json` |
| `custody` | `internal/api/http/custody_routes.go`, `operation_routes.go`, `mcp_tools_custody.go`, `mcp_audit_paper_consent.go`, `custody_consent_language.go`, `consent_required.go`, `resident_grants.go`; `internal/agencies/registry.go`, `caches.go`, `mounts.go`, `consent_gate.go`, `consent_withdrawal.go`, `earlier_withdrawals.go`; `internal/accounts/router.go`; the custody entries of `modules/agency/models/permissions_catalog.json` and `modules_catalog.json` |
Each row is a hub module whose in-tree copy under `code/wakala-api/modules/<name>` was deleted and replaced by a tagged import of its sibling repository. The import path is `github.com/aosanya/mwanachama-backend-<name>`, required in `code/wakala-api/go.mod` at the tag shown, with no `replace` line.

| Module | Sibling repo | Tag | Date | Notes |
|---|---|---|---|---|
| agency (HUB2) | `mwanachama-backend-agency` | v0.1.0 | 2026-11-19 | Package name is `mwanachamaagency`, kept as the import alias everywhere; `models`, `mcp` and `routes` are aliased `agencymodels`, `agencymcp` and `agencyroutes` in the hub. The repository is private, so a build outside a machine with access needs `GOPRIVATE=github.com/aosanya/mwanachama-backend-agency`. The sibling adds `ListInputSources` to `AgencyManager`, the calculating, posting and holding step kinds and the `FunctionCatalog`; a hub fake of the manager must carry the method. The permissions catalogue the hub loads is the sibling's `models/permissions_catalog.json`, embedded in the module. Hub-only wiring stays in the hub: `internal/agencies`, `internal/api/http` (agency routes, module switch, step runs, approvals, role permissions), `internal/reviewruns`, `internal/testruns`, `internal/accounts`, `internal/templates`, `cmd/server`. Drift record: the sibling's `documentation/3. implementation/hub-import-drift.md`. |
| auth (HUB6) | `mwanachama-backend-auth` | v0.1.0 | 2026-11-19 | Package name is `mwanachamaauth`, kept as the import alias everywhere; `models` is aliased `authmodels` and `routes` `authroutes` in the hub. The sibling's `routes_cover_test.go` equivalents live in the sibling. Hub-only wiring stays in the hub: `internal/api/http/auth_routes.go` (its own sign-in that sets the session cookie), `session_routes.go`, `member_signin.go`, `internal/session`, `internal/throttle`, `cmd/server`. Drift record: the sibling's `documentation/3. implementation/hub-import-drift.md`. |
| sources (HUB19) | `mwanachama-backend-sources` | v0.1.0 | 2026-11-19 | Package name is `sources`; the hub aliases it `mwanachamasources`, and `routes` and `mcp` as `sourcesroutes` and `sourcesmcp`. The hub's `routes/author_tool_test.go` (who signs a record) moved to the sibling. Hub-only wiring stays in the hub: `internal/api/http/sources_routes.go`, `mcp_sources_permissions.go`, `approvals_apply.go`, `internal/agencies` and `internal/accounts` (one manager per instance), and the `sources.*` entries of the permissions catalogue in `modules/agency`. Drift record: the sibling's `documentation/3. implementation/hub-import-drift.md`. |

## What to do when a sibling needs a change

Change the sibling, tag it, and raise the version in `code/wakala-api/go.mod` with `go get github.com/aosanya/mwanachama-backend-<name>@<tag>`. Never edit a module in the hub, and never add a `replace` line to a committed `go.mod`.
| `ai` | `internal/api/http/ai_routes.go`, `ai_chat_stamp.go`, `ai_manager.go`, `ai_parts.go`, `ai_gateway.go`, `ai_base_policy.go`, `mcp_tools_ai.go`, `mcp_visible.go`; the AI entries of `modules/agency/models/permissions_catalog.json`; `internal/testruns`, `internal/reviewruns`, `internal/agencies` as callers |
| `assetmanager` | `internal/api/http/assetmanager_routes.go`, `mcp_assets_permissions.go`, `mcp.go`, `mcp_tool_actions.go`, `change_permissions.go`, `membership.go`; `internal/agencies/assetmanager_spec.go`, `registry.go`, `caches.go`; the entries of `modules/agency/models/modules_catalog.json` and `permissions_catalog.json` |

## Shared version

Both siblings require `mwanachama-backend-shared` v0.3.0. The hub requires v0.3.1, which the module graph selects, so the siblings and the hub's other imports read one copy of shared.
