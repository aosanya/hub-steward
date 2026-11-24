# Hub on sibling v0.2.0

ISS-200 (decisions D36, D38, D39, D49). `code/wakala-api/go.mod` moves `mwanachama-backend-agency` from v0.1.6 to v0.2.0. The sibling's design pages are `accountable-role.md` and `workflow-records.md` in its `documentation/2. design`.

| Built | Planned |
|---|---|
| Section 1 and 2: the inventory, read on 2026-11-24 with `go build ./...` and `go vet ./...` on the bumped module | Sections 3 to 5 are filled as the todos land |

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

## 3. Red tests

Filled by TD-6134.

## 4. What was changed

Filled by TD-6135 and TD-6136.

## 5. Not here

Reading a field's permission codes in the import is ISS-156. Tags and groups are not built here. The phone app reads answers by prompt in many places (`code/app/src/app/menu`, `features/forms`, `features/steps`); once the hub returns keys it has to move to the field list's keys, and that is not part of ISS-200.
