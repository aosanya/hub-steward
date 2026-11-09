# Tests

Status

- The agency backend has no scenario, block or run object, and no `agency_*scenario*` tool (open; `mwanachama-backend-agency/agency.blueprint.json`).
- Add a block offers four kinds (fill a form, send form, notify, say yes or no) while workflows have Route and Run another workflow too, so a path through Group order cannot be mirrored (closed by decision 84: a scenario's blocks are the workflow's steps and none is added by hand; `test-blocks.html` is removed).
- A test run's first screen counts five blocks for sending below the minimum; the workflow's Notify step is drawn by the Group coordinator, not as Send-then-ask (open; `test-run.html` screen 1).
- Test copies exist for every declared object of every spec-based module, not only the market (closed on 2026-10-29: `mwanachama-backend-shared/spec/migrate.go` `Migrate`, primary key `(run_id, key)`, every index led by `run_id`). What is still missing is a runner that writes into them: nothing outside `spec/` uses a twin (open; see test-runs.md). Cost of the doubling: turned into Q89.


Log

## 2026-10-29 14:05 UTC

First run. Read the workflow and test pages, the agency, catalog and forms blueprints and operations, wakala-api's market tools and tests, and the studio and member routes. The market module repo is not checked out, so its side is unread.

## 2026-10-29 20:40 UTC

Read the engine's test-copy code (shared `spec/migrate.go`, `declared-domains.md`). The earlier bullet saying test copies are market-only was wrong: every declared object of every spec-based module gets a twin. Q89 added on what the twins cost.
