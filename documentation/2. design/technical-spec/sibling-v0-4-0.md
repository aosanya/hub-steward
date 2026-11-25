# Hub on sibling v0.4.0

ISS-218 (decisions D36, D75, D78). `code/wakala-api/go.mod` moves `mwanachama-backend-agency` from v0.3.2 to v0.4.0. The sibling's page is `workflow-records.md`, section "A record carries no role", in its `documentation/2. design`. The model for this page is [Hub on the sibling v0.3.1](sibling-v0-2-0.md).

| Built | Planned |
|---|---|
| Everything below. Sections 1 and 2 were read on 2026-11-24 with `go build -gcflags=-e ./...` and `grep` on `dev` with v0.4.0 in `go.mod`; sections 3 to 5 say what the tests and the change are | The phone app and the console reading the four names (section 6) |

## 1. What stops the build

Only the `internal/api/http` package. Every other package, including `internal/templates`, `internal/agencies`, `internal/accounts` and `internal/apikeys`, builds.

| File | Read of the removed fields |
|---|---|
| `record_rows.go` | `writeRow` stamps the row with `record.RoleID`; `callerMayAddRows` holds `record.RoleID`; `callerMayDoRowAction` holds `record.RoleOfRowAction(action)`, which is gone; `callerMaySeeEveryRow` holds the adding role or `record.ViewerRoleID` |
| `step_runs.go` | The designed form step's row is stamped with `chain[index].record.RoleID`; `nextStepOf` reads `link.record.RoleID` for the open step's role and role name |
| `step_records.go` | `ensureStepRecords` creates and updates the record a designed form step derives with `RoleID: stepActorRoleID(s)`; `recordMatchesStep` compares `r.RoleID` |
| `earlier_steps.go` | The role name of an earlier step is `roleNames[chain[i].record.RoleID]` |
| `send_back_step.go` | The role name of the sender and of the target is read from `chain[...].record.RoleID` |
| `instance_import_steps.go` | `recordRoleRefs` resolves `role_id`, `viewer_role_id`, `edit_role_id` and `delete_role_id` of a file record onto the record; `applyStepRecords` creates the derived record with `RoleID: roleID` |

The same sites in tests: the `Record{... RoleID: ...}` literals, `record.RoleID` as the row's role, `EditRoleID`, `DeleteRoleID` and `ViewerRoleID` in the harnesses of `step_rows_harness_test.go`, `step_rows_test.go`, `record_rows_group_role_test.go`, `instance_import_record_settings_test.go` and about twenty more files under `internal/api/http`, and three in `internal/reviewruns`.

## 2. What compiles and is now wrong

### 2.1 The wire

| Where | What |
|---|---|
| `instance_import.go` `importRecord` | Declares `role_id`, `viewer_role_id`, `edit_role_id` and `delete_role_id`. The sibling now refuses a document that carries one, so the hub reads them only to refuse them (ISS-156 TD-6098) |
| `code/console/src/data/pages/workflowDesign.ts` and `generatedWorkflows.ts` | Read and write the four names on a record. The API no longer returns them, so the console shows no actor on a generated step. Not part of this issue; reported to the owner |

### 2.2 A generated step holds no role

The sibling's `generatedPlansOf` leaves `RoleID` empty on the generated add, edit and delete steps, and `RoleOfRowAction` is gone. Two readers of a step's role therefore stop finding it:

| File | Effect |
|---|---|
| `caller_open_steps.go` | Lists steps with `WorkItemFilter{RoleIDs: roleIDs}`, so a generated row step is listed for nobody |
| `step_role_board.go` | A step with an empty role is not a step of the caller |

A designed row step keeps the role it names.

### 2.3 A row is stamped with a role that adds

`CreateRecordRow` accepts a row only when its `role_id` is a role of the draft that carries `record.<code>.add.*` or an add code of a field. This holds for an edit too, because an edit is a row that replaces another. The hub took the role from the record; it has to take it from the roles the caller holds.

### 2.4 A record a step derives has no adding role

`ensureStepRecords` and the import's `applyStepRecords` made the derived record with the step's role as its adding role. The sibling refuses a publish for a record no role may add to (ISS-154), so the step's role has to carry the add code of the record it derives.

## 3. Red tests

`internal/api/http/record_role_fields_gone_test.go`, run on the module before the bump:

| Test | Failed because |
|---|---|
| An import whose record carries `role_id`, `edit_role_id`, `viewer_role_id` or `delete_role_id` is refused 400 with the field and the codes that replace it, and creates nothing | The import answered 201 |
| A removed field sent empty is read as absent | Guard, already true |
| A generated step holds no stored role | The generated add, edit and delete steps held the record's role |
| A role with only a view code is refused the generated add step, a role with an add code adds | The adding role was the record's `role_id`, so a view-only role could add and a role with the add code could not |

## 4. What was changed

| Where | Change |
|---|---|
| `go.mod`, `go.sum` | v0.4.0 |
| `record_row_roles.go` (new) | `callerMayDoRowAction`, `callerMayAddRows` and `callerMaySeeEveryRow` read the permission codes of the roles the caller holds in the assumed group, from the published version (`agencyRolePermissions`), instead of a role named on the record. The platform owner still passes. A role may do an action when it carries `record.<code>.<action>.<field>` of that record (or `.*`), and for delete `record.<code>.delete`; add and view are the two actions that open the whole list (`callerMaySeeEveryRow`). `rowRoleOf` picks the role stamped on the row: the first held role carrying an add code, and for the owner the first role of the draft that carries one |
| `record_rows.go` | `callerIsOwnerOrHolds`, `callerMayDoRowAction`, `callerMayAddRows` and `callerMaySeeEveryRow` leave the file; `writeRow` stamps `rowRoleOf`, so the sibling's add check (`roleAddsRows`) is satisfied by the caller's own add codes. An edit is a replacing row and is stamped the same way, so an edit needs an add code too, as it does in the sibling |
| `step_row_submit.go` | The generated step is allowed by `callerMayDoRowAction` with the step's `row_action`, so edit and delete need their own codes |
| `step_runs.go`, `earlier_steps.go`, `send_back_step.go` | A designed form step's row, the open step and the earlier and sent-back role names read the step's role (`stepActorRoleID`), which is what the record's role always was for a derived record |
| `step_records.go` | A record a designed form step derives is made with no role. At publish the step's role is given `record.<code>.add.*` when it carries no add code of the record (`letStepRoleAdd`), because the sibling refuses a publish for a record no role may add to (ISS-154). Before that, `dropAddCodesOfGoneRecords` takes the star add code of a record that no longer exists off the roles, because the sibling refuses a role code no record gives |
| `instance_import.go`, `instance_import_record_role_fields.go` (new), `instance_import_references.go` | `importRecord` reads the four names only to refuse them: `UnmarshalJSON` takes the list from the sibling's `DocumentRecord`, and `checkRecordRoleFields`, the first check of `importRequest.check`, refuses with the sibling's wording, `role_id is gone from a record: give a role record.tender.add.* or record.tender.add.<field> instead`. The HTTP import and the launch path both run it before anything is created. A field sent empty is accepted. This is ISS-156 TD-6098 |
| `instance_import_steps.go`, `instance_import_role_codes.go` | `recordRoleRefs` is gone. A record a step derives at import is created with no role, and the step's role gets `record.<code>.add.*` when its permissions are set (`stepRolesAdding`) |
| `caller_open_steps.go`, `record_row_roles.go` | A generated row step holds no role, so the list of open steps finds it through the codes: `rowStepsOpenToCaller` lists a generated step when a role the caller holds carries the code of the step's action on its record, and shows that role |
| `demo/farmers`, `demo/boda-boda-riders` and the same two files under `code/console/public/templates` | The record's `role_id` is gone and the role that held it carries `record.RC-1.add.*`, as the sibling's own `hub-demo` fixtures do |

Not changed: the console reads and writes the four names (`data/pages/workflowDesign.ts`, `data/pages/generatedWorkflows.ts` and their tests). The API no longer returns them, so the console's generated workflow pages show no actor until they read the permission codes. That is its own issue.

## 5. Behaviour that changed

| What | Before | Now |
|---|---|---|
| Who may add a row | The record's `role_id` | A role carrying an add code of the record |
| Who edits and deletes through a generated step | `edit_role_id` and `delete_role_id`, falling back to `role_id` | A role carrying an edit code, or `record.<code>.delete`. No fallback to add |
| Who lists every row | The adding role or `viewer_role_id` | A role carrying an add code or a view code of the record |
| A role that a form step names | Held the step | Also carries the add code of the record the step derives, put there at publish. A role with any code shows the self-service modules to a seated agent, so the agent tool list of the test agency grows from 28 to 273 tools (`testdata/mcp_lazy/agent-tools.txt` is regenerated) |
| Generated steps in my open steps | Listed for the record's role | Listed for a role carrying the matching code, so a role that only adds sees the add step and not edit or delete |
| An old file | Imported | Refused when a record carries one of the four fields with a value |

Tests that relied on the fields were moved to the codes through helpers in `record_add_roles_test.go`: `letRoleAdd` and `letRoleDo` give a role the codes of a record, and `addingRoleOf` finds the role of a draft that adds to it for a seeded row. `TestAnEditStepFallsBackToTheAddingRoleWhenTheRecordNamesNoEditingRole` and `TestImportRefusesARecordSettingNamingAnUnknownRole` are removed: there is no fallback and no record role to name.

Tests: `go test ./internal/api/http ./internal/agencies ./internal/accounts ./internal/apikeys ./internal/templates` passes except `TestTheUnpaidListIsNotWidenedUntilTheSettingSaysAnyone` and `TestTheUnpaidListSettingOfOneAgencyDoesNotWidenAnother`, which fail the same way on a clean dev.

## 6. Not here

The phone app and the console still name the four fields. Which fields an answer may carry (field level add, edit and view on a row) is not checked in the hub; the sibling checks only that a role carries an add code. Tags and groups are as ISS-190 left them.
