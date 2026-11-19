# Modules moved to sibling repositories

Each row is a hub module whose in-tree copy under `code/wakala-api/modules/<name>` was deleted and replaced by a tagged import of its sibling repository. The import path is `github.com/aosanya/mwanachama-backend-<name>`, required in `code/wakala-api/go.mod` at the tag shown, with no `replace` line.

| Module | Sibling repo | Tag | Date | Notes |
|---|---|---|---|---|
| auth (HUB6) | `mwanachama-backend-auth` | v0.1.0 | 2026-11-19 | Package name is `mwanachamaauth`, kept as the import alias everywhere; `models` is aliased `authmodels` and `routes` `authroutes` in the hub. The sibling's `routes_cover_test.go` equivalents live in the sibling. Hub-only wiring stays in the hub: `internal/api/http/auth_routes.go` (its own sign-in that sets the session cookie), `session_routes.go`, `member_signin.go`, `internal/session`, `internal/throttle`, `cmd/server`. Drift record: the sibling's `documentation/3. implementation/hub-import-drift.md`. |
| sources (HUB19) | `mwanachama-backend-sources` | v0.1.0 | 2026-11-19 | Package name is `sources`; the hub aliases it `mwanachamasources`, and `routes` and `mcp` as `sourcesroutes` and `sourcesmcp`. The hub's `routes/author_tool_test.go` (who signs a record) moved to the sibling. Hub-only wiring stays in the hub: `internal/api/http/sources_routes.go`, `mcp_sources_permissions.go`, `approvals_apply.go`, `internal/agencies` and `internal/accounts` (one manager per instance), and the `sources.*` entries of the permissions catalogue in `modules/agency`. Drift record: the sibling's `documentation/3. implementation/hub-import-drift.md`. |

## What to do when a sibling needs a change

Change the sibling, tag it, and raise the version in `code/wakala-api/go.mod` with `go get github.com/aosanya/mwanachama-backend-<name>@<tag>`. Never edit a module in the hub, and never add a `replace` line to a committed `go.mod`.
