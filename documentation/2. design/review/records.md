# Records

Status

- The catalog already has an object named `record` (subject_id, holder_id, scope_id) that is not the design's record; two meanings of one word (open; `mwanachama-backend-catalog/catalog.blueprint.json`).
- A Payments row as a catalog `entry` needs a slug and a document; changing an approved entry's document returns it to pending, so a corrected amount would go back for approval (open; `catalog.entry.upsert` description).
- Which role approves a row is not drawn; `catalog.entry.set_visibility` is the approving action (open).
- The paid mark already exists on the forms `submission` (`paid_at`, `paid_by`) and on the market order: three homes for paid (closed on 2026-10-29, decision 90).
- The rows of a record kept as catalog entries are found by a document path with no index in the shipped declarations (see `indexes.md` 14). Open.
- Stale entry correction: a record is now a real agency draft object with rows, `agency_create_record_row`/`agency_list_record_rows` and app routes `live-records/{code}/rows` (`mwanachama-wakala-api/internal/api/http/record_rows.go`); the catalog-entry route above is no longer how rows are kept. The first three bullets above describe the older plan (open for the catalog; superseded for the Payments row).
- A row has no order on it, so Manage payments for one order cannot be told from another's (turned into Q95; `agency.blueprint.json` `record_row`).
- A saved row cannot be corrected, removed or protected from a double press; the agency declares create and list only (turned into Q96).
- Opening Manage payments loads every publication with its whole document, then queries each draft in turn, then filters the farmer's own rows in memory (`record_rows.go` `draftsOfEveryPublication`, `listLiveRecordRows`); build finding, see `performance.md`.
- Rows are added by the agency owner or by the person seated in the record's role: `callerMayAddRows` in `record_rows.go` passes for owner membership, or for an agent membership whose seat (`AgencyRoleOf`) is `record.RoleID` or a role with the same code. The same check decides who reads every row; anyone else reads only the rows that name them (`rowNames`) and cannot add. The route stamps the row with `record.RoleID` and the agency module refuses a row whose role is not the record's (`CreateRecordRow`). Closed by the seated-role change (wakala-api commit c9c1293); the earlier finding that only the owner could add is withdrawn.

- A payment row can name any member of the agency, not only a farmer in the order (`record_rows.go` `namesAStranger`, `rowNames`); the row has no order to check against. Turned into Q100.

- Who sees rows (workflow-records.html, commit 8b2c508) is stored as `viewer_role_id` and carried by the scan, the document and the hash, but `liveRowsOf` never reads it; a row is shown to a person it names or to the adder, so a role chosen in the studio changes nothing (turned into Q152; `mwanachama-wakala-api/internal/api/http/record_rows.go`). Open.

Log
- The Add payment picker offers every actor of the agency whatever the question's `options_from` says (`payment-new.tsx` line 42, `ListActors`); the list name is never resolved. Turned into Q100 (entry 57 in `app-gaps.md`).

## 2026-10-29 14:05 UTC

First run. Read the workflow and test pages, the agency, catalog and forms blueprints and operations, wakala-api's market tools and tests, and the studio and member routes. The market module repo is not checked out, so its side is unread.

## 2026-10-29 16:15 UTC

Checked the catalog declarations for a path index a record's rows could use.

## 2026-10-30 02:40 UTC

Traced record rows end to end (blueprint, `record_impl.go`, `record_rows.go`, `record_rows_test.go`). Opened Q95 and Q96.

## 2026-10-30 08:42 UTC

Read the row-add route against the Payments question. Opened the stranger-name gap; turned into Q100.

## 2026-11-01 20:30 UTC

Re-read the row-add rule in `record_rows.go` (`callerMayAddRows`, `sameAgencyRole`, `liveRowsOf`) and the agency `CreateRecordRow` role check for the journey 18 redraw. The person seated in the record's role adds and reads every row as the owner does; the owner-only finding is withdrawn.

## 2026-11-04 02:40 UTC

Followed `options_from` from the demo record (`"Farmer"`) to the built picker; it is a free string nobody resolves. Added one bullet.

## 2026-11-07 16:35 UTC

Traced the new Who sees rows field from the studio page to the row read. Stored and published, never applied by the API. Turned into Q152.
