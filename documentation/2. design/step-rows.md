# A workflow step adds, replaces or deletes a record's row (ISS-121)

Status, 2026-11-22: first version, written for todo TD-5747. Read from the code
at hub `dev` (worktree `iss121-steprows`) and the agency sibling
`mwanachama-backend-agency` v0.1.3-0.20261121113016-620e1116a2f9, the version
`code/wakala-api/go.mod` pins. Nothing was run on the memory backend for this
page: every claim below is read from the files named, with line numbers.

Source: IAS owner decision 15 (2026-11-22). Everything that changes data is a
workflow, even a single step. For each record there is Add (a one-step workflow
whose form is the record's questions and whose answer writes a row), Edit
(started with a row id; its answer writes a row that replaces it, answers
prefilled) and Delete (started with a row id and a reason; the row leaves the
live list and history keeps it). All three are held by the record's adding role,
the rule `callerMayAddRows` already holds.

## Answer in short

| Kind | Can a step do it today? | What is missing | Where |
|---|---|---|---|
| Add a row of a named record | No. A step writes only the record the platform derives from its own title. The live add route writes any record that no step keeps, but it is not a step. | A step has no field that names a record. | Sibling (new field) and hub |
| Edit (replace a given row) | No on the step path. Yes on the live add route: it takes `replaces` and the sibling keeps the order id. | The step path takes no row id and writes no `Replaces`; a step has no way to name its record. | Sibling (new field) and hub |
| Delete | No, anywhere. | The sibling has no way to retire one row: `Deleted` is forced false on create, no update or delete method for a row exists, and no listing reads the flag. | Sibling (new operation) and hub |

The agency sibling must change, so it must be tagged, which only the owner may do.
No hub-only way to declare the step exists that is not a hack (see Alternatives).

## What exists today

### How a step's answer becomes a row

`submitStepAnswers` (`internal/api/http/step_runs.go:375-466`):

1. The step is found in the live draft; it must take answers (`stepTakesAnswers`,
   `step_routing.go:54-56`: kinds fill_form and send_form) and the caller must
   hold its role (`step_runs.go:396`, `stepActorRoleID` `step_routing.go:47-52`).
2. The step's record is not named by the step. The workflow's form steps are
   turned into records by title: `stepRecordNames` (`step_records.go:23-43`) gives
   each form step a record name (its title, with `(2)` for repeats in one
   workflow) and `recordOfStep` (`step_records.go:45-54`) finds the record of the
   same workflow and name. `ensureStepRecords` (`step_records.go:61-92`) creates
   that record at publish and updates its role, form and questions to the step's.
   `WorkItem` (sibling `models/workitem.go:5-48`) has no record id or code.
3. Answers are keyed by the record's question prompts (`resolveStepAnswers`,
   `step_runs.go:80-107`; multi-select as a list or a `; `-joined string),
   stamped prompts are refused (`refuseStampedPrompts`), address `place_refs` are
   checked (`checkedPlaceRefs`), an amount above a limit is flagged
   (`refuseAmountAboveLimit`), and an approval step adds the stamp
   (`step_runs.go:408-433`).
4. The run: `order_id` empty on the chain's first step makes a new run id,
   `firstRunID` (`step_runs.go:481-487`, a stable uuid when `send_key` is given),
   and later steps must name the run and be the next one waiting
   (`runForSubmit`, `step_runs.go:501-525`).
5. `CreateRecordRow` is called with `DraftID`, `RecordID`, `RoleID` (the record's
   role), `AddedBy`, `Answers`, `PlaceRefs`, `OrderID` and `SendKey`
   (`step_runs.go:442-446`). The literal has no `Replaces`, and
   `stepAnswersRequest` (`step_runs.go:63-70`) has no field that could carry one.
   `ErrStepAlreadySent` becomes `errStepNotWaiting` (409).

A run exists only as rows carrying one `order_id`: `runsOf`
(`step_runs.go:268-309`) reads the rows of every step record of the workflow and
groups them by `order_id`, skipping rows with `row.Deleted` (line 281; that flag
is never true, see below).

### How the live record route writes a row

`addLiveRow` (`record_rows.go:388-434`, route `POST /instances/{id}/live-records/{code}/rows`
`record_rows.go:203-208`, tool `agency_add_live_record_row`):

- the caller must pass `callerMayAddRows` (`record_rows.go:473-475` calling
  `callerIsOwnerOrHolds`, `record_rows.go:481-501`: owner, or an agent or
  resident who holds the record's role, directly or through a group seat);
- a record that a step keeps is refused, `errRowKeptByStep` (403):
  `recordKeptByStep` (`record_rows.go:188-201`) is true when the record's
  workflow has a form step whose derived record name is the record's;
- answers naming a person or asset outside the agency are refused
  (`namesAStranger`, `record_rows.go:515-532`), the register details the owner
  chose are applied (`withChosenDetails`, `record_details_allowance.go:59`, which
  the step path does not call), and `order_id`, when given, must be a run of the
  record's workflow or a group order (`rowRunIsReal`, `record_row_runs.go:17-67`);
- `recordRowRequest` (`record_rows.go:32-36`) carries `answers`, `order_id`,
  `replaces`, and `Replaces` goes straight into `CreateRecordRow`
  (`record_rows.go:429-433`).

The live read `liveRowsOf` (`record_rows.go:337-386`) lists every row of every
publication's draft for the record, builds the set of replaced ids
(`record_rows.go:370-375`), and returns the current rows, or with `history` the
replaced ones, to a caller who sees all (`callerMaySeeEveryRow`) or whose row
names them. It never reads `Deleted`.

### How the IAS Tenders row is linked to a run

`agency/ias.json` in the IAS repo declares Tenders as record RC-1, workflow W-1
"Pipeline to submission", form "Tender", 10 questions, role 31b8f89a (the adding
role); none of W-1's form steps is titled "Tenders", so `recordKeptByStep` is
false and Tenders rows are added through the live route, not a step. The only
link between a Tenders row and a run is the optional `order_id` on that route,
which `workflowHasRun` (`record_row_runs.go:51-67`) accepts when the run exists
among W-1's form-step records (or a group order). The Home entries that open a
step for a picked row use `scope: "row.order"`
(`documentation/2. design/agency-home.md` sections 2 and 10) and match the open
item whose `order_id` equals the row's `order_id`; a row with none matches
nothing. So a Tenders row and its "Go or no-go" run are tied only when someone
passes the run's id as `order_id` when adding the row.

### What the sibling does with a row

- `RecordRow` (`models/record.go:18-34`) has `replaces`, `corrected_on`,
  `send_key`, `deleted`, `order_id`, `place_refs`.
- `CreateRecordRow` (`record_impl.go:263-297`) refuses a role that is not the
  record's (lines 277-279), validates answers against the record's questions
  (`validateRowAnswers`, 175-205, which also admits approval stamps, `Changed: `
  prompts and the owner's extra details), forces `Deleted = false` (line 282),
  settles a replacement and refuses a duplicate.
- `settleReplacement` (`record_row_correction.go:15-41`): the old row must exist,
  belong to the same record code, not be corrected already; an empty `order_id`
  takes the old row's and another one is refused. So Edit's "keeps the order
  id" is already true.
- `refuseDuplicate` (`record_row_correction.go:43-63`): the same answers by the
  same person in the same order within 60 seconds of a current row of the record
  is `ErrDuplicateRecordRow` (409). An edit that changes nothing, sent within a
  minute, is refused for this reason.
- `ListRecordRows` (`record_impl.go:299-309`) filters by record id, code and order
  only, and `specstore` in `mwanachama-backend-shared` v0.3.1 filters nothing on
  `deleted`.
- The `AgencyManager` has `CreateRecordRow` and `ListRecordRows` for rows and
  nothing else (`agency.go:91-92`; `agency.operations.json:2238` and `:2265`).
  `DeleteRecord` hard-deletes all the rows of a record in an open draft
  (`record_impl.go:153-170`).
- `agency.blueprint.json:644` describes `deleted` as "retired from every
  listing", and the `send_key_unique` index (line 650) is `not_deleted` "a
  retired row frees its step": the column and the index were made for a retire
  that no code performs.

## What is missing

Add: a declaration that a step writes row of record X. Without it a one-step
workflow named "Add a tender" would make its own record "Add a tender" and keep
the rows there, a second register beside Tenders.

Edit: the same declaration, and a row id on the step path that becomes
`Replaces`; prefilling is the app reading the row from the live list.

Delete: the declaration, a row id and a reason on the step path, and a sibling
operation that retires the row.

## The smallest design

### The declaration

Two fields on a step, both in the sibling's `WorkItem`:

| Field | Values | Meaning |
|---|---|---|
| `row_record` | a record code such as `RC-1` (the agency file also accepts the record's name, as Home refs do) | The record whose row the step writes. |
| `row_action` | `add`, `edit`, `delete` | What the step does to it. |

Both empty for every other step. Both set only on a `fill_form` step, whose role
is the record's adding role, in a workflow of any kind (tied to the record or
not). The step keeps its own form like any step, so nothing else reads
differently: `add` and `edit` carry the record's form name and questions;
`delete` carries one question, the reason.

```json
{
  "workflows": [
    { "id": "W-8", "name": "Add a tender" },
    { "id": "W-9", "name": "Edit a tender" },
    { "id": "W-10", "name": "Delete a tender" }
  ],
  "work_items": [
    {
      "id": "WI-60", "workflow_id": "W-8", "title": "Add a tender", "ordinality": 1,
      "kind": "fill_form", "role_id": "R-2",
      "row_record": "RC-1", "row_action": "add",
      "form_name": "Tender",
      "questions": [ { "prompt": "Title", "answer_type": "free_text", "required": true } ]
    },
    {
      "id": "WI-61", "workflow_id": "W-9", "title": "Edit a tender", "ordinality": 1,
      "kind": "fill_form", "role_id": "R-2",
      "row_record": "RC-1", "row_action": "edit",
      "form_name": "Tender",
      "questions": [ { "prompt": "Title", "answer_type": "free_text", "required": true } ]
    },
    {
      "id": "WI-62", "workflow_id": "W-10", "title": "Delete a tender", "ordinality": 1,
      "kind": "fill_form", "role_id": "R-2",
      "row_record": "RC-1", "row_action": "delete",
      "form_name": "Why delete this tender",
      "questions": [ { "prompt": "Reason", "answer_type": "free_text", "required": true } ]
    }
  ],
  "home": [
    { "key": "win-work", "title": "Win work", "entries": [
      { "key": "tenders", "title": "Tenders", "target": { "type": "record", "ref": "RC-1" } },
      { "key": "add-a-tender", "title": "Add a tender", "roles": ["R-2"],
        "target": { "type": "workflow", "ref": "W-8", "step": "WI-60" } }
    ] }
  ]
}
```

(`questions` is abbreviated to the first of the record's ten; the real step
repeats every question of RC-1. Role `R-2` stands for RC-1's adding role.)

Rules the sibling checks when a work item is created, updated, imported, forked
and published, in the same places it checks a step's other fields (the shape and
reference checks the compute step uses are the model):

1. `row_record` and `row_action` are set together or not at all.
2. The kind is `fill_form`, the record exists in the draft, and the step's role
   is the record's `role_id` (`ErrInvalidWorkItem`, 400).
3. For `add` and `edit` the step's form name and questions equal the record's
   (the check `recordMatchesStep` does at `step_records.go:55-57`), so the
   answer fits the record. For `delete` there is one required free-text
   question.
4. A workflow with a row step has that one step only, so the run is one step.
5. The record reference is remapped onto the forked record in a fork and in a
   restore, and the Issue scan names a step whose record is gone, as for
   `viewer_role_id` and the role of a step.

### The hub

- `stepKeepsRecord` (`step_records.go:15-17`) is false for a step that carries
  `row_record`, so publish derives no record for it and `recordKeptByStep`
  (`record_rows.go:188-201`) does not count it: Tenders stays open to the Add
  route and to the Add workflow at once.
- `stepAnswersRequest` (`step_runs.go:63-70`) gains `row_id`, and the MCP tool
  gains it (`mcpSubmitStepAnswersParams`). `submitStepAnswers` branches on
  `row_action` before the chain lookup:
  - the check is `callerMayAddRows` on the declared record, not "holds the
    step's role" (`step_runs.go:396`), so the owner and a group-seated resident
    pass exactly as on the live route;
  - `add`: the live route's checks (`namesAStranger`, `withChosenDetails`, the
    answer resolution of `resolveStepAnswers`), then `CreateRecordRow`; an
    optional `order_id` is checked by `rowRunIsReal` as today;
  - `edit`: `row_id` is required, must be a current row of the record (not
    replaced, not deleted) and `Replaces` is set to it; order id, duplicates and
    "already corrected" are the sibling's;
  - `delete`: `row_id` required, the reason is the answer; the hub calls the new
    sibling operation below.
  The result's `RowID` is the new row for `add` and `edit`, and the retired row
  for `delete`.
- The row step is a first and only step, so its run needs no waiting state:
  `callerAvailableSteps` (`step_runs.go:311-373`) lists it as `state: start` with
  `record_code`, and a new `row_action`, so the app knows to pass a row id. A
  step started from a picked row is opened with `row_id`; the app fills the
  form from the live rows list (`liveRowsOf`) for `edit`.
- `liveRowsOf` (`record_rows.go:337-386`) drops a retired row
  (`row.Deleted`) unless `history` is true; the history read shows replaced rows
  and retired rows. `runsOf` already skips `row.Deleted`.

### What the sibling needs

1. Fields `row_record` and `row_action` on `models.WorkItem`
   (`models/workitem.go:5-48`) and `DocumentWorkItem`, as columns of `work_item`
   in `agency.blueprint.json`, in `create_work_item` and `update_work_item` of
   `agency.operations.json`, in the content hash only when set (as
   `viewer_role_id` was added), with the checks above, the fork and restore
   remapping, the import file, and the Issue scan.
2. A way to retire one row: `RetireRecordRow(ctx, rowID, reason)` (tool
   `agency_retire_record_row`, `DELETE /record-rows/{id}`) that sets
   `deleted = true`, stamps `last_updated`, and records who and why in two new
   columns `deleted_by` and `deleted_reason` of `record_row`. It refuses a row
   that is already retired, one that is replaced (not current), and one that
   does not exist (`ErrInvalidRecordRow`). The `deleted` column and the
   `send_key_unique` `not_deleted` index already exist for it.
3. `ListRecordRows` hides retired rows unless the filter asks for them
   (`RecordRowFilter` gains `with_deleted`). The hub reads history with it.
   Without this the hub can filter `Deleted` itself, but then every other
   reader of the sibling still sees retired rows; the sibling should own it.
4. A new release, tagged only with the owner's yes, then
   `code/wakala-api/go.mod` moves to it.

This is the only part that is not in the hub, and it is not small: two fields
through the blueprint, the operations file, fork, publish and import, plus one
new operation.

### Alternatives considered

- **Declare the step without a sibling field.** The only free-form carriers on a
  `WorkItem` are `tool`, `function`, `bindings` and `result_name`, which belong
  to other step kinds and are refused on a `fill_form` step by the shape check
  (`computeFieldsOnTheRightKind`, sibling `compute_step.go`). A naming
  convention (a step titled like the record, in the record's workflow) is what
  makes a step keep a record today, and it cannot express "edit" or "delete".
  Rejected.
- **Delete as a replacing row with a marker.** A hub-only delete could write a
  row that replaces the original, carrying a `send_key` such as
  `delete:<row id>` (unique, so a second delete is refused) and the copied
  answers plus a reason, and `liveRowsOf` could hide a row with that key. It
  works only by writing `send_key`, which the blueprint says "nothing else"
  writes, it copies every answer (so a record whose questions changed since the
  row was saved cannot be deleted), and the retired row shows as current in
  every other reader. Not recommended; it is the fallback if the owner will not
  tag a release.
- **Edit as the live route only.** The live add route already edits through
  `replaces`; the app could call it, but decision 15 says Edit is a workflow
  and the app draws no button of its own, so the step must carry it.

## Test plan (todo TD-5748, not written yet)

Todo 2 is not done because the gap is not wholly in the hub: a failing test of
the declaration or of Delete needs the new sibling fields and operation to
compile. The tests to write once the sibling release exists, in
`internal/api/http` on the memory backend (`stepRunWalk`, `businessRegister`
harnesses): add writes a row of RC named by `row_record` and no derived
record appears; edit replaces a row, keeps its order id, and a second edit of the
same row is refused; delete retires the row, the live list drops it and history
keeps it with the reason; a resident without the record's role is refused 403 on
each; a group-seated resident and the owner are admitted; the live add route and
the agent tool still behave as before.

## Open questions for the owner

1. May the sibling gain `row_record`, `row_action` and the retire operation, and
   be tagged? Nothing else in this design waits on a decision.
2. Does an Add run's `order_id` stay empty (this design) or is the new row
   tied to the Add run? A one-step run shows nowhere in Ongoing, so leaving
   it empty loses nothing; tying it would make `rowRunIsReal` refuse it, as the
   Add workflow is not the record's own workflow.
3. Is the reason of a Delete kept only on the retired row (this design), or also
   in the audit trail? The route and tool already leave one audit entry per row
   added; a retire should leave one too, with the reason.
