# 02 · Results

The latest result of each suite, as a run printed it. Every earlier Go run below is on the in-memory store, with no Postgres. A "known open defect" is a test written on purpose to fail until its defect is fixed.

## Run in this repository on 2026-11-04

These are the only results anyone can reproduce from this repository.

| Suite | Where | Result | Page |
|---|---|---|---|
| Console | `code/console` | As of 2026-11-04: 3640 tests in 251 files passed, 0 failed; the build passes | [Console tests](console-tests.md) |
| Phone app | `code/app` | As of 2026-11-04: 1905 tests in 124 files passed, 0 failed; the build passes | [App tests](app-tests.md) |
| API server | `code/wakala-api` | Builds and vets clean; on 2026-11-04 none of its 96 packages had a test file, so nothing was tested. On 2026-11-12 the repo holds 541 `_test.go` files; the run of 2026-11-04 found none | [API server tests](api-tests.md) |
| Municipality import (superseded) | `demo/municipality.json` | Imports on the local database (201); custody, digitaltwin and engage mount | [Municipality import](municipality-import.md); superseded by the 2026-11-08 run below |
| Municipality import, 2026-11-08 | `demo/municipality.json` at `42c8ed8` | Imports (201) but W-19, W-20, W-29 and W-31 have no steps: 25 items lack a `kind` | [Municipality import, 2026-11-08](municipality-import-2026-11-08.md) |

## Municipality runs of 2026-11-07

Run in cloud containers on a native Postgres at `127.0.0.1:54322`, never a hosted project.

| Suite | Where | Result | Page |
|---|---|---|---|
| Municipality workflows, batch | `demo/municipality.json` | 22 workflows and 124 work items; console suite 3772 passed, 1 failed (`templates.test.ts`, known) | [Workflows batch](municipality-workflows-batch.md) |
| Municipality workflows, batch 2 | `demo/municipality.json` | 31 workflows and 172 work items; console suite 3840 passed, 1 failed (`templates.test.ts`); the run against the real API and the import of the grown agency were not exercised | [Workflows batch 2](municipality-workflows-batch-2.md) |
| Municipality real-API run | `demo/municipality.json` | First import 201, but 156 of 184 work items refused: a step with a role needs a kind | [Real-API run](municipality-real-api-run.md) |
| Municipality whole-file import, cloud run 5 | `demo/municipality.json` | Imports (201) with 34 workflows and 190 work items; console 3861 passed, 1 failed (`templates.test.ts`) | [Wave 5](municipality-wave-5-real-api-run.md) |
| Municipality risk module import | `demo/municipality.json` at `bce4144` | Mount `riskmanager` at `risks`, roles R-13 and R-14 with `risk.read` | [Risk module import](municipality-risk-module-import.md) |
| Municipality risk module, live walk | `demo/municipality.json` | Moments 1 and 2 pass, 3 passes with a manual step, 4 passes for the data with no pack screen | [Risk live walk](municipality-risk-live-walk.md) |
| Register upkeep (W-1) walk | `demo/municipality.json` | Import 201; W-1 to W-5 in the draft; 6 walk tests | [Register upkeep](register-upkeep.md) |

## Earlier results, from the Mwanachama repositories

Everything below was produced in the Mwanachama platform's own repositories, before its modules were copied here. These numbers were not produced in this repository, so they cannot be reproduced here and they say nothing about the copy; on 2026-11-12 `code/wakala-api` holds 541 `_test.go` files, whose results are not recorded here.

| What | Command | Result |
|---|---|---|
| The planned Siaya lab as an agency file | the agency import | 0 import errors, 0 issues |
| Journey 19, Change a rule, console walk | the journey 19 walk | 12 tests pass; the journey is not complete |
| Siaya farmers end to end through the Mwanachama API router | the Go test in `internal/api/http` | Passes the owner's order, payments, correction, send and call-off; three tests stay red for the seated Group coordinator |
| Mwanachama API, the whole `internal/api/http` package | `go test -count=1 -json ./internal/api/http` | 1227 tests and 91 subtests; 1224 passed and 3 failed, each a known open defect. 265 s on a quiet machine; under heavy load the default 10-minute timeout is too short, so use `-timeout 30m` |
| Mwanachama API self-test: group leaders' records | `make self-test` | 41 of 41 checks passed |
| Mwanachama API self-test: published results and promise outcomes | `make self-test` | 42 of 42 checks passed, including residents and strangers refused and an unknown outcome refused |
| Mwanachama API self-test: two-group form send | `make self-test` | 24 of 24 checks passed; the count of people reads 1 |
| Mwanachama API self-test: notification rules | `make self-test` | 51 of 51 checks passed |
| Mwanachama API self-test: a decline's notice | `make self-test` | 23 of 23 checks passed, including another resident, a group leader and an invented id refused |
| Mwanachama API self-test: the asset manager per lab | `make self-test` | 10 of 10 checks passed, including a stranger refused on REST and MCP |
| Member app journeys | `go test ./internal/api/http -run 'TestJourney[0-9]'`, and the member app's `make check` | 127 of 128 Go journey tests pass, the one failure a known open defect; `make check` passes with 716 of 716 Vitest tests |
| Operator studio (now the console) journeys | the studio's committed journey tests in Go and Vitest | Go 30 of 34 passed and Vitest 98 of 126 passed with 16 left to do; every failure is a known open defect |
| Operator console, whole suite | `npx vitest run` and `npm run typecheck` | 239 files and 3486 tests passed; 1 file failed (`library.test.ts`, which reads a sibling repo); typecheck clean |
| Member app, Inbox shows a refused Join, Decline or Mark all read | `vitest run src/inbox src/pages/started`, and the typecheck | 146 tests passed; typecheck clean |
| Digital twin, actor, task manager, comm, forms, voting, sources, git | `go test ./... -count=1` in each | All packages passed |
| Catalog | `go test ./... -count=1` | 29 failures, each a known open defect |
| Market | `go vet ./...` and `go test -count=1 ./...` | Vet clean; both packages with tests pass |

The Mwanachama API's full self-test has failing checks in scenarios unrelated to Hub Steward.

## Not covered

Nothing below has a result. Where a row above says "passed", it did not cover these.

| What | Why |
|---|---|
| A live stack | No walk is recorded against a shared hosted database |
| The full live walk | The live preflight and the group-order live walk have no recorded run |
| Postgres | Every earlier Go run above uses the in-memory store |
| The other demo agencies | The only agency import recorded above is the Siaya lab; the other seven have no result on this page |
| A real model | No suite calls Muse Spark or any model, and the agent's reply loop and its fake-based tests are planned, not in this repository. The three-language answers and the "I don't know" case in the test plan have no recorded run |
| The permissions gate in production | The Siaya Farmers' Group has never been published, so the production gate has not been switched on or tried |
| The phone app on a device, and WhatsApp | Only the app's Vitest and walk tests were run |

The agent has no recorded run against a real model, and the demo walk-through the test plan describes has no recorded run.
