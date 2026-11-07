# Municipality workflows, batch of 2026-11-07 (cloud)

Run in a cloud container on a throwaway native Postgres 16 on `127.0.0.1:54322` with a stand-in `auth` schema.

| Check | Result |
|---|---|
| `demo/municipality.json` | 22 workflows (W-1 to W-5 and W-21, W-23, W-24, W-26, W-27, W-30, W-32, W-33, W-35 to W-38, W-40, W-42 to W-45), 124 work items, rule RU-AI-1, ids unique, no earlier entry removed or changed |
| Console walk tests | one file per new workflow, one test per step and one in order; the whole console suite: 3772 passed, 1 failed (`templates.test.ts`, the picker entry for the municipality, known) |
| `go vet ./... && go test ./...` in `code/wakala-api`, `DATABASE_URL` set | no output from vet; no package failed |

Not covered: the grown agency file was not re-imported through `POST /instances/import`, and sign-in by emailed link was not exercised (no sign-in service here), so no workflow is complete.
