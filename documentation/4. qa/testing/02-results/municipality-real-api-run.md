# Municipality real-API run

Run on 2026-11-07 in a cloud container with a native Postgres 16 on `127.0.0.1:54322` (a stand-in `auth` schema, the repository migrations applied, no Docker, no hosted project). The API was built from `code/wakala-api`. The console login was made with `POST /auth/credentials` and a session taken with `POST /auth/signin`, not an emailed link.

| Check | Result |
|---|---|
| First `POST /instances/import` of `demo/municipality.json` | 201, but 156 of 184 work items refused: a step with a role needs a kind |
| Fix | every step with a role now has `kind` fill_form and a one-question "done" form |
| Second `POST /instances/import` | 201, no errors; created 15 roles, 5 goals, 27 objectives, 33 workflows, 184 work items, 101 workflow objectives, 24 controls, 53 control attachments, 12 modules |
| Workflows read back from the draft | 33; the number of steps of every workflow equals the agency file |
| Steps with a role and a form read back | 156 |
| Console walk harness | 191 tests pass |
| Console suite | 3854 passed, 1 failed (`templates.test.ts`, the picker entry) |
| `go vet ./...` and `go test ./...` in `code/wakala-api` | clean |

The importer renumbers workflow and work item codes on import; steps were matched by workflow name. Sign-in by emailed link was not exercised.
