# Modules moved to sibling repositories

Each row is a hub module whose in-tree copy under `code/wakala-api/modules/<name>` was deleted and replaced by a tagged import of its sibling repository. The import path is `github.com/aosanya/mwanachama-backend-<name>`, required in `code/wakala-api/go.mod` at the tag shown, with no `replace` line.

| Module | Sibling repo | Tag | Date | Notes |
|---|---|---|---|---|
| agency (HUB2) | `mwanachama-backend-agency` | v0.1.0 | 2026-11-19 | Package name is `mwanachamaagency`, kept as the import alias everywhere; `models`, `mcp` and `routes` are aliased `agencymodels`, `agencymcp` and `agencyroutes` in the hub. The repository is private, so a build outside a machine with access needs `GOPRIVATE=github.com/aosanya/mwanachama-backend-agency`. The sibling adds `ListInputSources` to `AgencyManager`, the calculating, posting and holding step kinds and the `FunctionCatalog`; a hub fake of the manager must carry the method. The permissions catalogue the hub loads is the sibling's `models/permissions_catalog.json`, embedded in the module. Hub-only wiring stays in the hub: `internal/agencies`, `internal/api/http` (agency routes, module switch, step runs, approvals, role permissions), `internal/reviewruns`, `internal/testruns`, `internal/accounts`, `internal/templates`, `cmd/server`. Drift record: the sibling's `documentation/3. implementation/hub-import-drift.md`. |

## What to do when a sibling needs a change

Change the sibling, tag it, and raise the version in `code/wakala-api/go.mod` with `go get github.com/aosanya/mwanachama-backend-<name>@<tag>`. Never edit a module in the hub, and never add a `replace` line to a committed `go.mod`.
