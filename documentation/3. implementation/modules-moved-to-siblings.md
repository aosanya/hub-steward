# Modules moved to sibling repositories

A module listed here is no longer a folder under `code/wakala-api/modules`. The hub imports the sibling repository at a tag, with no `replace` line, and the hub keeps only the wiring around it (routes mounts, permission checks, per-agency managers, MCP tool registration).

| Module | Sibling repository | Tag | Moved on | Notes |
|---|---|---|---|---|
| `taskmanager` | `github.com/aosanya/mwanachama-backend-taskmanager` | v0.1.0 | 2026-11-19 | The package is named `mwanachamataskmanager`; the hub files keep their aliases (`mwanachamataskmanager`, `taskmanager`, `taskmodels`, `taskmanagerroutes`). Tag v0.1.0 does not carry the hub-only behaviour that the sibling's `hub-import-drift.md` lists as rows 2 to 12: the `{"items": [...]}` answer of `GET /tasks`, the status a closing move sets, claim with a holder and lease, the add-todos and todo-finish tools, the single-backlog list, `skipped_limit`, the repeating-task due and last-job fields, the working clock starting at the latest claim, the shared-evidence-folder rule, and the RFC 3339 check of `due_at`. It adds project parties and a contract reference, which add a table and a column to the hub's database. |
| `accounting` | `github.com/aosanya/mwanachama-backend-accounting` | v0.1.0 | 2026-11-19 | The package is named `accounting`, as before. The sibling has no tool filter and no MCP registration, so these stay in the hub as `internal/accountingtools` (`BuildTools`, `RegisterResolvedTools`, with the tool tests that came with them). The sibling lacks the version check on a budget line: `accounting_budget_set` and `accounting_budget_delete` take no `version`, and the delete answers the removed `Budget` (operation `withdraw_budget`) where the hub answered the removed `BudgetLine`. The upward report carries `recipient`, `recipient_record_row_id` and `reference`. |

Each sibling lists every difference from the hub copy it replaced in its own `documentation/3. implementation/hub-import-drift.md`.

## What stays in the hub

| Module | Hub files |
|---|---|
| `taskmanager` | The importers under `internal/api/http` (`taskmanager_routes.go`, `mcp_tools_taskmanager.go`, `taskmanager_case_progress.go`, `step_role_board.go`, `group_role_access.go`, `membership.go`, `publish_promises.go`, `promise_outcome_route.go`, `form_case_landing.go`), `internal/agencies` (`registry.go`, `caches.go`, `backlog_roles.go`, `case_threads.go`, `case_notices.go`, `step_limit.go`, `ask_run.go`, `ask_closed.go`) and `internal/accounts/router.go`; the taskmanager entries of `modules/agency/models/permissions_catalog.json`; the pinned roster under `internal/api/http/testdata/mcp_roster`. The two app tests that read the module's operations file and `models/task.go` take them from the module cache through `code/app/src/shared/testing/taskmanagerModule.ts`. |
| `accounting` | `internal/accountingtools` (tool allowlist and MCP registration), `internal/api/http/accounting_routes.go`, `mcp_accounting_tools.go`; `internal/agencies` (`record_writers_accounting.go`, `late_bills_sweep.go`, `record_writers.go`, `caches.go`, `registry.go`); the accounting entries of `modules/agency/models/permissions_catalog.json`; the pinned roster. |

## What to do when a sibling needs a change

Change the sibling, tag it, and raise the version in `code/wakala-api/go.mod` with `go get github.com/aosanya/mwanachama-backend-<name>@<tag>`. Never edit a module in the hub, and never add a `replace` line to a committed `go.mod`.
