# Console: who holds a generated step

A generated workflow of a record is held by the roles whose permission list carries the codes of its step (D75, hub ISS-157, in [do-something-own-steps.md](../2.%20design/technical-spec/do-something-own-steps.md)). The sibling agency v0.4.0 removed a record's `role_id`, `edit_role_id`, `delete_role_id` and `viewer_role_id`, so the console no longer names a holder from a record. Built for ISS-230. The screens are drawn in [workflows-generated.html](../2.%20design/mockups/console/agency/workflows/workflows-generated.html) and [workflow-generated.html](../2.%20design/mockups/console/agency/workflows/workflow-generated.html).

## The rule

One helper holds it: `src/data/pages/stepHolders.ts`. `roleHoldsStep` mirrors `roleHoldsGeneratedStep` of the hub's `step_holders.go`; `holdersOf` names the roles that hold a step, in the order the roles are listed; `holderNames` joins them for a cell.

| Step | A role holds it when its list carries |
|---|---|
| Add | `record.<code>.add.*`, or `add.<field>` for every required field. A record with no required field: any one `add.<field>` |
| Edit | `record.<code>.edit.*` or any one `edit.<field>` |
| Delete | `record.<code>.delete` |

A field with no code cannot be carried, so a required field with no code leaves only `add.*` to hold the add step.

## Where it is read

A generated workflow finds its record by the record's key ([app-record-keys.md](../2.%20design/technical-spec/app-record-keys.md) section 5). `loadGenerated` in `src/data/pages/generatedWorkflows.ts` reads `agency_list_roles` (each role's name and `permissions`) and `agency_list_records` (each record's questions, with their `code` and `required`). `GeneratedRecord.heldBy` and `GeneratedWorkflow.heldBy` are lists of role names, empty when no role carries the codes. The list page, the detail page and the card on a record show the list joined with a comma, and the list page searches it.

The console reads the draft's roles, not the published version; the hub reads the published version for a running step.

## Inventory of the readers of the removed fields

Searched `code/console/src` and `code/console/e2e` for `role_id`, `viewer_role_id`, `edit_role_id` and `delete_role_id` on a record, and for `heldByOf` and `roleKeyOf`.

| Place | What it did | Now |
|---|---|---|
| `generatedWorkflows.ts`, `roleKeyOf` and `heldByOf` | Read `role_id`, `edit_role_id` and `delete_role_id` of a record to name one holder | Removed; the roles that carry the codes |
| `GeneratedWorkflowsPage.tsx`, `GeneratedWorkflowDetail.tsx`, `RecordWorkflows.tsx` | Showed the one holder name | Show the list |
| `workflowDesign.ts`, `recordRoleFields` and `carriedWithoutRoles` | Does not read them: strips the four fields from the record it saves, so an old record never sends them back | Kept as the guard |

The record editor reads none of the four fields. `workflowDesign.test.ts`, `WorkflowEdit.test.tsx` and `changeRule.walk.test.tsx` give a loaded record the fields and assert they are not sent back.

## Tests

`generatedWorkflows.test.ts` (the holders of a loaded set, for a record with no role fields), `stepHolders.test.ts` (the rule), and the three view tests `GeneratedWorkflowsView`, `GeneratedWorkflowDetail` and `RecordGeneratedWorkflows`, whose fixtures give roles with permission lists.
