# Hub on sibling v0.3.1

ISS-200 (decisions D36, D38, D39, D49, and the owner decision to take v0.3.1 instead of v0.2.0). `code/wakala-api/go.mod` moves `mwanachama-backend-agency` from v0.1.6 to v0.3.1. The file keeps the name `sibling-v0-2-0.md` because the todos and the README row name it; v0.3.0 and v0.3.1 add what section 2.3 lists. The sibling's design pages are `accountable-role.md` and `workflow-records.md` in its `documentation/2. design`.

| Built | Planned |
|---|---|
| Everything below. Section 1 and 2 were read on 2026-11-24 with `go build ./...` and `go vet ./...` on v0.2.0; sections 3 and 4 say what the tests and the change are | Reading field level permission codes in the import (ISS-156), tags and groups, and the phone app moving to keys |

## 1. What stops the build

Only two files. Everything else compiles.

| File | What breaks |
|---|---|
| `internal/api/http/approvals_apply_raci.go` | `CreateRoleAssignment`, `GetRoleAssignment`, `DeleteRoleAssignment`, `models.RoleAssignment` and `models.RACILabel` are gone |
| `internal/api/http/instance_import.go` | The `in.RoleAssignments` loop calls `CreateRoleAssignment` and `models.RACILabel` |

## 2. What compiles and is now wrong

### 2.1 Answers are saved and read by the field's key

A record row's `Answers` and `PlaceRefs` are keyed by the field's hidden `key` (`f_` and sixteen hex digits). A write by prompt is still understood and saved by key. A read returns keys. A step's own questions carry no key, so a form step is still named by prompt.

The hub code that reads a row's answers by prompt, and so finds nothing now:

| File | Read |
|---|---|
| `record_rows.go` | `rowMeets` (the `where` conditions), `rowNames` (a row naming a person), `namesAStranger` (a picked person or asset), `questionOfRecord` |
| `record_mcp.go` | The `answers` argument text says "by the question's prompt" |
| `step_runs.go` | `run.answers[i] = row.Answers` feeds the earlier steps and the routing |
| `earlier_steps.go` | `run.answers[i][q.Prompt]` |
| `step_routing.go` | `routeMatches` reads `answers[rule.Question]` |
| `step_row_submit.go`, `step_place_refs.go`, `step_approval_refusal.go` | Check what was just written, by prompt |
| `send_back_step.go`, `caller_sent_steps.go`, `caller_sent_row_steps.go` | Return `row.Answers` to the caller as it is stored |
| `declaration_register.go` | The register of declarations returns the stored answers |
| `internal/agencies/earlier_withdrawals.go` | Logs `stamped.Answers` only; nothing to change but the name it reads by |

The stamps (`Approved by`, `Approved at`, the over-limit pair and the `Changed: ` lines) are answers that are not fields of the form. The sibling keeps them under their own text, so they stay read by prompt.

Run on the bumped module with only the two compile errors removed: 41 tests of `internal/api/http` fail on this, all of them an answer read by prompt. `TestEveryMountConfigurationListsExactlyItsPinnedMCPTools` also fails because the pinned roster of tools lists seven RACI tools that are gone and lacks `agency_add_record_row_tag`. `internal/agencies` fails the same two unpaid-list tests as on a clean dev; `internal/accounts` and `internal/apikeys` pass.

### 2.2 One accountable role per step, not RACI rows

| File | What changes |
|---|---|
| `instance_import.go` | `importRoleAssignment` and the `RoleAssignments` loop go; `importWorkItem` gains `accountable_role_id`, resolved with the role lookup `role_id` uses; an older file's `role_assignments` are folded by the sibling's rules |
| `instance_import_steps.go` | `stepRefs` resolves the accountable role |
| `instance_import_limits.go` | `len(in.RoleAssignments)` leaves the entry count |
| `approvals_apply_raci.go` | Deleted with the appliers `agency_set_raci` and `agency_delete_role_assignment` |
| `internal/templates/build.go`, `spec.go` | `raciLabels`, the `RACI` spec section and the `RoleAssignments` loop go; a work item names its accountable role |
| `mcp_tools_template.go` | The tool text says "step RACI" |
| `testdata/mcp_roster/no-mounts.txt` | Seven RACI tools leave the roster, `agency_add_record_row_tag` joins it |
| Console `data/pages/stepRoles.ts`, `pages/workflows/StepRoles.tsx` | Read and write `accountable_role_id` of the step |
| Console `data/chatPages/*`, `data/chatOverview.ts`, `data/enhanceBackground.ts`, `data/pages/goals.ts`, `pages/objectives/*` | Name `agency_list_role_assignments` and `..._for_work_item` as a read, and `agency_set_raci` as a suggestion |
| `demo/*/agency.json`, `code/console/public/templates/*.json` | Eight files still carry `role_assignments`; the import folds them, so they stay as they are |

The hub's migration mirror has no `role_assignments` entry: `code/supabase/migrations` holds only the identity migration, and the agency tables are made by the sibling's `Provision`. Nothing to remove there.

### 2.3 What v0.3.0 and v0.3.1 add (ISS-195, ISS-201)

A record has a readable `code` (`tender`, renamable) and a hidden `key` (a UUID for a record made since v0.3.1, `RC-n` for an older one). Everything that points at a record points at the key: a row's `record_code`, a step's `row_record`, a workflow's `subject_record`, the generated workflow codes (`<key>.add`, `<key>.add.1`), and a home entry (saved as the key). Row filters take the code or the key. v0.3.1 also adds the tag.manage catalogue permission; nothing in the hub reads it yet.

What broke without a compile error: the hub treated `record.Code` as the identity in `record_rows.go`, `subject_run.go`, `step_runs.go`, `step_row_submit.go`, `caller_sent_steps.go`, `caller_sent_row_steps.go`, `home_mcp.go`, `step_records.go`, `record_details_allowance.go` and the whole import (`instance_import_steps.go`, `instance_import_codes.go`, `instance_import_home.go`). Twenty-odd tests named `RC-1` or read `record.Code`.

## 3. Red tests

`internal/api/http/answers_by_key_test.go`, run on the bumped module with only the two compile breakers removed:

| Test | Failed because |
|---|---|
| A condition names a field by its key, its code or its prompt (two tests) | A condition naming a key was refused as not a question of the record |
| An older file's `accountable` entries are folded onto the steps | The steps had no accountable role |
| A step's own `accountable_role_id` is read | The field was dropped |
| A named accountable role the file lacks is an error | The import reported nothing |
| A row read returns the answers under the field key | Already true, kept as a guard |

`approvals_apply_accountable_test.go` covers the approval of `agency_update_work_item`. Many existing tests that read an answer by prompt, or took `RC-1` as the record's code, were moved to the key with small helpers (`promptKeyed`, `promptsOfRow`, `rc`).

## 4. What was changed

| Where | Change |
|---|---|
| `go.mod`, `go.sum` | v0.3.1 |
| `approvals_apply_raci.go` | Deleted. `approvals_apply_accountable.go` adds the applier of `agency_update_work_item`: it sets or clears `accountable_role_id` of a step of the open draft, to a role of the open draft |
| `instance_import.go`, `instance_import_steps.go`, `instance_import_accountable.go`, `instance_import_limits.go` | `accountable_role_id` is read and resolved like `role_id`; `withAccountableRolesFolded` applies the sibling's rule to an older file's `role_assignments` (accountable only, a step and a role of the file, not the step's own role, the first per step, never over a field already set); the old section no longer counts |
| `answer_fields.go` and the readers named in 2.1 | A field is found by key, then code, then prompt; an answer is read by key, then prompt. The stamps stay read by prompt |
| `internal/templates` | The spec has no `raci`; a work item takes `accountable_role` |
| Record readers named in 2.3 | The record is named by `Identity()` (key, else code). The live-records listing carries `key` beside `code` |
| Import of records | A record is created with its readable code and the key the agency mints; a file's `RC-n` or code is only a reference, mapped to the key for steps, subjects, home entries and `row_record`; a step's `record_code` is rewritten to the readable code after the records exist |
| `record_details_allowance.go` | The owner's choice of details is read by the record's key, then by its code |
| Roster pin | Seven RACI tools out, `agency_add_record_row_tag` in; counts 825, 894, 893, 859, 962, 996 |
| Console | `data/pages/stepRoles.ts` and `StepRoles.tsx` read the step's `accountable_role_id` (its own `role_id` when empty) and propose `agency_update_work_item`; the objective flow, the step page, the goals and objectives chat reads and the objectives overview use the step's accountable role and no longer call `agency_list_role_assignments`, `agency_list_role_assignments_for_work_item` or `agency_set_raci` |

Not changed: the eight files under `demo/` and `code/console/public/templates/` still carry `role_assignments`; the import folds them. Their entries name an objective and no step, so they fold to nothing; converting them is the issue that owns the files (accountable-role.md, last bullet).

Tests: `go test ./internal/api/http ./internal/agencies ./internal/accounts ./internal/apikeys ./internal/templates` passes except `TestTheUnpaidListIsNotWidenedUntilTheSettingSaysAnyone` and `TestTheUnpaidListSettingOfOneAgencyDoesNotWidenAnother`, which fail the same way on a clean dev. In the console `npx vitest run` passes except `PostingStepCard.test.tsx`, which also fails on a clean dev, and `npx tsc --noEmit` shows nothing beyond the missing type definitions.

## 5. Not here

Reading a field's permission codes in the import is ISS-156. Tags and groups are not built here. The phone app reads answers by prompt in many places (`code/app/src/app/menu`, `features/forms`, `features/steps`); the hub now returns keys, so the app has to move to the field list's keys, and that is not part of ISS-200. The app also names a record by the `code` of the live-records listing; it should use `key`.
