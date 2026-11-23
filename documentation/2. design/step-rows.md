# A workflow step adds, replaces or deletes a record's row (ISS-121)

Status, 2026-11-23: built in the hub (worktree `iss121-steprows`, not yet
committed) on the agency sibling `mwanachama-backend-agency` v0.1.3. The first
version of this page, written for todo TD-5747, was a plan; this version says
what the code does. The tap-by-tap build notes are in
`documentation/3. implementation/guides/step-rows.md`; the sibling's own design
is `workflow-records.md` in that repository (sections Row steps, Retiring a
row, Generated workflows).

Sources: IAS owner decision 15 (2026-11-22), decision 16 and its refinement
(2026-11-23). Everything that changes data is a workflow, even a single step.
For each record there is Add (a one-step workflow whose form is the record's
questions and whose answer writes a row), Edit (started with a row id; its
answer writes a row that replaces it, answers prefilled by the app) and Delete
(started with a row id and a reason; the row leaves the live list and history
keeps it).

## What the sibling gives (v0.1.3)

| Piece | Field or call |
|---|---|
| A step that writes a row | `WorkItem.RowRecord` (a record code) and `RowAction` (`add`, `edit`, `delete`); a `fill_form` step, the only step of its workflow |
| Who may act | The record's `RoleID` for add; `EditRoleID` for edit and `DeleteRoleID` for delete, else `RoleID` (`Record.RoleOfRowAction`) |
| Generated workflows | Every live record has `<record code>.add`, `.edit` and `.delete`, one step each coded `<workflow code>.1`; `Workflow.Generated`, `GeneratedFor`, `ReplacedBy`; made on fork, import and publish; the publish guard refuses an agency without them |
| Stand-ins | `Record.AddReplacedBy`, `EditReplacedBy`, `DeleteReplacedBy` name a designed workflow; the generated one stays |
| Names | `Record.ItemName`: the generated workflows read `Add a tender`, `Edit a tender`, `Delete a tender` |
| Retire a row | `RetireRecordRow(ctx, rowID, deletedBy, reason)`, tool `agency_retire_record_row`; sets `Deleted`, `DeletedBy`, `DeletedReason`, `DeletedOn`; `RecordRowFilter.IncludeRetired` reads them |
| The delete form | One required question, `models.DeleteReasonPrompt` (`Why is it removed`) |

## What the hub does

### The step answer

`POST /instances/{id}/steps/{stepID}/answers` and the tool
`agency_submit_step_answers` take an optional `row_id`. A step with `row_record`
is answered by `submitRowStep` (`step_row_submit.go`), before the chain of
form steps is read:

| `row_action` | Needs | Writes | Answer's `row_id` |
|---|---|---|---|
| `add` | the record's questions as answers; no `row_id` | one row of the record with no `order_id`, through `writeRow` (the code the direct add route uses: `namesAStranger`, the run check, `withChosenDetails`, `CreateRecordRow`) | the new row |
| `edit` | `row_id` of a current row of the record, every question answered again | a replacing row (`Replaces` is the row, the sibling keeps its order id); the client prefills the form from the live rows list | the replacing row |
| `delete` | `row_id` of a current row of the record, the answer to `Why is it removed` and nothing else | `RetireRecordRow` with the caller and the reason | the retired row |

A current row is a row of the record, in the agency's versions, that is not
replaced and not retired (`requireCurrentRow`), so an edit or delete cannot
reach a row of another record, a retired row or an older version of an edited
row. The answer carries `done: true`, no `next_step` and no `order_id`. A row
step takes no `order_id` and no `another_sheet` (400). A `send_key` makes the
row refuse a second send as already sent (409); without one, two adds never
collide. Unknown answers, a missing required answer or a blank reason are 400.

### Who may start and act

`callerMayDoRowAction`: the platform owner always; a resident or agent who holds
the record's role for the action, directly or through a group seat. So an edit
is the editing role's, a delete the deleting role's, and both fall back to the
adding role when the record names none. The adding role does not edit when the
record names another editing role. Refusal is 403. A record whose
`<action>_replaced_by` names a designed workflow still runs its generated
workflow for anyone who may, so the designed workflow can call it; the app only
hides it from Start.

### The run

A generated run completes the moment its one step is sent and never waits: the
answer is `done`, there is no `next_step`, and no `waiting` item exists for it,
so nothing appears in To do or Needs you. Rows of a generated run carry no
`order_id`, so no Ongoing read finds one either. `agency_list_my_sent_steps`
(Done) leaves generated runs out unless `include_generated=true` (route query
and tool parameter): then each row the caller added through Add, replaced
through Edit or retired through Delete is listed with the generated step, the
workflow name, `generated: true` and `row_action` (the retire's time and reason
stand in for the sent time and answers).

### The lists

`agency_list_my_open_steps` (plain and `available=true`, route
`GET /instances/{id}/my-open-steps`) lists a step of a generated workflow like
any other the caller holds, with `generated: true`, `row_action` and
`replaced_by` (the code of the designed workflow that stands in for it). The
`available` list holds each row step as `state: start` with `record_code` and
`row_action`, after the designed steps, ordered by record and then add, edit,
delete. The app lists the Add workflows first and leaves out the ones with a
`replaced_by`. The platform owner holds no role, so the owner's lists stay
empty as for every step; the owner acts on a step by its id.

### The rows

`liveRowsOf` (`GET /instances/{id}/live-records/{code}/rows`,
`agency_list_live_record_rows`) reads rows with retired ones included, so a row
that replaced another and was then retired still hides the older version. The
current list leaves out replaced and retired rows; `history=true` lists the
replaced rows and the retired rows (`deleted: true`, `deleted_by`,
`deleted_reason`, `deleted_on`). The sibling's default `ListRecordRows` hides
retired rows for every other reader.

### Closed doors

`POST /instances/{id}/live-records/{code}/rows` and the tool
`agency_add_live_record_row` are refused to residents and agents with 403 and
the words `Use Add a tender to add a tender`, built from the generated
workflow's name as Start lists it and leaving the record code out. A post that
sets `replaces` is a correction and names the Edit workflow the same way
(`Use Edit a tender to edit a tender`). The JSON error carries `error` (the
sentence) and `workflow` (the name), `workflow_code` (for example `RC-1.add`)
and `action` (`add`, `edit` or `delete`), so the app can offer a button that
starts that workflow; the tool refusal carries the sentence only. The direct
routes have no delete path, so `delete` is never sent yet. The platform owner
keeps both. The generated Add workflow writes
through the same function. `can_add_rows` in `agency_list_live_records` still
says the caller holds the adding role, which is now what lets them run the
generated Add. The agency design surface (`POST /record-rows`, `POST
/record-rows/{row_id}/retire`, tools `agency_create_record_row` and
`agency_retire_record_row`) was already closed to residents (they are not
members of it) and is closed to an agent without the permission.

### Records and publishing

`stepKeepsRecord` is false for a step that carries `row_record`, so publishing
derives no record from a generated step (the sibling refuses `CreateRecord` for
one) and `recordKeptByStep` does not count it.

## Not built

- A run of a generated workflow started on the taskmanager run board
  (`POST .../taskmanager/workflow-runs/start` with the workflow code) is a plain
  board run: it starts, and nothing sends it. Only the step answer route above
  completes a generated run.
- The Done read lists a row once per generated step that matches, so a row
  that the caller added and also retired appears twice with the same `row_id`
  (as Add and as Delete); paging with `after` stops at the first.
- Rows the platform owner adds through the direct route appear in an `include_generated` Done list of the owner as Add runs.

## Decisions kept from the plan

- An Add run's `order_id` stays empty (owner, 2026-11-22).
- A retire records `deleted_by`, `deleted_reason` and `deleted_on` on the row and
  writes no separate audit entry (owner, 2026-11-22).
- A generated workflow's role gate is the record's, with the owner always
  allowed (decision 16).
