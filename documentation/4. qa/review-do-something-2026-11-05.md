# Review aid: the Do Something change, 5 November 2026

Nothing here is committed or staged. `git status` in `projects/hub-steward` lists 25 modified or renamed paths and 17 new ones, all on top of `e5a1bb0`. The design is in [do-something-own-steps.md](../2.%20design/technical-spec/do-something-own-steps.md); the owner's requirement is that each member sees only the steps their role is named on, Send moves the workflow to the next role's step, and it works for any `fill_form` step in any agency.

## Run results

| Check | Where | Result |
|---|---|---|
| `go build ./...` and `go vet ./...` | `code/wakala-api` | clean |
| `go test -count=1 -race ./cmd/server/ ./internal/api/http/` | `code/wakala-api` | both packages `ok`; 21 top-level tests passed, 0 failed (the http package took 74.5 s under `-race`) |
| `go test ./...` | `code/wakala-api` | only those two packages have tests; no `FAIL` anywhere |
| `npx tsc --noEmit` | `code/app` | clean |
| `npx vitest run` | `code/app` | 128 files, 1949 tests passed |
| `npx tsc --noEmit` | `code/console` | clean |
| `npx vitest run src/data/modelUsage.test.ts src/pages/limits/UsageBlock.test.tsx` | `code/console` | 2 files, 44 tests passed (the other two console files were run by the HS980/981 lane: 251 files, 3642 tests) |

Not run: the app's `vite build` (the app lane reported it succeeding), and nothing was run against a live stack. Photo and file answers cannot be sent from the phone.

## Files that were still changing

Lanes take-up-HS752 and take-up-HS731 edit `mwanachama-wakala-api`, not `projects/hub-steward`, so no file in the groups 1 to 5 below changed while this page was written. The files in the "Other repos" section marked (live) are being edited by those lanes and by other sessions; their lists will move.

## 1. wakala-api: the role-checked step API

Files in `code/wakala-api/internal/api/http/`. Tests: `step_runs_test.go`, `step_runs_harness_test.go` (new), run under the group 6 results.

| Path | What changed |
|---|---|
| `step_runs.go` (new) | Role-checked submit of a `fill_form` step: 403 for a role the workflow does not name, 409 for a second Send, one run per order, the next role's step appears only after Send. REST `/instances/{id}/steps/{stepId}/answers` and the MCP tool. |
| `step_records.go` (new) | One register per form step. Steps with the same title in one workflow get their own names ("Check", "Check (2)"). |
| `caller_open_steps.go` | `agency_list_my_open_steps` returns `available: true` for the step a member may act on now. |
| `definition_role_kinds.go`, `seated_may.go` | Which role kinds and seats count as named on a step. |
| `mcp.go`, `mcp_actions.go`, `router.go` | One line each: the new tool and the new route registered. |
| `step_runs_titles_test.go` (new) | Same-titled steps get separate registers (was `step_runs_verify_test.go`). |

## 2. wakala-api: concurrent Send and multi-select

| Path | What changed |
|---|---|
| `step_runs.go` | A lock per instance and run around "is the run waiting for this step?" and the row save: simultaneous Sends give one 201 and the rest 409. |
| `step_runs_concurrent_test.go` (new) | Four simultaneous sends over 12 rounds; fails without the lock, passes under `-race`. |
| `step_runs_multiselect_test.go` (new) | A list or a joined string is accepted for a multi-select question and saved joined by ", "; 400 for an option the question does not offer or for a list given to a question that is not multi-select. |

## 3. wakala-api: the empty-database fix (HS1019)

| Path | What changed |
|---|---|
| `cmd/server/sqlite_dsn.go` (new) | `sqliteDSN(path)`: keeps a given path, otherwise a uniquely named shared in-memory database, so every pooled connection sees the same tables. |
| `cmd/server/main.go` | One edit: opens the database through `sqliteDSN`. |
| `cmd/server/sqlite_dsn_test.go` (new) | Fails with `no such table: agency_instances (1)` if the plain `:memory:` DSN is put back. |

The running server on the owner's machine still has the bug until it is restarted; `WAKALA_SQLITE_PATH` also avoids it.

## 4. Phone app: Do Something shows a member's own steps

Files in `code/app/`. Tests: 1949 pass.

| Path | What changed |
|---|---|
| `src/steps/` (new folder) | The step page (form, Send, Sent), the API adapter, the question list, and the Sent record kept per agency and per run, with tests. |
| `src/forms/QuestionInput.tsx` (new) | The question control, extracted from `AnswerPage.tsx` so both pages share it. |
| `src/pages/forms/AnswerPage.tsx` | Uses `QuestionInput`; 63 lines removed. |
| `src/home/StartRows.tsx`, `src/coordinator/start/api.ts` | Start rows come from the member's available steps; Sent rows show beside the first step; the old group-order screen is chosen by the form name "Create group order", not by its question types. |
| `src/App.tsx`, `src/routes.ts`, `src/routes.test.tsx` | The step route. |
| `src/home/homeStart.test.tsx`, `src/home/startMemberSteps.test.tsx` (new) | Start list tests, including two members. |
| `src/journeys/walk18.ts` renamed to `walk18.test-support.ts`, `src/journeys/runGroupOrder.walk.test.tsx` | The HS531 rename so the sample-data scan skips the file (staged by `git mv`; the only staged change). |
| `README.md` | The Sent rules. |

## 5. Documentation in this repo

| Path | What changed |
|---|---|
| `CHANGELOG.md` | Two 5 November lines: phone app and bundled API. |
| `documentation/2. design/technical-spec/do-something-own-steps.md` (new) | The design record, with what exists and what is not built. |
| `documentation/2. design/technical-spec/README.md` | Link to it. |
| `documentation/2. design/technical-spec/04-tools-and-apis/README.md` | The "Form steps" section: errors, one Send per run, the lock, multi-select. |

## 6. Not part of the Do Something work, in this repo

| Path | What changed | Why apart |
|---|---|---|
| `code/console/src/data/modelUsage.ts`, `modelUsage.test.ts`, `usageBreakdown.ts`, `src/pages/limits/UsageBlock.tsx`, `UsageBlock.test.tsx`, `public/i18n.json` | HS981 and HS980: a "Not tied to an AI role" row on an account's Usage tab, and the new `connection_test` kind in six languages | Belongs with the `mwanachama-backend-ai` change below; commit apart |

## Other repos changed in this session (paths only)

`mwanachama-backend-ai` (HS980, tests pass): `ai.blueprint.json`, `ai.operations.json`, `documentation/2. design/usage-breakdown.md`, `models/usage_day.go`, `probe.go`, `probe_test.go`, `probe_usage_test.go` (new).

`mwanachama-wakala-api`, session-related: `scripts/staging-env.sh` and `internal/api/http/staging_origins_test.go` (new) for HS1002 (the phone app's origin allowed after a restart); `documentation/2. design/ai-mount.md`, `internal/accounts/router.go`, `internal/agencies/registry.go`, `internal/agencies/rooms.go`, `internal/api/http/comm_routes.go`, `mcp_tools_market.go`, `module_mounts.go`, `router.go`, `module_tools.go` (new), `module_tools_test.go` (new), `standing_general.go` (new) are being edited by the HS731 and HS752 lanes or other sessions (live). `internal/api/http/market_revision_settles_test.go` was already modified by someone else. An untracked file named `server` sits in the repo root and looks like a built binary; do not commit it.

`meta-global-ai-hackathon-community-hubs` (the hub repo), clips: `.claude/skills/short-clips/`, `.claude/skills/make-social-videos/` (new), `hackathon/socialvideos/` (24 clip folders, `register.md`, `README.md`, `1.ReadyForStudio/`), `hackathon/social-posts.md` (new).
Hub repo, documentation: `documentation/3. implementation/` (`todo.md`, `test-runner.md`, `agency-test-method.md`), `documentation/1. requirements/decisions.md`, `documentation/2. design/app/02-do-something/do-something.html` and `_generator/pages_do_something.py` (screen 7, HS566, live), `submission/documentation/06-user-journeys/` (13, 14, 16, 18, 21; HS609), `submission/documentation/07-diary/README.md`.
`hackathon/socialvideos/co-operative-officers/clip.json` shows as deleted: check it before committing.

## Suggested commits

Nothing below has been run.

1. **hub-steward: Do Something shows each member their own steps** (API)
   `code/wakala-api/internal/api/http/{step_runs.go, step_records.go, caller_open_steps.go, definition_role_kinds.go, seated_may.go, mcp.go, mcp_actions.go, router.go, step_runs_test.go, step_runs_harness_test.go, step_runs_titles_test.go, step_runs_concurrent_test.go, step_runs_multiselect_test.go}`
2. **hub-steward: phone app step page, Send and Sent**
   `code/app/src/steps/`, `code/app/src/forms/QuestionInput.tsx`, `code/app/src/pages/forms/AnswerPage.tsx`, `code/app/src/home/{StartRows.tsx, homeStart.test.tsx, startMemberSteps.test.tsx}`, `code/app/src/coordinator/start/api.ts`, `code/app/src/{App.tsx, routes.ts, routes.test.tsx}`, `code/app/README.md`
3. **hub-steward: rename walk18 so the sample-data scan skips it** (staged already)
   `code/app/src/journeys/walk18.test-support.ts`, `code/app/src/journeys/runGroupOrder.walk.test.tsx`
4. **hub-steward: wakala-api opens one shared in-memory database when no path is set**
   `code/wakala-api/cmd/server/{main.go, sqlite_dsn.go, sqlite_dsn_test.go}`
5. **hub-steward: document the Do Something change**
   `CHANGELOG.md`, `documentation/2. design/technical-spec/{do-something-own-steps.md, README.md, 04-tools-and-apis/README.md}`, this page
6. **hub-steward console: Usage counts for Test connection and unowned use** (with the `mwanachama-backend-ai` commit of the same name)
   `code/console/src/data/{modelUsage.ts, modelUsage.test.ts, usageBreakdown.ts}`, `code/console/src/pages/limits/{UsageBlock.tsx, UsageBlock.test.tsx}`, `code/console/public/i18n.json`

Commits 1 to 3 fit one commit if the owner prefers; 1 and 2 should land together because the app calls the new route. The separate `mwanachama-wakala-api` and `submission/code` copies of the app and API change have not been made and need the owner's say.
