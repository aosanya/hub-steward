# Record permissions

Design for ISS-149 (TD-5929 to TD-5932). Decisions D1 to D18 were taken by the owner one by one on 2026-11-24. Nothing here is built yet.

| Built | Planned |
|---|---|
| Nothing. This page is the design | Every row of section 4, ISS-150 to ISS-163 |

Today a record names the roles that may add, edit, delete and see its rows. After this work a record gives four permissions, `record.tender.add`, `.edit`, `.delete` and `.view`, and a role carries them in its permissions list, beside the catalogue codes it already carries.

## 1. The data model

### Before

```
 Record (tender)
   role_id, edit_role_id, delete_role_id, viewer_role_id ------> Role
        |                                                          |  permissions: catalogue codes only
        | derives (generated_workflows.go)                         |  (109 codes, each with operations)
        v                                                          |
 Workflow tender.add / .edit / .delete                             |
   step tender.add.1  role_id (copied from the record) -----------+
        |
        | frozen by a publish
        v
 Publication (document: roles, records, workflows, work items)
   no list of permissions

 Hub row check: callerIsOwnerOrHolds(record role) -- the platform owner always passes
```

### After

```
 Record (tender)
   no role fields
        |
        | derives (one function, in the sibling)
        +--> Permission record.tender.add   "Add a tender"
        +--> Permission record.tender.edit  "Edit a tender"
        +--> Permission record.tender.delete "Delete a tender"
        +--> Permission record.tender.view  "See every tender"
        |        no operations; the code is the check
        |        |
        |        | ticked into
        |        v
        |     Role.permissions: catalogue codes + record.* codes
        |
        +--> Workflow record.tender.add / .edit / .delete   (same code as the permission)
        |      step record.tender.add.1  no stored role: held by every role that carries the code
        |
        | frozen by a publish
        v
 Publication (document as before, plus the list of generated permissions)

 Hub row check: does one of the caller's roles carry record.<code>.<action>? The platform owner is asked too.
```

### Fields

| Where | Field | After |
|---|---|---|
| Record | `id`, `code`, `name`, `workflow_id`, `form_name`, `questions`, `item_name`, `add_replaced_by`, `edit_replaced_by`, `delete_replaced_by` | Stays |
| Record | `role_id` (adds) | Goes. The permission `record.<code>.add` replaces it |
| Record | `edit_role_id` | Goes. `record.<code>.edit` replaces it |
| Record | `delete_role_id` | Goes. `record.<code>.delete` replaces it |
| Record | `viewer_role_id` | Goes. `record.<code>.view` replaces it |
| Generated step | `role_id` (copied from the record's role) | Not stored. The step is held by every role that carries its code |
| Designed step | `role_id` | Stays (D12) |
| Role | `permissions` | Stays, one list. It takes generated codes beside catalogue codes (D14) |
| Permission (the 109 catalogue codes) | `code`, `name`, `locked`, `module`, `actions` | Unchanged. The catalogue does not grow (D15) |
| Permission (generated) | `code`, `name`, `locked` false, `module` empty, `actions` empty | New, derived per record, never stored on the record |
| Publication document | none | A new list of the generated permissions (D8). It is in the content hash only when the draft has records, so an agency without records hashes as before |
| Generated workflow | `code` `tender.add` (since ISS-140) | `record.tender.add`; its step is that code plus `.1` |
| Import file (record) | the four role fields | Refused when present, naming the field (D6) |

A record's code cannot change once it exists, so the permission codes of a record are as stable as the record.

## 2. The 18 decisions

| # | Decision | Reason |
|---|---|---|
| D1 | Permissions are set on the role, in its permissions list. The record's Add, Edit, Delete and Viewer role fields go away | One place says what a role may do, so a role's card and page can show it all |
| D2 | Any number of roles can carry a permission | A record's rows are often added by more than one role, and the old single role field could not say so |
| D3 | Seeing every row is a permission, `record.<code>.view` | The viewer role field becomes the same kind of thing as the other three |
| D4 | Add, edit and delete do not imply view. A person must hold view too | Each permission means one thing, so a role that may only add can be given exactly that |
| D5 | The hub switches at once, with red tests on every row path, no shadow run and no setting to go back | Two ways to decide who may touch a row would disagree, so there is only one |
| D6 | Existing agency files are converted once. An import that still has the old role fields is refused. Published versions need a republish | Nothing reads the old fields afterwards, and a refusal says what to fix |
| D7 | Generated permissions list no operations. The code is the check | The hub checks the code on the row routes; no tool is gated by it |
| D8 | The generated permissions are written into each publication | A version states what it grants |
| D9 | A publish is refused when a role carries a code no record gives | A code that gives nothing is a typo or a deleted record, and the role would look more powerful than it is |
| D10 | The console role page ticks them grouped by record, four ticks each | A record is what a person thinks in, and four ticks is the whole choice |
| D11 | The platform owner is checked like anyone else and needs the permissions through a role | One rule for everyone; it means the QA owner needs roles ticked for every record they work on |
| D12 | Designed workflow steps stay held by a role | A designed step is a person's job in a process, not a row action |
| D13 | The Role card line is called Permissions and shows code and name | The line lists permissions, so it says so, and a code alone is hard to read |
| D14 | Generated codes sit in the same permissions list as the catalogue codes | A role has one list, not two |
| D15 | The catalogue of 109 stays. Generated codes take the prefix `record.`, so they never meet it | A clash with a catalogue code cannot happen by construction |
| D16 | The form is `record.tender.add`, and the generated workflow's code is the same (it was `tender.add` after ISS-140) | One code names the permission, the workflow and its step |
| D17 | A role that holds a step of a subject workflow needs the view permission of the subject record, no exception | The step loads the row, and a row is shown only to a role that may see rows |
| D18 | The scan before a publish refuses when a record has no role that may add to it, when a role holds a subject step without view of its subject, and when a role may add rows but lacks view of them | Each is a setup nobody could use, caught before it reaches a person |

## 3. The rules

### The code

| Rule | Value |
|---|---|
| Form | `record.<record code>.<action>`, the action being `add`, `edit`, `delete` or `view` |
| Examples | `record.tender.add`, `record.day_worked.edit`, `record.bid_decision.view` |
| Generated workflow | The same code for add, edit and delete. Its step adds `.1`: `record.tender.add.1`. View has no workflow |
| Prefix | `record.` keeps generated codes out of the 109-code catalogue, none of which starts with it |
| Dots | A record code never has a dot (the rule of [Record codes in an agency file](agency-import-record-codes.md)), so the action is always what follows the last dot |
| Names | From the record's item name: "Add a tender", "Edit a tender", "Delete a tender", "See every tender". The item name is the record's item name, else its form name, else its name |
| Operations | None (D7). The permission gates the row routes by its code, not a tool |
| Locked | Never. A role may carry any of the four |

### Who may do what

| Rule | Detail |
|---|---|
| Through a role | A person holds a permission only through a role that carries it, the platform owner included (D11). The QA owner is seated in two roles today (Practice Director and Project Manager), so for every record they work on one of their roles must carry the codes they use, or they are seated in more roles |
| Add is not view | A role with `record.tender.add` and not `record.tender.view` sees only the rows that name the person (a person picked in an answer), as a role without the viewer role does today; today add alone shows every row, so this is a change. The scan refuses to publish it (D4, D18) |
| Edit and delete | May be carried by nobody on purpose. The scan does not ask for them |
| A subject step | A role that holds a step of a workflow about a record needs `record.<code>.view` for that record, for example the Practice Director on Go or no-go and `record.tender.view` (D17). Without it the step page says the row cannot be shown |
| Designed steps | Held by a role as before (D12). A designed form step is not a row action |

### The refusals and findings

The words follow the scan's present wording. They are proposed here and are final when the owner has read them.

| Check | Where | Words |
|---|---|---|
| A role carries a code no record gives (D9) | Create and update of a role, import, publish | `Role R-15 "Tender Scout" declares permission "record.bid.add", which no record of this draft gives` |
| A record has no role that may add to it (D18) | Scan, so the publish | `Record tender "Tender" has no role that carries record.tender.add, so nobody may add a row of it` |
| A subject step without view (D18) | Scan, so the publish | `Role R-1 "Practice Director" holds the step "Go or no-go" of a workflow about Tender, and does not carry record.tender.view` |
| Add without view (D18) | Scan, so the publish | `Role R-15 "Tender Scout" carries record.tender.add and not record.tender.view, so it could add rows it cannot see` |
| An old role field in a file (D6) | Hub import and the sibling's import | `record "Tender": role_id is not used; give the role the permission record.tender.add instead`, and in the same way `edit_role_id` names `record.tender.edit`, `delete_role_id` names `record.tender.delete` and `viewer_role_id` names `record.tender.view` |

Deleting a record leaves its four codes on the roles that carried them, and the first check then refuses the publish until they are taken off.

## 4. Who changes what

Sibling means `mwanachama-backend-agency`, a public repo the hub takes by tag (`go.mod` holds v0.1.6). A sibling issue pushes and tags only with the owner's yes. Hub files are under `code/wakala-api/internal/api/http/` and console files under `code/console/src/`.

| Issue | Change | Files | Sibling tag and push |
|---|---|---|---|
| ISS-150 | Derive the four permissions of every record | Sibling: a new file in `models/` for the derive, `models/rowstep.go` (a view action beside add, edit and delete), tests | Yes |
| ISS-151 | The role's permissions list accepts generated codes and refuses a code no record gives | Sibling: `role_impl.go` (`checkRolePermissions`), `issue_impl.go` (`checkPermissions`), `document.go` (roles on import), tests | Yes |
| ISS-152 | A publication writes the permissions it grants | Sibling: `models/agencydocument.go`, `document.go`, `publication_impl.go` (the hash), tests | Yes |
| ISS-153 | Generated workflows are named `record.<code>.<action>` | Sibling: `generated_workflows.go` (`generatedCode`), tests | Yes |
| ISS-154 | The scan refuses the three setups of D18 | Sibling: `record_issue_impl.go` (`checkRecords`, `checkGeneratedFor`), `issue_impl.go`, tests | Yes |
| ISS-155 | The record's role fields go; a file that has them is refused. The generated step stores no role | Sibling: `models/record.go`, `models/rowstep.go`, `models/agencydocument.go`, `agency.blueprint.json`, `agency.operations.json`, `record_impl.go`, `document.go`, `generated_workflows.go`, `record_issue_impl.go` | Yes, and the breaking tag |
| ISS-156 | The hub import reads the role's record permissions and refuses a bad code, and a file with the old fields | Hub: `instance_import.go` (`importRecord`), `instance_import_steps.go` (the role fields of a record), `instance_import_references.go`, `instance_import_codes.go`, red tests; the launch path shares the check | Takes the tag of ISS-150 and 151, the refusal of the fields that of ISS-155 |
| ISS-157 | A generated step is held by every role that carries its code | Hub: `caller_open_steps.go`, `step_role_board.go` (`requireHeld` passes a step with no role today, so it must check the code instead), the Held by view | Takes the tag of ISS-153 and 155 |
| ISS-158 | The row check uses permissions, and the owner is checked too | Hub: `record_rows.go` (`callerMayDoRowAction`, `callerMayAddRows`, `callerMaySeeEveryRow`, `callerIsOwnerOrHolds`, `callerIsPlatformOwner`), `step_row_submit.go`, `caller_roles.go`, and every other route that reads or writes a row. It also owns the compile-time readers of the removed fields, see the build constraint below | Takes the tag of ISS-155 |
| ISS-159 | A subject step shows its row only to a role with the view permission | Hub: `subject_run.go`, `caller_open_steps.go`, the row read, and the app's step page | Takes the tag of ISS-155 |
| ISS-160 | The console role page ticks record permissions, four per record | Console: `data/pages/roles.ts` (`editRole`), `data/pages/roleChange.ts`, `pages/views/RolesView.tsx`, a new component beside it, `public/i18n.json` | Takes the hub with the tag of ISS-150 and 151 |
| ISS-148 | The Role card line is Permissions, with code and name | Console: `pages/views/RolesView.tsx` and its tests, `roles.mayDo` in `public/i18n.json` in all seven languages, the design page and mockup | Takes the hub with the tag of ISS-150 and 151 |
| ISS-161 | The IAS file gives its roles the permissions | IAS repo: `agency/ias.json`, `agency/ias.en.json`, `agency/tests/go` | No. Waits for ISS-155 and 156 |
| ISS-162 | Inventory of every agency file that declares records, and one conversion issue per repo | A table on the issue; then each repo's own agency files | No |
| ISS-163 | Import the IAS file into a new QA Instance and seat the owner's roles | QA database, `agency/import-run.md` in the IAS repo | No. Needs the owner's yes, and a backup first |

Order:

1. ISS-150, then ISS-151, 152, 153 and 154 (all sibling, each after the derive).
2. The first tag and push, with the owner's yes. The hub can now read the new codes.
3. ISS-156, ISS-160 and ISS-148 (all take that tag).
4. ISS-155, then the breaking tag and push, with the owner's yes.
5. ISS-157, ISS-158, ISS-159, landing together on one `go.mod` bump to the breaking tag (the constraint below). The hub switches at ISS-158 (D5), so a file not yet converted loses its row access from there.
6. ISS-161 and the repo issues of ISS-162, then ISS-163, then the walk of ISS-146.

Build constraint. When `go.mod` moves to the breaking tag of ISS-155, the record's role fields and `RoleOfRowAction` are gone from the sibling, so every hub reader stops compiling at once. The hub issues of step 5 therefore cannot each take their share on its own: they land as one bump, and ISS-158 owns the full list.

| Hub file | Reads the removed fields at |
|---|---|
| `record_rows.go` | `record.RoleID` when a row is written, `RoleOfRowAction`, `record.RoleID` and `record.ViewerRoleID` in the three `callerMay` checks |
| `step_records.go` | A derived record copies the step's role into `RoleID` and compares it on each publish |
| `step_runs.go` | `record.RoleID` when a sent row is stored and when the role's name is looked up |
| `send_back_step.go` | `record.RoleID` for the sender's and the target's role name |
| `earlier_steps.go` | `record.RoleID` for the role name of an earlier step |
| `instance_import_steps.go` | The four role fields read from the file into the record |
| `instance_import.go` | The four fields of `importRecord` (kept only to refuse them) |

## Open points

| Point | Why it is not decided |
|---|---|
| What the hub reads where it reads `record.RoleID` today for a sent form | `step_runs.go`, `send_back_step.go`, `earlier_steps.go` and `record_rows.go` store or show the role that sent a row, taken from the record. With no field, the step's role is the likely answer. The decisions do not say |
| Whether a designed form step's row write also needs the add permission | D12 keeps the step with its role, and D18 asks every record for a role that carries add. A derived record of a designed step (the 23 of the IAS file) has both a step holder and an add holder, and the decisions do not say if the step holder needs the code |
| Whether the platform owner keeps the pass on catalogue permissions | D11 says the owner is checked like anyone else. `callerRolesIn` lists every catalogue code for the owner today. This page applies D11 to record permissions only; ISS-158 names rows only |
| The direct row write | `addLiveRow` lets only the platform owner write a row outside a step. Whether that stays once the owner needs a role is not said |
| Where the hub reads a role's list | The hub reads a role's permissions from the live draft (`GetRole`, cached by tenant), not from the publication. D8 puts the list into the publication; nothing in the decisions says the hub reads it there |
| No issue removes the four pickers from the console's record editor | `pages/workflows/RecordsTab.tsx` (adding, viewer, edit and delete role), `data/pages/workflowDesign.ts`, `data/pages/generatedWorkflows.ts`, `workflows.addingRole`, `workflows.whoEdits` and `workflows.whoDeletes` in `public/i18n.json`, and their tests. ISS-160 adds the role page ticks and does not name them |
| The words of the refusals | Section 3 proposes them; the owner reads them with the page |

Tags, the row dimension of D23 to D35, are managed under Groups: see [Tag management](tag-management.md).
