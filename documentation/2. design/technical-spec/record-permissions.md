# Record permissions

Design for ISS-149 (TD-5929 to TD-5932), amended for ISS-174. Decisions D1 to D18 were taken by the owner one by one on 2026-11-24. D19 to D35, on field level permissions, tags, groups and seats, and D36 to D44, on field codes and keys, RACI, the assumed group per session, keys and agent accounts, roles from seats, and edit and add without view, were taken the same day in the owner's own answers and are in sections 5 to 10. Where a later decision contradicts an earlier one, the earlier one is marked superseded in section 2 and listed in section 6. The Q&A of ISS-174 is still running, so the points not yet answered are in the section Open, asked one by one.

| Built | Planned |
|---|---|
| ISS-150, ISS-151 and ISS-162 are done (the plain four codes, the role list check, the inventory). Nothing else here is built | Every other row of section 4, and the changes of section 10 |

Sections 1 to 4 describe the first design, with the four plain codes `record.tender.add`, `.edit`, `.delete` and `.view`. D20, D21 and D36 replace the add, edit and view codes with field level codes, so read section 7 for the code forms in force.

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

D19 to D44 follow in section 5. Rows marked superseded stay for the record.

| # | Decision | Reason |
|---|---|---|
| D1 | Permissions are set on the role, in its permissions list. The record's Add, Edit, Delete and Viewer role fields go away | One place says what a role may do, so a role's card and page can show it all |
| D2 | Any number of roles can carry a permission | A record's rows are often added by more than one role, and the old single role field could not say so |
| D3 | Seeing every row is a permission, `record.<code>.view` | The viewer role field becomes the same kind of thing as the other three |
| D4 | Add, edit and delete do not imply view. A person must hold view too. Superseded in part by D43 and D44: edit and add may be held without view (section 6) | Each permission means one thing, so a role that may only add can be given exactly that |
| D5 | The hub switches at once, with red tests on every row path, no shadow run and no setting to go back | Two ways to decide who may touch a row would disagree, so there is only one |
| D6 | Existing agency files are converted once. An import that still has the old role fields is refused. Published versions need a republish | Nothing reads the old fields afterwards, and a refusal says what to fix |
| D7 | Generated permissions list no operations. The code is the check | The hub checks the code on the row routes; no tool is gated by it |
| D8 | The generated permissions are written into each publication | A version states what it grants |
| D9 | A publish is refused when a role carries a code no record gives | A code that gives nothing is a typo or a deleted record, and the role would look more powerful than it is |
| D10 | The console role page ticks them grouped by record, four ticks each | A record is what a person thinks in, and four ticks is the whole choice |
| D11 | The platform owner is checked like anyone else and needs the permissions through a role. Superseded in part by D33 and D42: the roles count only when the person's assumed group seats them, and the owner assumes a group like anyone (section 6) | One rule for everyone; it means the QA owner needs roles ticked for every record they work on |
| D12 | Designed workflow steps stay held by a role. Superseded in part by D33 and D42: a person holds the step only through a role seated for them in the group they have assumed (section 6) | A designed step is a person's job in a process, not a row action |
| D13 | The Role card line is called Permissions and shows code and name | The line lists permissions, so it says so, and a code alone is hard to read |
| D14 | Generated codes sit in the same permissions list as the catalogue codes | A role has one list, not two |
| D15 | The catalogue of 109 stays. Generated codes take the prefix `record.`, so they never meet it | A clash with a catalogue code cannot happen by construction |
| D16 | The form is `record.tender.add`, and the generated workflow's code is the same (it was `tender.add` after ISS-140) | One code names the permission, the workflow and its step |
| D17 | A role that holds a step of a subject workflow needs the view permission of the subject record, no exception. Superseded by D22, D28 and D32: the row must also be reached by a shared tag, and only the fields the person may view are shown (section 6) | The step loads the row, and a row is shown only to a role that may see rows |
| D18 | The scan before a publish refuses when a record has no role that may add to it, when a role holds a subject step without view of its subject, and when a role may add rows but lacks view of them. Superseded by D30, D31 and D35, and part (c) dropped by D44: part (a) stays, part (b) is to be re-asked, and what the scan checks now is not yet settled (section 6 and Open, asked one by one) | Each is a setup nobody could use, caught before it reaches a person |

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
| Through a role | A person holds a permission only through a role that carries it, the platform owner included (D11). Under D42 the roles are only those seated for the person in the assumed group. The QA owner is seated in two roles today (Practice Director and Project Manager), so for every record they work on one of their roles must carry the codes they use, or they are seated in more roles |
| Add is not view | A role with `record.tender.add` and not `record.tender.view` sees only the rows that name the person (a person picked in an answer), as a role without the viewer role does today; today add alone shows every row, so this is a change. The scan refused to publish it (D4, D18), and D44 drops that refusal: add without view is allowed (section 6) |
| Edit and delete | May be carried by nobody on purpose. The scan does not ask for them |
| A subject step | A role that holds a step of a workflow about a record needs `record.<code>.view` for that record, for example the Practice Director on Go or no-go and `record.tender.view` (D17). Without it the step page says the row cannot be shown |
| Designed steps | Held by a role as before (D12). A designed form step is not a row action |

### The refusals and findings

The words follow the scan's present wording. They are proposed here and are final when the owner has read them.

| Check | Where | Words |
|---|---|---|
| A role carries a code no record gives (D9) | Create and update of a role, import, publish | `Role R-15 "Tender Scout" declares permission "record.bid.add", which no record of this draft gives` |
| A record has no role that may add to it (D18) | Scan, so the publish | `Record tender "Tender" has no role that carries record.tender.add, so nobody may add a row of it` |
| A subject step without view (D18, part b, superseded and to be re-asked) | Scan, so the publish | `Role R-1 "Practice Director" holds the step "Go or no-go" of a workflow about Tender, and does not carry record.tender.view` |
| Add without view (D18, dropped by D44) | Scan, so the publish. No longer refused | `Role R-15 "Tender Scout" carries record.tender.add and not record.tender.view, so it could add rows it cannot see` |
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
| ISS-165 | The record editor drops the four role pickers, and saving a record sends no role field | Console: `pages/workflows/RecordsTab.tsx`, `data/pages/workflowDesign.ts` (`RecordDraft`, `recordOf`, `saveDesign`; a loaded record's role fields are no longer carried back), `workflows.whoAdds`, `workflows.whoSees`, `workflows.whoEdits`, `workflows.whoDeletes` and `workflows.addingRole` out of `public/i18n.json` in all seven languages, their tests, the workflow-edit mockups | No. Done on branch iss165 |
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

## 5. Decisions D19 to D44 (field level, tags, groups, seats, keys, sessions)

Taken by the owner on 2026-11-24 and recorded one by one as notes on ISS-174. The reason column gives the owner's words or the rule they follow; no reason is added that the owner did not give. The notes start at D20, so D19 is the request that opened the Q&A. D36 to D44 are the newer notes and were not on the first merged version of this page.

| # | Decision | Reason or source |
|---|---|---|
| D19 | Permissions need a finer level than `record.<code>.edit`: a role may be given single fields, and rows may be limited by who they belong to | The owner's request that opened ISS-174 |
| D20 | `edit.*` replaces `edit`. The codes are `record.<code>.edit.*` (every field) and `record.<code>.edit.<field>`. D36 extends the same form to add and view | Note D20 |
| D21 | The field level applies to add, edit and view. Delete stays whole-row (confirmed by D29) | Note D21 |
| D22 | A person sees only the fields they hold view for, even on their own rows | Note D22 |
| D23 | The row dimension is tags. A system tag `all` always reaches every row and is still limited by the field codes | Note D23 |
| D24 | Apart from `all`, tags are managed after the publish, not written in the agency file. The publication carries only field codes | Note D24 |
| D25 | Tags are assigned in user management: users are put in groups, and a group is given tags and roles | Note D25 |
| D26 | A user logs in and assumes a group; the group's tag is the tag the user carries. Only add can change a tag, by adding. The part that said every record the user handles takes the tag if it lacks it is superseded by D27 | Note D26 |
| D27 | A row takes the tags of the group the user has assumed at the moment it is added. After that tags change only when someone holding the add code of that record adds a further tag. A row that existed before tags is reachable only through the tag `all` | Note D27 |
| D28 | A person reaches a row when the row and the assumed group share at least one tag; the tag `all` reaches every row | Note D28 |
| D29 | Delete stays one code, `record.<code>.delete`, with no field part. It applies to rows the assumed group reaches by tag | Note D29 |
| D30 | The star is stored as written and means every field the record has at the time of the check, so a field added later is covered at once; a role with named fields never gets the new one. The scan checks that a named field exists in the record | Note D30 |
| D31 | A person who holds add for only some fields adds a row with those fields. The others stay empty and are filled later by someone with edit on them. If the record marks a field required and the adding role lacks add for it, the add is refused with a message naming the field | Note D31 |
| D32 | A person who has not assumed a group, or whose group has no tags, reaches no rows, even when the role holds view codes. A person in several groups picks one at login and may switch (per login session, D40). The owner also asked for a cleanup that tags the existing rows so test data stays reachable (ISS-175) | Note D32 |
| D33 | A person who assumes a group acts with only that group's roles, and the group's tags decide the rows. Switching group changes both | Note D33 |
| D34 | A role seat names the person, the role and the group (Anna is Practice Director in the group emea). The import refuses a seat without a group. Each of the 36 IAS role assignments gains a group. The import refusal is superseded by D35. D35 also says the file carries seats with no group. D39 then says the 36 are not person seats at all, so the group on each of the 36 is superseded by D39 | Note D34 |
| D35 | Groups are created after the publish, like tags. The agency file carries seats with no group. An administrator creates groups and moves seats into them after the publish. An imported Instance has seats with no group until it is set up, and a person with no assumed group reaches no rows | Note D35 |
| D36 | Add, edit and view are all field codes: `record.<code>.add.*`, `add.<field>`, `edit.*`, `edit.<field>`, `view.*`, `view.<field>`. The plain `add`, `edit` and `view` no longer exist. `delete` stays `record.<code>.delete`. This supersedes the plain codes of D1 to D3 and sections 1 to 4, and settles the point D20 left for add and view | Note D36 |
| D37 | Every field gets a code a person can read, such as `closing_date`. The permission is `record.<record code>.<action>.<field code>`, for example `record.tender.edit.closing_date`. The field code is its own stored code, as record codes are, not worked out from the prompt | Note D37, owner's words |
| D38 | Each field gets a stable hidden key, and rows are saved under the key (today rows are keyed by prompt text, `Answers map[string]string` in `models/record.go`). The readable field code is a label on the key, so it may be renamed and the roles carrying it follow in the same save; the live Instance takes the new code at the next publish. Old records get keys on import. This adds sibling work (the key in the model, rows saved by key, migration of existing rows) before any field level check | Note D38 |
| D39 | RACI labels become one accountable role per step, a field on the step. All 36 in the IAS file are "accountable"; 23 repeat the step's own role and 13 sit on steps with no role of their own. The duplicates and the four value label go; the 36 become 13 step fields. The 36 are not person seats and are not touched by D34 or D35 | Note D39 |
| D40 | The assumed group is per login session, not per person. Each login asks again; a phone and a laptop may act as different groups at once; nothing is remembered between logins | Note D40 |
| D41 | An API key or AI agent account acts as one group, set once on the key by an administrator, with that group's roles and tags. There is no choice at run time | Note D41 |
| D42 | A person's roles come only from the seats they hold in the assumed group. The member's own linked role no longer counts. The platform owner assumes a group like anyone. This removes two of the three role sources in `heldRoleKeys` and its four copies | Note D42 |
| D43 | A role may hold edit for a field without view for it (a blind update). The scan does not refuse it. Fields a person cannot edit are carried over unchanged when they save | Note D43 |
| D44 | Add without view is also allowed. D18 part (c), a role that may add rows but lacks view, is dropped. D18 part (a), a record no role may add to, stays. D18 part (b) is superseded by field codes and D33 and is to be re-asked with the scan question | Note D44 |

## 6. Earlier decisions that D19 to D44 change

| Earlier | Status | By | What changes |
|---|---|---|---|
| D12, designed steps stay held by a role | Superseded in part | D33, D42 | A step is still held by a role, but a person holds it only through a role seated for them in the group they have assumed, and by no other source. With no assumed group no step is held |
| D17, a subject step needs the view permission of the subject record, no exception | Superseded | D22, D28, D32 | View is now per field and the row must also be reached by a shared tag. The step page shows the fields the person may view of a row the person reaches, and says nothing else. There is no longer one view permission to ask for |
| D18, the three scan refusals | Superseded | D30, D31, D35, D43, D44 | Part (a), a record no role may add to, stays (D44). Part (b), a subject step without view, is superseded by field codes and D33 and is to be re-asked with the scan question. Part (c), a role that may add rows but lacks view, is dropped (D44), and D43 says the same for edit. Two checks now exist (D30, a named field must exist; D31, a required field that no adding role can fill is refused at the add). What the scan checks is not yet settled |
| ISS-155 and the sibling's import refusal of a seat without a group (D34) | Superseded | D35 | The import accepts seats with no group. The refusal of the record's old role fields (D6) is not touched and stays |
| D26, every record a user handles takes the tag if it lacks it | Superseded | D27 | The tag is taken once, when the row is added |
| D11, the owner needs the permissions through a role | Changed | D33, D42 | The owner needs them through a role seated in the assumed group, and assumes a group like anyone (D42). The earlier open point on the platform owner is answered for roles; the pass on catalogue permissions is still not said (Open points from the first design) |
| D3, view is one permission for every row | Changed | D21, D22, D28 | View is per field, and rows are reached by tag |
| D4, add, edit and delete do not imply view, a person must hold view too | Superseded in part | D21, D43, D44 | Still true per field: add for a field does not give view of it. The second half, that a person must hold view too, no longer holds for edit (D43) or add (D44), which may be held without view |
| D10, four ticks per record on the role page | Changed | D20, D21 | A record now has a grid of fields by add, edit and view, plus delete |
| The plain codes `record.<code>.add`, `.edit` and `.view` (D1 to D3, D10, D16, sections 1 to 4) | Superseded | D20, D21, D36 | They no longer exist. Add, edit and view are field codes, and only `delete` has no field part. Read section 7 for the forms in force |
| D34, each of the 36 IAS role assignments gains a group | Superseded | D39 | The 36 are RACI labels on steps, not person seats. They become 13 step fields with one accountable role, and no group is given to them. Person seats are made after the import through the actor sibling, which already requires a group |
| D32, a person in several groups picks one at login and may switch | Made exact | D40 | The choice is per login session. A phone and a laptop may act as different groups at once, and nothing is remembered between logins |
| A person's roles from the member's linked role, from roles given to a group, and from actor seats (the three sources the hub reads today) | Changed | D42 | Roles come only from the seats the person holds in the assumed group. The note says two of the three sources go; the member's linked role is named and the other is read as the roles given to a group |
| An API key or agent account chooses nothing at run time | New | D41 | It acts as one group set on the key by an administrator, with that group's roles and tags |
| D16, one code names the permission, the workflow and its step | Not settled | D20 | See Found while writing this page: the generated workflow and its step against the field codes |
| D8, the publication lists the generated permissions | Stands, longer | D24, D30 | The list holds the field codes and the star as written. It holds no tag, group or seat |

## 7. The code forms

The form is `record.<record code>.<action>`, with a field part on add, edit and view. A record code has no dot (see [Record codes in an agency file](agency-import-record-codes.md)). The field part is the field's own readable code, for example `closing_date` (D37), so a permission reads `record.tender.edit.closing_date`.

| Code | Means |
|---|---|
| `record.tender.add.<field>` | May fill that field when adding a tender row |
| `record.tender.add.*` | May fill every field the record has at the time of the check (D30) |
| `record.tender.edit.<field>` | May change that field of a row the assumed group reaches |
| `record.tender.edit.*` | May change every field the record has at the time of the check |
| `record.tender.view.<field>` | May see that field of a row the assumed group reaches |
| `record.tender.view.*` | May see every field the record has at the time of the check |
| `record.tender.delete` | May delete a whole row the assumed group reaches. No field part and no star (D29) |

| Rule | Value |
|---|---|
| Plain codes | `record.tender.add`, `record.tender.edit` and `record.tender.view` no longer exist. Add, edit and view are all field codes (D36, confirming D20 and D21). Only `delete` has no field part |
| Field code | Every field has a readable code, such as `closing_date`. It is stored with the field, as a record's code is, and is not worked out from the prompt when a check runs (D37) |
| Field key | Every field also has a stable hidden key. Rows are saved under the key, not under the prompt text as today (`Answers map[string]string` in `models/record.go`). The readable code is a label on the key (D38) |
| Renaming a field code | Allowed. The roles that carry the old code take the new one in the same save. The live Instance takes the new code at the next publish (D38) |
| Old records | Get keys when they are imported (D38) |
| The star | Stored as written. It is read at the time of the check, so a field added to the record later is covered for a role that holds the star and never for a role that names fields (D30) |
| A named field | Must exist in the record, checked by the scan (D30). Deleting a field leaves its codes on the roles until the scan refuses the publish |
| Action | Still `add`, `edit`, `view` or `delete`. It is now the third part of the code, not what follows the last dot |
| Tags | Never in a code. Tags are not in the agency file or the publication (D24) |
| Not said | How a field's code is first set when the field is made, and which characters it may hold. D37 asked how it is set and D38 answers only the rename |

## 8. The data model with fields, tags, groups, seats and the assumed group

### Before

The model after D1 to D18, with the seat as the hub makes it today (the seats of `agency/import-run.md` in the IAS repo are an actor, a group and a role kind), rows saved under the prompt text, three sources of a person's roles, and RACI labels on steps.

```
 Record (tender)  ---- derives ----> four codes: record.tender.add / edit / delete / view
   questions keyed by their prompt text                 |
                                                        | ticked into
                                                        v
 Role (Tender Scout, R-15)  permissions: catalogue codes + the four codes
        ^
        | role kind (definition_role_id is the role's code)
        |
 Seat (actor role-assignment): person + group + role kind
        |
 Person ---- roles from three sources at once ----> acts
        1. the member's linked role
        2. roles given to a group
        3. actor seats

 Step: role assignments with a label (36 in the IAS file, all "accountable")
 Row (tender): answers saved by prompt text; no tag, no owner but the record
 Row check: does one of the person's roles carry record.tender.<action>?
```

### After

```
 AGENCY FILE (frozen by a publish)
   Record (tender)
     Field: key (hidden, stable), code (readable, closing_date), prompt   (D37, D38)
        ---- derives ----> record.tender.add.<field code> / add.*
                           record.tender.edit.<field code> / edit.*
                           record.tender.view.<field code> / view.*
                           record.tender.delete
   Role.permissions: catalogue codes + record codes, the star stored as written
   Step: one accountable role, a field on the step                      (D39)
   Seats with no group
   no tags, no groups   (D24, D35)

 AFTER THE PUBLISH (set up by an administrator, D24, D35)
   Tag: name; `all` is the system tag (D23)
   Group: name, tags (D25, D28), created after the publish
   Seat: person + role + group (D34); the file's seat has no group until moved
   Person logs in and assumes one Group, each login, may switch (D32, D40)
        acts with: the roles seated in that group, and no others   (D33, D42)
                   the tags of that group                           (D33)
   API key or AI agent account: one Group set on the key by an administrator,
        with that group's roles and tags, no choice at run time     (D41)

 ROW (tender)
   fields saved under their keys                                    (D38)
   tags: taken from the assumed group when the row is added (D27);
         a further tag only by someone who holds add, by adding (D27)

 CHECK, in order
   1. A group is assumed (by the login, or set on the key) and has tags;
      if not, no rows at all (D32, D41)
   2. The row shares a tag with the group, or the group has `all` (D28)
   3. A role seated in the group carries the code for the action,
      each action on its own (add and edit need no view, D43, D44):
        add      .add.<field> or .add.* for each field written (D31)
        edit     .edit.<field> or .edit.* for each field changed;
                 fields the person cannot edit are carried over unchanged (D43)
        view     .view.<field> or .view.* for each field shown (D22)
        delete   .delete, whole row (D29)
```

### What changes, field by field

| Where | Field | Before | After |
|---|---|---|---|
| Record | `code`, `questions` and the rest | As section 1 | Same. The questions are the fields the codes name |
| Field (question) | `key` | None. Answers are saved under the prompt text | New. A stable hidden key; rows are saved under it (D38) |
| Field (question) | `code` | None | New. A readable code such as `closing_date`; a label on the key, renameable, and the roles follow in the same save (D37, D38) |
| Role | `permissions` | Four codes per record | Field codes and stars per record, and `record.<code>.delete` |
| Publication | list of generated permissions | Four per record | Field codes and stars as written. No tags, groups or seats |
| Step | the accountable role | Role assignments with a label, 36 in the IAS file | One accountable role on the step; the 36 entries become 13 step fields (D39) |
| Agency file seat | the person and the role | Person and role | Person and role, no group (D35). The old D34 group is dropped |
| Group | `tags` | None | A list of tags, set after the publish (D25) |
| Group | created in | The Instance, by the owner's call | After the publish, by an administrator (D35) |
| Seat | `group` | In the actor module a seat names a group already | Required for the person to use the role; absent until set up (D34, D35). It is now the only source of a person's roles (D42) |
| Person | assumed group | None | Chosen at each login, may be switched (D32, D40). Where it is kept is a mechanism to confirm (see Open) |
| API key or AI agent account | group | None | One group, set once on the key by an administrator (D41) |
| Row | `answers` | By prompt text | By field key (D38) |
| Row | `tags` | None | A list, set at add from the assumed group (D27). Where it is stored is not decided |
| Tag | name | None | New. Created after the publish; `all` is built in (D23, D24) |

## 9. A worked example from the IAS tender record

The IAS tender record has ten questions: Tender title, Issuer, Where it was found, Country, Service line, Closing date, Estimated value, Eligibility conditions we may not meet, Entered by and Outcome. Five are required: Tender title, Issuer, Where it was found, Service line and Closing date. In the file today the Tender Scout (R-15) adds tenders and the Practice Director (R-1) deletes them.

The roles and codes below show how the rules work. They are not the owner's choice for the IAS file. Each question gets a readable field code (D37). `closing_date` is the owner's own example; the other codes are made up in the same style for this page.

| Role | Codes it carries |
|---|---|
| Tender Scout (R-15) | `record.tender.add.tender_title`, `.issuer`, `.where_it_was_found`, `.service_line`, `.closing_date`, `.country`. No view code |
| Bid Manager (R-3) | `record.tender.edit.*`, `record.tender.view.*` |
| Practice Director (R-1) | `record.tender.view.*`, `record.tender.edit.outcome`, `record.tender.delete` |
| Project Manager (R-6) | `record.tender.view.tender_title`, `.issuer`, `.outcome` |

The groups, set up after the publish: `emea` with the tag `emea`, `apac` with the tag `apac`, and an administrator group with the tag `all`.

| Step | What happens | Decision |
|---|---|---|
| 1 | Anna is seated as Practice Director in `emea`. She logs in, assumes `emea`, and acts as Practice Director with the tag `emea` | D33, D34, D40 |
| 2 | A scout in `emea` adds a tender. The row takes the tag `emea`. Each answer is saved under its field key | D27, D38 |
| 3 | The scout filled the five required fields and Country, and left Estimated value, the eligibility note, Entered by and Outcome empty. The add is accepted | D31 |
| 4 | A scout role that lacked `add.closing_date` would be refused with a message naming Closing date, because the record marks it required | D31 |
| 5 | The scout carries no view code, so the scout may add rows and sees none of them, not even the row just added. The scan does not refuse this | D44 |
| 6 | Anna opens the row. She shares the tag `emea` with it, and holds `view.*`, so she sees all ten fields, the empty ones too | D28, D22 |
| 7 | A Practice Director in `apac` opens the same row. No tag is shared, so the row is not in the list | D28 |
| 8 | A Project Manager in `emea` opens it. She shares the tag and sees Tender title, Issuer and Outcome and nothing else, even on a row that names her | D22 |
| 9 | Anna sets Outcome to "Won and handed over". She holds `edit.outcome` and the row is reached. Her save leaves every other field as it was | D20, D28, D43 |
| 10 | Suppose a role carries `record.tender.edit.closing_date` and no view for it. It may change the closing date without seeing it; the scan does not refuse the role, and the fields it cannot edit are carried over unchanged when it saves | D43 |
| 11 | Anna deletes a row of `emea`. `record.tender.delete` has no field part; she may, because the row is reached by tag | D29 |
| 12 | A tender added before tags existed has no tag. Only a person who assumed a group with the tag `all` reaches it | D27, D23 |
| 13 | Someone with no assumed group, or whose group has no tags, sees no tender, although the role carries view | D32 |
| 14 | A field "Bid reference" is added to the record next month. The Bid Manager's `edit.*` and `view.*` cover it at once. The scout's named codes do not | D30 |
| 15 | The designer renames the code `closing_date` to `bid_deadline`. The saved rows are untouched, because they are kept under the field's key. Every role that carried `record.tender.edit.closing_date` carries `record.tender.edit.bid_deadline` after the same save. The live Instance takes the new code at the next publish | D38 |
| 16 | Anna logs in on her phone and assumes `apac`, and on her laptop assumes `emea`. The two sessions act as different groups at once, and neither choice is remembered by the next login | D40 |
| 17 | Anna's member record is linked to a role. That link gives her nothing. Her roles are only those seated for her in the group she assumed | D42 |
| 18 | An AI agent account for the tender scouts is set by an administrator to act as `emea`. It acts with the roles and tags of `emea` and is never asked to choose | D41 |

## 10. Which issue each decision changes

ISS-152 onward are held until the amendment settles. ISS-160 (ticks) and ISS-165 (backend may still require `role_id` until ISS-155) are held unmerged. ISS-150, ISS-151 and ISS-162 are done, so a change to them means a follow-up issue. ISS-178 to ISS-181 are the new small issues D36 to D44 call for. This page files nothing itself.

| Issue | Now | Decisions | The change |
|---|---|---|---|
| ISS-148 | To do | D20, D21, D36 | The Role card line lists field codes and stars. A long list may need grouping by record |
| ISS-149 | Done | all | This page. D19 to D44 added |
| ISS-150 | Done | D20, D21, D29, D30, D36, D37 | The derive emits field codes, the stars and `delete`, not four plain codes, and names each field by its readable code. Follow-up needed |
| ISS-151 | Done | D20, D30, D38 | The role list accepts field codes and the star and refuses a field the record lacks. A rename moves the codes on the roles in the same save. Follow-up needed |
| ISS-152 | To do, held | D24, D30 | The publication lists the field codes and the stars as written. It carries no tag, group or seat |
| ISS-153 | To do, held | D20, D36 | The generated workflow and step codes meet the field part. Not settled, see Found while writing this page |
| ISS-154 | To do, held | D18 superseded, D30, D31, D35, D43, D44 | The three D18 refusals go. A named field must exist (D30). Edit without view (D43) and add without view (D44) are not refused. The rest is not settled |
| ISS-155 | To do, held | D35 | No seat refusal for a missing group. The seat model of the sibling carries person and role in the file, and the group is set after the publish. The refusal of the old role fields stays |
| ISS-156 | To do, held | D20, D24, D30, D35, D36 | The import reads field codes and stars, refuses a field the record lacks, and accepts seats with no group. A file carrying tags is not expected. It takes ISS-178 for the keys |
| ISS-157 | To do, held | D12 superseded in part, D33, D42 | A step is held by a role seated in the assumed group, and by no other source. How a step held through several codes is found is not settled |
| ISS-158 | To do, held | D21, D22, D26 to D29, D31 to D33, D38, D40, D42 to D44 | Row check by assumed group, tag, field code, delete by tag, add refused for a required field, no group means no rows, tags stamped at add. Rows read and written by field key. Roles read only from the seats of the assumed group, which ends `heldRoleKeys` and its four copies reading three sources. Edit and add need no view, and an edit keeps the fields the person cannot edit. The largest change, and likely to be split |
| ISS-159 | To do, held | D17 superseded, D22, D28 | A subject step shows only the fields the person may view, of a row the person reaches |
| ISS-160 | To do, held | D20, D21, D30, D36, D43, D44 | The role page ticks a grid of fields by add, edit and view, with the star, plus delete. Any tick may stand without a view tick. It was built with the plain four codes and stays unmerged |
| ISS-161 | To do | D20, D30, D35, D36, D39 | Roles carry field codes (the star where the role did the whole action). The group per seat of D34 is dropped by D35. The 36 role assignments are not seats; they become 13 step fields (D39, with ISS-179) |
| ISS-162 | Done | D20, D36 | The conversion issues per repo (ISS-166 to ISS-171) now convert to field codes, the star for what a role did whole |
| ISS-163 | To do | D32, D33, D35, D39, D42 | The QA import must also give the Instance a working first group, with seats for the people, because only seats in the assumed group give roles. The 36 role assignments need no group (D39). Not settled |
| ISS-164 | Done | none | Not related: the console chat tool list. Listed so the range is complete |
| ISS-165 | To do, held | none in scope | The editor drops the four role pickers as planned. It waits as ISS-155 does |
| ISS-175 | To do | D27, D32, D35, D42 | Existing rows get a tag so a person who assumes a group reaches them, and the first group has seats, since the member's linked role no longer counts. Which tag is open |
| ISS-176 | Merged on dev | D23, D24, D25, D28, D35 | Tag management inside user and group management: tags, groups, seats after the publish. Its three open questions go to the owner one by one |
| ISS-177 | In progress | D26, D32, D33, D40 | The login screen where a person picks the group to assume, built on `entry/group-pick.html` of ISS-176. Each login asks again (D40), so the issue's wording "remembered" holds only as a hint, which is open |
| ISS-178 | New | D37, D38 | Sibling, before any field-level check: a stable hidden key and a readable code on each field in the model, rows saved by key, and the migration of existing rows and records to keys |
| ISS-179 | New | D39 | Sibling and hub import: one accountable role per step as a field on the step, the role brief reading it, and the conversion of the IAS file from 36 role assignments to 13 step fields |
| ISS-180 | New | D40, D42 | The assumed group per login session: the hub keeps the choice keyed by session and Instance and drops it when the session ends (mechanism to confirm), and roles are read only from the seats of that group |
| ISS-181 | New | D41 | An API key or AI agent account acts as one group, set once on the key by an administrator, with that group's roles and tags |

## Open, asked one by one

These are not decided and are being asked of the owner. Nothing below is a decision. Questions 1 to 5 of [the row path inventory](record-permissions-hub-paths.md) are answered by D36 to D43 (question 1 by D39, 2 by D40 and D41, 3 by D42, 4 by D36 to D38 and 5 by D43). The rest of its questions 6 to 15 are asked one by one, and these are the points the Q&A has named as open.

| Point | Why it matters | State |
|---|---|---|
| What the scan checks now | D18 is superseded: part (a), a record no role may add to, stays; part (b), a subject step without view, is superseded by field codes and D33 and is to be re-asked here; part (c) is dropped by D44. D30 gives the named field check and D31 a refusal at the add. D43 and D44 say edit and add without view are not refused. Whether a required field that no role may add is refused at the publish, whether delete without view is flagged, and what can be checked about groups and tags that exist only after the publish, are not answered | Not asked yet |
| How the QA and demo Instances get a working first group | Under D35 an imported Instance has seats with no group, and a person with no assumed group reaches no rows. Under D42 only seats in the assumed group give roles. ISS-163 and ISS-175 must give the QA and demo Instances a group with a tag and seats. The earlier QA seats made one group per role, "Team of <role>", with no tag | Not asked yet |
| Who may tag a row and who may give `all` | Whether a group may carry `all` with other tags, and who may give a group the tag `all`, are not said. D27 lets the holder of the add code add a further tag | Not asked yet |
| Where tags are stored | Group tags in a hub table and row tags in a new field of the agency sibling, or both in the hub (the inventory recommends the first). Decided nowhere | Not asked yet |
| Who administers groups and tags | D35 and D41 say an administrator. Which permission an administrator holds, and whether the platform owner is one, is not said. D42 makes the owner assume a group like anyone, so the owner's own pass is unclear | Not asked yet |
| What the Earlier answers and send back follow | Whether the earlier answers shown to the holder of the next step and the sent-back note follow the view codes, which code send back needs, and who sees the delete reason (`deleted_reason`), a system answer and not a field of the record | Not asked yet |
| Owner rows and designed steps | Whether a person always reaches the rows that name them or that they added, whatever the tags and the assumed group (today they do), and whether a designed form step's row write needs the add code and field add codes of its derived record or holding the step is enough | Not asked yet |

### Decided points with a detail still to confirm

| Point | What is still said to confirm |
|---|---|
| Where the assumed group is kept (D40) | D40 gives the mechanism to confirm: a session names only the person, so the hub keeps the choice keyed by session and Instance, and drops it when the session ends |
| A remembered choice on the login screen (D40) | Whether the login screen preselects the last choice. ISS-177 asks "remembered", which D40 contradicts unless it stays as a hint |
| How a field code is set (D37) | D37 asked how a field code is set. D38 answers that it may be renamed later, and does not say how it is first given |

### Found while writing this page, not yet asked

| Point | Why it is unclear |
|---|---|
| The numbering | The notes begin at D20. This page treats D19 as the request that opened the Q&A |
| The generated workflow and its step | The first design names them `record.tender.add` and `record.tender.add.1`. With `add.<field>` the step code looks like a field code, and one workflow per action may need a field-free name. Whether a step is held by a role that carries any field of the action is not said |
| A designed step under D33 | D12 keeps designed steps with a role. Whether a designed step still needs a tag-reached row, and which, is not said. This is the designed steps point above |
| Which two role sources go under D42 | The inventory lists three sources: the member's linked role, roles given to a group, and actor seats. D42 names the member's linked role and says two of the three go and roles come only from seats in the assumed group. Whether "roles given to a group" is the second is read from that wording |
| An API key's administrator | D41 says an administrator sets the group on the key. Which permission, and where the key's group is stored, is not said |

## Open points from the first design

| Point | Why it is not decided |
|---|---|
| What the hub reads where it reads `record.RoleID` today for a sent form | `step_runs.go`, `send_back_step.go`, `earlier_steps.go` and `record_rows.go` store or show the role that sent a row, taken from the record. With no field, the step's role is the likely answer. The decisions do not say |
| Whether a designed form step's row write also needs the add permission | D12 keeps the step with its role, and D18 asks every record for a role that carries add. A derived record of a designed step (the 23 of the IAS file) has both a step holder and an add holder, and the decisions do not say if the step holder needs the code. This is the designed steps point above |
| Whether the platform owner keeps the pass on catalogue permissions | D11 says the owner is checked like anyone else, and D42 that the owner assumes a group like anyone. `callerRolesIn` lists every catalogue code for the owner today. This page applies D11 and D42 to record permissions only; ISS-158 names rows only |
| The direct row write | `addLiveRow` lets only the platform owner write a row outside a step. Whether that stays once the owner needs a role is not said |
| Where the hub reads a role's list | The hub reads a role's permissions from the live draft (`GetRole`, cached by tenant), not from the publication. D8 puts the list into the publication; nothing in the decisions says the hub reads it there |
| What the generated workflows view shows as the actor once a record has no role field | `data/pages/generatedWorkflows.ts` (`roleKeyOf`) names the actor of a generated workflow from the record's role fields. ISS-165 took the pickers and the saved fields out of the record editor and left this read as it is. The roles that carry the code are the likely answer once ISS-157 lands |
| The words of the refusals | Section 3 proposes them; the owner reads them with the page |

Tags, the row dimension of D23 to D35, are managed under Groups: see [Tag management](tag-management.md).
