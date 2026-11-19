# Modules moved to sibling repositories

A module listed here is no longer a folder under `code/wakala-api/modules`. The hub imports the sibling repository at a tag, with no `replace` line, and the hub keeps only the wiring around it (routes mounts, permission checks, per-agency managers, MCP tool registration).

| Module | Sibling repository | Tag | Moved on | Notes |
|---|---|---|---|---|
| `ratings` | `github.com/aosanya/mwanachama-backend-ratings` | v0.1.0 | 2026-11-19 | Private repository: `go` needs `GOPRIVATE=github.com/aosanya/*` and a token for `git` (see import-switch-plan.md, Private backends). The root package is named `mwanachamaratings`; the hub files import it as `mwanachamaratings` or `ratings`, and `routes` as `ratingsroutes`, through import aliases. The code is byte-identical to the hub copy apart from the import path. The three table-count pins of the sibling (`TestShippedExamplesCoexist`, `TestShippedExampleMigratesIdempotently`, `TestProvisionMigratesIdempotentlyAndRegistersEveryTable`) count the live tables and the `_test` twin of each; the hub holds no such pin. |
| `riskmanager` | `github.com/aosanya/mwanachama-backend-riskmanager` | v0.1.0 | 2026-11-19 | The root package is named `riskmanager`; the hub files import it as `mwanachamariskmanager` or `riskmanager`, and `models`, `routes` and `mcp` as `riskmodels`, `riskroutes` and `riskmcp` (or unaliased where the name is `models`). The sibling adds a folded `name_key` to a control: a unique partial index, one mutex around create and rename, and a unique violation answered as the conflict answer where the hub copy returned the raw database error on a rename. `Provision` fills the key of every control stored without one the first time it runs against an existing database; two controls whose names fold to the same key do not stop it: the earlier keeps the key, the later keeps an empty key until renamed, and a warning is logged. |

Each sibling lists every difference from the hub copy it replaced in its own `documentation/3. implementation/hub-import-drift.md`.

## What stays in the hub

| Module | Hub files |
|---|---|
| `ratings` | `cmd/server/ratings.go`; `internal/api/http/catalog_ratings_routes.go`, `serverwide_agency.go`, `deps.go`; `internal/accounts/router.go`; `internal/agencies/registry.go`, `record_writers.go`, `record_writers_ratings.go`; `internal/specs/wakala.ratings.json` |
| `riskmanager` | `internal/accounts/router.go`; `internal/agencies/registry.go`, `caches.go`, `test_copy.go`; `internal/api/http/risk_routes.go`, `operation_routes.go`, `risk_admission.go`, `membership.go`, `approvals_apply.go`, `approvals_apply_risk.go`, `mcp_tools_risk.go`; the `riskmanager.*` entries of `modules/agency/models/permissions_catalog.json` |
