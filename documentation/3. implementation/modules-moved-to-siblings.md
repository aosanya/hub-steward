# Modules moved to sibling repositories

A module listed here is no longer a folder under `code/wakala-api/modules`. The hub imports the sibling repository at a tag, with no `replace` line, and the hub keeps only the wiring around it (routes mounts, permission checks, per-agency managers, MCP tool registration).

| Module | Sibling repository | Tag | Moved on | Notes |
|---|---|---|---|---|
| `ai` | `github.com/aosanya/mwanachama-backend-ai` | v0.1.0 | 2026-11-19 | Imported under the aliases the hub already used (`ai`, `mwanachamaai`, `aimodels`, `airoutes`). The sibling carries the `connection_test` usage kind the hub copy lacked, so a working Test connection click counts as one `connection_test` request in the usage breakdown. The sibling's `mcp` package is not used; the hub builds its AI tools in `internal/api/http/mcp_tools_ai.go`. |
| `assetmanager` | `github.com/aosanya/mwanachama-backend-assetmanager` | v0.1.0 | 2026-11-19 | The package is named `mwanachamaassetmanager`, so the hub imports it under that alias (and under `assetmanager` in one file). Asset updates take `models.AssetUpdate` with an optional `version`, as before; the sibling adds the refusal of a serial tag race (`ErrAssetSerialTagExists`). |

Each sibling lists every difference from the hub copy it replaced in its own `documentation/3. implementation/hub-import-drift.md`.

## What stays in the hub

| Module | Hub files |
|---|---|
| `ai` | `internal/api/http/ai_routes.go`, `ai_chat_stamp.go`, `ai_manager.go`, `ai_parts.go`, `ai_gateway.go`, `ai_base_policy.go`, `mcp_tools_ai.go`, `mcp_visible.go`; the AI entries of `modules/agency/models/permissions_catalog.json`; `internal/testruns`, `internal/reviewruns`, `internal/agencies` as callers |
| `assetmanager` | `internal/api/http/assetmanager_routes.go`, `mcp_assets_permissions.go`, `mcp.go`, `mcp_tool_actions.go`, `change_permissions.go`, `membership.go`; `internal/agencies/assetmanager_spec.go`, `registry.go`, `caches.go`; the entries of `modules/agency/models/modules_catalog.json` and `permissions_catalog.json` |

## Shared version

Both siblings require `mwanachama-backend-shared` v0.3.0. The hub requires v0.3.1, which the module graph selects, so the siblings and the hub's other imports read one copy of shared.
