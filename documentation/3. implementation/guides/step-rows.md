# Step rows: where the code is

How a workflow step adds, replaces or deletes a row (ISS-121). The design is
`documentation/2. design/step-rows.md`; this page says where it lives in
`code/wakala-api/internal/api/http` and how to test it.

## The files

| File | What it holds |
|---|---|
| `step_row_submit.go` | `submitRowStep`: the role gate, the row action, `requireCurrentRow`, the delete reason, the step send key |
| `step_runs.go` | `stepAnswersRequest.RowID`, the tool's `row_id`, the branch to `submitRowStep` before the chain of form steps, `rowStepStarts` for the `available` list |
| `record_rows.go` | `writeRow` (the one function both the direct route and the generated Add write through), `directAddClosedError`, `callerIsPlatformOwner`, `callerMayDoRowAction`, `liveRowsOf` reading retired rows |
| `caller_open_steps.go` | `generated`, `row_action` and `replaced_by` on an open step |
| `caller_sent_steps.go`, `caller_sent_row_steps.go` | `include_generated` and the generated runs of the Done read |
| `step_records.go` | `stepKeepsRecord` is false for a step with `row_record` |
| `record_mcp.go` | tool descriptions of the live record tools |
| `internal/reviewruns/workflows.go`, `workflows_reader.go` | a fix the reviewer offers for a step leaves out an empty `kind` and an empty `row_action`, which the sibling's tool schema refuses as values |

## Fields the app reads

| Where | Field |
|---|---|
| `GET /instances/{id}/my-open-steps` and the tool `agency_list_my_open_steps` | `generated` (true for a step of a generated workflow), `row_action` (`add`, `edit`, `delete`), `replaced_by` (a workflow code, hide the item when set), `record_code` and `state: start` with `available=true` |
| `POST /instances/{id}/steps/{stepID}/answers` and `agency_submit_step_answers` | request `row_id` (edit and delete); answer `row_id`, `record_code`, `done: true`, no `next_step` |
| `GET /instances/{id}/my-sent-steps` and `agency_list_my_sent_steps` | query and parameter `include_generated`; items carry `generated`, `row_action` |
| `GET /instances/{id}/live-records/{code}/rows?history=true` and `agency_list_live_record_rows` | retired rows with `deleted`, `deleted_by`, `deleted_reason`, `deleted_on` |
| `POST /instances/{id}/live-records/{code}/rows`, `agency_add_live_record_row` | 403 to residents and agents, naming `<record code>.add` |

The form of an Edit is the record's `questions` from `agency_list_live_records`,
filled from the row in `agency_list_live_record_rows`; a Delete answers
`Why is it removed`. A step's id comes from the open steps list.

## Tests

`step_rows_test.go` and `step_rows_harness_test.go`, on the memory backend
(`go test ./internal/api/http -run 'TestAn(Add|Edit)|TestADelete|TestAGenerated|TestTheSent|TestTheStart|TestTheDirect'`).
The harness `newRowStepWalk` makes a record with three roles (adding Coordinator,
editing Liaison, deleting Volunteer), publishes it so the sibling generates
`RC-n.add`, `.edit` and `.delete`, and sends their steps.

`stepRunWalk.available` leaves generated items out, since the older run tests
count only designed steps; `availableWithGenerated` returns all of them.

## Moving to a new agency release

A new sibling release changes the roster pin: `ROSTER_UPDATE=1 go test
./internal/api/http -run TestEveryMountConfigurationListsExactlyItsPinnedMCPTools`
rewrites the tool lists, and `pinnedRosterCounts` in `mcp_roster_pin_test.go`
follows by hand.
