# Register upkeep (W-1) walk

Run on 2026-11-07 in a cloud container, against a throwaway native Postgres 16 on `127.0.0.1:54322` with the repository's migration applied over a minimal stand-in `auth` schema.

| Check | Result |
|---|---|
| `POST /instances/import` of `demo/municipality.json` | 201 |
| Draft scope: workflows | 5 (W-1 to W-5) |
| Draft scope: work items | 33, including WI-1 to WI-5 of W-1 |
| `GET custody/custody-log`, `GET digitaltwin/nodes` | 200 |
| `go vet ./...` and `go test ./...` in `code/wakala-api`, `DATABASE_URL` set | no output from vet; no package failed |

Not covered: sign-in by emailed link (no sign-in service and no inbox here); the forms and catalog list addresses were not exercised; no work item was run by an agent.

Console walk: `code/console/src/journeys/walks/registerUpkeep.json`, 6 tests (one per step WI-1 to WI-5 and one in order), `npx vitest run src/journeys` 36 passed. Swapping the order of two steps in the agency file fails three of them. The five steps carry no role in the agency file, so the role per step is the console's fallback actor; the workflow is not yet complete.
