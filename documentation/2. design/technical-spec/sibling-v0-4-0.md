# Hub on sibling v0.4.0

ISS-218 (decisions D36, D75, D78). `code/wakala-api/go.mod` moves `mwanachama-backend-agency` from v0.3.2 to v0.4.0. The sibling's page is `workflow-records.md`, section "A record carries no role", in its `documentation/2. design`. The model for this page is [Hub on the sibling v0.3.1](sibling-v0-2-0.md).

| Built | Planned |
|---|---|
| Section 1 and 2: the inventory, read on 2026-11-24 with `go build -gcflags=-e ./...` and `grep` on `dev` with v0.4.0 in `go.mod` | Sections 3 to 5, written as the todos of the issue are built |

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
