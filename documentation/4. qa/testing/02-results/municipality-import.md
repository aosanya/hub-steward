# Municipality import

Run on 2026-11-07 on this laptop: `demo/municipality.json` posted to `POST /instances/import` of the API built from `code/wakala-api`, running against the local Supabase database (`127.0.0.1:54322`), never a hosted project.

| Check | Result |
|---|---|
| `POST /instances/import` | 201; created 12 roles, 5 goals, 21 objectives, 5 workflows, 33 work items, 22 workflow objectives, 21 controls, 23 control attachments, 11 modules |
| `GET /instances/<id>/custody/custody-log` | 200, `{"entries":[]}` |
| `GET /instances/<id>/digitaltwin/nodes` | 200, `[]` |
| `GET /instances/<id>/engage/notices/unread` | 200, `{"count":0}` |
| `go vet ./... && go test ./...` in `code/wakala-api` | no output from vet; no package failed |

The agency switches on thirteen modules; the importer reports eleven created, the two it counts as always present (auth, git) being locked. The three modules that were missing before this run (custody, digitaltwin, engage) now mount.

Not covered: no workflow of the municipality was run end to end, and no work item was run by an agent.
