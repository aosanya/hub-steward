# Console: who holds a generated step

A generated workflow of a record is held by the roles whose published permission list carries the codes of its step (D75, hub ISS-157). The sibling agency v0.4.0 removed a record's `role_id`, `edit_role_id`, `delete_role_id` and `viewer_role_id`, so the console no longer names a holder from a record. This page is for ISS-230.

## Inventory of the console readers of the removed fields

Searched in `code/console/src` and `code/console/e2e` for `role_id`, `viewer_role_id`, `edit_role_id` and `delete_role_id` on a record, and for `heldByOf` and `roleKeyOf`.

| Place | What it does with the fields | Change |
|---|---|---|
| `data/pages/generatedWorkflows.ts`, `roleKeyOf` and `heldByOf` | Reads `role_id`, `edit_role_id` and `delete_role_id` of a record to name the holder of each action | Replaced by the roles that carry the codes |
| `data/pages/generatedWorkflows.ts`, `GeneratedRecord.heldBy` and `GeneratedWorkflow.heldBy` | Carry the one holder name to the views | Become a list of role names |
| `pages/workflows/GeneratedWorkflowsPage.tsx` | Shows and searches `workflow.heldBy` | Reads the list |
| `pages/workflows/GeneratedWorkflowDetail.tsx` | Shows `workflow.heldBy` | Reads the list |
| `pages/records/RecordWorkflows.tsx` | Shows `workflow.heldBy` or `record.heldBy[action]` | Reads the list |
| `data/pages/workflowDesign.ts`, `recordRoleFields` and `carriedWithoutRoles` | Does not read them: strips the four fields from what a saved record carries, so an old record never sends them back | Kept as the guard |
| Tests: `GeneratedWorkflowsView`, `GeneratedWorkflowDetail`, `RecordGeneratedWorkflows`, `GeneratedWorkflowsView` fixtures | Give a record the removed fields | Fixtures give roles with permission lists instead |
| `workflowDesign.test.ts`, `WorkflowEdit.test.tsx`, `changeRule.walk.test.tsx` | Give a loaded record the removed fields and assert they are not sent | Kept: they prove the guard |

`data/pages/recordPermissions.ts` and `rolePermissions.ts` do not read a record's role fields.
