# API server tests

The bundled API server in `code/wakala-api`, vetted and tested on 2026-11-04. No Postgres was started and no `.env` was read; the server has no test that needs either.

## What was run

| Step | Command (in `code/wakala-api`) | Result |
|---|---|---|
| Build | `go build ./...` | Succeeds |
| Vet | `go vet ./...` | Exit 0, no findings |
| Test | `go test ./...` | Exit 0; 96 packages listed, every one `[no test files]` |

Go 1.27.3 on darwin/arm64; `go.mod` asks for Go 1.25.

## Counts

| Measure | Count |
|---|---|
| Packages | 96 |
| Packages with test files | 0 |
| `_test.go` files under `code/wakala-api` on 2026-11-04 | 0 |
| `_test.go` files under `code/wakala-api` on 2026-11-12 | 541 |
| Tests passed | 0 |
| Tests failed | 0 |
| Tests skipped | 0 |

On 2026-11-12 the repo holds 541 `_test.go` files; this page records a run of 2026-11-04 that found none. No failure lines exist because no test ran in that run. `go test` exits 0 here because nothing was asked to pass, not because anything was checked.

## What this does and does not cover

It covers that every package compiles and that `go vet` finds nothing in them. That includes the `internal/api/http` package, which holds the routes both apps use, and the modules the broader agency scope relies on: agency, actor, permissions, catalog, comm, forms, market, ai, assetmanager, riskmanager, taskmanager.

It does not cover behaviour. Nothing in this repository tests an agency import, a role or permission check, a workflow publish, an approval, a form send, a market order, a model call or an MCP tool. The same is true of the lab and of the other seven demo agencies.

## A difference from the results page

[Results](README.md) records `go test` numbers for `internal/api/http` (1227 tests), `make self-test` checks, and journey tests. Those were run in the Mwanachama repositories. This repository's trimmed copy of the server holds none of those test files and no `make self-test`. The numbers on that page therefore cannot be reproduced from this repository.

## Left open

| What | State |
|---|---|
| Tests for the bundled API in this repository | None exist; whether to copy the Mwanachama tests in, or write new ones, is not decided |
| The front ends | `code/console` and `code/app` hold 375 test files between them; they were not run in this pass |
