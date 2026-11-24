# Record permissions

Design for ISS-149 (TD-5929 to TD-5932), amended for ISS-174. Decisions D1 to D18 were taken by the owner one by one on 2026-11-24. D19 to D77 were taken the same day in the owner's own answers, as notes on ISS-174: D19 to D47 on field level permissions, tags, groups, seats, field codes and keys, RACI, the assumed group per session and roles from seats (section 5), and D48 to D77 on who administers tags and groups, the scan, the first group, agents, readable record codes, UUID keys, the long permission names, what Earlier answers and send-back show, designed steps, the register of declarations, direct row writes, task tags, backlog access, generated names and holders, first field codes and where roles are read (section 5b). Where a later decision contradicts an earlier one, the earlier one is marked superseded in section 2 and listed in section 6. The points still open after D77 are in the section Open after D77, and what the decisions settled is in the table Settled by the decisions. The screen where a person with several groups assumes one is [Group screen](group-screen.md).

| Built | Planned |
|---|---|
| The state of every issue is the board's on 2026-11-24 and is listed in section 10. Done: the field codes and keys (ISS-178, ISS-182), the row tags in the sibling (ISS-186), the tag and group tag stores (ISS-187), the one role resolver (ISS-188), keys that assume a group (ISS-194), readable record codes and UUID keys (ISS-195, ISS-201), the group screens (ISS-197, ISS-198), disabled groups (ISS-204) and the long permission names (ISS-205) | The row check, the reach rule, the stamping of tags, the field views, the generated workflow names and holders, the publication list, the scan, the import of field codes, the file conversions and the QA data (section 10) |

Sections 1 to 4 describe the first design, with the four plain codes `record.tender.add`, `.edit`, `.delete` and `.view`. D20, D21 and D36 replace the add, edit and view codes with field level codes, D58 and D61 give a record a readable code and a UUID key, and D75 renames the generated workflows. Read sections 7 and 8 for the code forms and the data model in force, and section 10 for the issues as they stand.

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

D19 to D47 follow in section 5 and D48 to D77 in section 5b. Rows marked superseded stay for the record.

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
| D16 | The form is `record.tender.add`, and the generated workflow's code is the same (it was `tender.add` after ISS-140). Superseded in the naming by D36 and D75: the permissions are field codes, and the workflow and its step are `record.tender.add` and `record.tender.add.1` as a name of their own, not a permission code (section 6) | One code names the permission, the workflow and its step |
| D17 | A role that holds a step of a subject workflow needs the view permission of the subject record, no exception. Superseded by D22, D28 and D32: the row must also be reached by a shared tag, and only the fields the person may view are shown (section 6) | The step loads the row, and a row is shown only to a role that may see rows |
| D18 | The scan before a publish refuses when a record has no role that may add to it, when a role holds a subject step without view of its subject, and when a role may add rows but lacks view of them. Superseded by D44 and D51: part (a) stays, part (b) is not checked, part (c) is dropped, and D51 adds a check of a required field that no role may add (section 6) | Each is a setup nobody could use, caught before it reaches a person |

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

This section is the first plan, written for the four plain codes. The scope and state of each issue as it stands after D77 are in section 10, which wins where the two differ.

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

## 5. Decisions D19 to D47 (field level, tags, groups, seats, keys, sessions)

Taken by the owner on 2026-11-24 and recorded one by one as notes on ISS-174. The reason column gives the owner's words or the rule they follow; no reason is added that the owner did not give. The notes start at D20, so D19 is the request that opened the Q&A. D56 and D57 are numbered after D55 and sit in section 5b.

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
| D40 | The assumed group is per login session, not per person. Each login asks again; a phone and a laptop may act as different groups at once; nothing is remembered between logins. D64 confirms that no hint of the last group is kept | Note D40 |
| D41 | An API key or AI agent account acts as one group, set once on the key by an administrator, with that group's roles and tags. There is no choice at run time. Superseded by D55, then by D56 and D57 (section 5b) | Note D41 |
| D42 | A person's roles come only from the seats they hold in the assumed group. The member's own linked role no longer counts. The platform owner assumes a group like anyone. This removes two of the three role sources in `heldRoleKeys` and its four copies | Note D42 |
| D43 | A role may hold edit for a field without view for it (a blind update). The scan does not refuse it. Fields a person cannot edit are carried over unchanged when they save | Note D43 |
| D44 | Add without view is also allowed. D18 part (c), a role that may add rows but lacks view, is dropped. D18 part (a), a record no role may add to, stays. D18 part (b) is superseded by field codes and D33 and is to be re-asked with the scan question | Note D44 |
| D45 | A person who belongs to one group skips the group screen and goes straight in as that group. The header still names the group | Note D45 |
| D46 | A person with no group sees a plain message and reaches only their profile and sign-out. Business pages stay closed. The message named the hub administrator; D65 supersedes that wording only | Note D46 |
| D47 | No row is reachable because the person added it or is named on it. Reach is the tag rule only (D28). A person who adds a row as group A and later assumes group B with no common tag does not see it | Note D47 |

## 5b. Decisions D48 to D77 (administration, the scan, agents, codes, readers, names)

Taken by the owner on 2026-11-24 and recorded as notes on ISS-174, in the owner's wording as the notes give it. The third column says which earlier decision a row supersedes or settles; the fourth names the issue the note ties it to, where the note names one.

| # | Decision | Supersedes or settles | Issue |
|---|---|---|---|
| D48 | Any group administrator may give the tag `all` to a group, with or without other tags. It is not owner-only | Settles who may give `all` | ISS-187 (built) |
| D49 | The D39 RACI rule applies to every repo, not only IAS: one plain accountable role per step, the responsible, consulted and informed labels dropped, and labels on objectives (farmers, boda boda riders) dropped as well | Extends D39 | ISS-166 to ISS-171, ISS-179 |
| D50 | The four hackathon submission files stay frozen as submitted. They are not converted and the new import does not accept them. No conversion issue is filed for them | Settles the hackathon files | None |
| D51 | The publish scan checks two things about record permissions: a record no role may add to is flagged (D18 part a stays), and a required field that no role holds an add code for is flagged. It does not check delete without view, and nothing about groups or tags | Settles the scan. Supersedes D18 parts (b) and (c) as scan checks | ISS-154, ISS-161 |
| D52 | The QA and demo cleanup gives every existing row one tag (working name `test-data`, the owner may rename it), creates real groups carrying that tag, and seats the existing people in them. It is not one `all` group. The tag name and the group layout (one group, or one group per role) are for the first todo of ISS-175 to confirm | Settles the first group for QA and demo | ISS-175, ISS-163 |
| D53 | Deleting a tag is refused while any row or group still carries it. The tag page shows how many rows and groups carry it. Rows never lose a tag silently | Settles question 3 of the tag management design | ISS-187 (built), ISS-176 |
| D54 | A group can be disabled. A person logged in as a disabled group acts as no group from their next request (D32: no rows) until they pick another group. A key session set to it is refused. The group is not offered on the group screen. Seats, tags and rows stay untouched, so enabling the group brings everything back | Settles what a disabled group does | ISS-204 (built) |
| D55 | The D41 agent account is the granted service, with its group set on the grant. Replaced the same day by D56 | Superseded by D56 | None filed |
| D56 | AI agents act just like humans. An agent is a member with seats in groups, assumes a group per login session (D40), and gets its roles only from the assumed group's seats (D42) | Supersedes D55 and narrows D41 | ISS-194 |
| D57 | An agent working through an API key assumes a group like a person. The key stands for the agent member, each key session starts with no group (D32), and the agent calls the same assume-group route a person uses, choosing among its own groups. The fixed group on the key (ISS-181) and the 403 for keys on the assume-group routes (ISS-180) go | Supersedes D41 and D55 | ISS-194 (built) |
| D58 | The counter code `RC-n` for a record is deprecated. A record gets a readable code like `tender`, unique in the agency, and permissions read `record.tender.edit.closing_date`. A rename of the record code follows through the roles the same way a field code does (D38) | Settles the form of a record code in a permission | ISS-195 (built) |
| D59 | A step with its own acting role and a different accountable role is listed in the role brief of both roles. The acting role keeps the step it does and the accountable role also sees it | Settles the role brief | ISS-196 (built) |
| D60 | Creating, renaming and deleting a tag needs a permission of its own that a role can carry, separate from group administration. Giving a tag to a group stays with any group administrator (D48). The owner did not choose the code name | Settles who administers tags. The name `tag.manage` is proposed and built, and is not confirmed (see Open after D77) | ISS-187, ISS-202 (built) |
| D61 | The hidden key of a newly made record is a UUID, not the `RC-n` counter and not a hash. "Use a hash" meant a UUID. Old records keep their stored `RC-n` key, because rewriting it would break stored references. Generated workflow codes built from the key become UUID based until ISS-153 names them | Supersedes the first reading of D61 (a hash). Settles the key of a record | ISS-201 (built) |
| D62 | A home entry that names a record by code (`target`, `page_of`) is saved as the record's key, so a rename never breaks it | Follows D38 and D58 | ISS-201 (built) |
| D63 | Any group administrator may disable or enable a group. There is no separate permission | Settles the open point of D54 | ISS-204 (built) |
| D64 | No hint of the last group on the group screen. It is a plain list at every login | Settles the hint left open by D40 | ISS-197, ISS-198 (built) |
| D65 | The no-group message names nobody. It tells the person to ask whoever runs this hub | Supersedes the wording of D46 (the hub administrator) | ISS-206 (built) |
| D66 | The role page and the Role card show a field permission with the long wording as its name (a full sentence, for example "Add the closing date of a tender"; with a star, "Add every field of a tender"), and the field code beside it in its own field (`record.tender.add.closing_date`), not inside the name | Settles how a permission is named on screen. Confirmed by the owner | ISS-205 (built) |
| D67 | The Earlier answers on a step follow the field view rule: a field the person holds no view code for is hidden there too | Settles Earlier answers. Follows D22 | ISS-159, ISS-191 (neighbours) |
| D68 | The send-back reason, and the delete reason, is a note on the step. It is seen by whoever holds the step and by the person who sent it back. Field view codes do not apply to it | Settles send-back | None named |
| D69 | A designed workflow's form step writes a row only with the add (new row) or edit (existing row) field codes the person's role holds, the same rule as the generated steps. Holding the step is not enough | Settles designed steps. Narrows D12 | None named |
| D70 | Creating an Instance also creates a first group and seats its owner there as administrator, so the owner always has a group to assume (D42) | Settles the first group of a new Instance | ISS-203 |
| D71 | The register of declarations of interest (`declaration_register.go`, the tool `agency_list_declarations`, the council Declarations screen in the app) moves to the record codes. It follows the view field codes and the tags like every other record, and the separate `declaration.read` permission goes | Settles the register | Waits on ISS-158 and ISS-189 |
| D72 | The designer's row routes go through the same row check as everyone: field codes and tags of the assumed group, with no owner shortcut | Settles the direct row write | ISS-158 |
| D73 | Taskmanager tasks carry tags too: the assumed group decides which tasks a person sees. This is a separate, larger piece in the taskmanager sibling and the hub task board, and not part of the agency record work. It needs its own design issue before any build (how a task gets its tags, how backlogs and smart backlogs combine with tags, whether todos follow their issue) | Opens a design | ISS-207 |
| D74 | Backlog access levels (Can see, Can move) become their own check and use no roles and no seats. A backlog lists the groups that may see it and the groups that may move its issues, and the check is made for the group the person logged in as (D40, D42). The old `agency_group_roles` route for backlog access stops counting. The five tests ISS-188 skipped (four backlog access level tests and Journey07) are rebuilt on the new check | Follows D42 | ISS-208 |
| D75 | (a) The generated workflow and its step are named with a `record.` prefix: workflow `record.tender.add`, step `record.tender.add.1`. An existing generated workflow keeps its id, role assignments and replaced-by links through the rename. (b) A role holds the generated add step when it holds add for every required field of the record (`add.*`, or an `add.<field>` for each required field), the same rule as D31 and D51: the people who can add the mandatory fields are all given the add step, and the form shows the fields their role may add. For a record with no required field the reading used is that a role with `add.*` or at least one `add.<field>` holds the step. That reading is flagged on ISS-153 and ISS-157 for the owner to correct | Settles generated names and holders. Supersedes D16 in the naming | ISS-153, ISS-157 |
| D76 | A field's code is first set by the import proposing it. The agency file may name a code for a field. When it does not, the import proposes one from the prompt (Closing date becomes `closing_date`, a clash gets a number), shows the proposals, and the designer may rename any of them before the publish (D38). Existing files keep working without edits, and an IAS file need not write every code out | Settles how a field code is first set (left open by D37 and D38) | ISS-156 |
| D77 | The hub reads a role's permission list from the published version, not from the draft (D8). A designer's edit takes effect at the next publish, and the roles of an agency never published grant nothing | Settles where the hub reads a role's list | ISS-152, ISS-158 |

## 6. Earlier decisions that D19 to D77 change

| Earlier | Status | By | What changes |
|---|---|---|---|
| D12, designed steps stay held by a role | Superseded in part | D33, D42, D69 | A step is still held by a role, but a person holds it only through a role seated for them in the group they have assumed, and by no other source. With no assumed group no step is held. A designed form step writes a row only with the add or edit field codes the role holds (D69) |
| D17, a subject step needs the view permission of the subject record, no exception | Superseded | D22, D28, D32 | View is now per field and the row must also be reached by a shared tag. The step page shows the fields the person may view of a row the person reaches, and says nothing else. There is no longer one view permission to ask for |
| D18, the three scan refusals | Superseded | D44, D51 | Part (a), a record no role may add to, stays (D51). Part (b), a subject step without view, is not checked: D51 names two checks and this is not one of them. Part (c), a role that may add rows but lacks view, is dropped (D44), and D43 says the same for edit. D51 adds one check, a required field that no role holds an add code for. D30's check that a named field exists is made where a role's list is saved or imported (ISS-183), not by the publish scan |
| ISS-155 and the sibling's import refusal of a seat without a group (D34) | Superseded | D35 | The import accepts seats with no group. The refusal of the record's old role fields (D6) is not touched and stays |
| D26, every record a user handles takes the tag if it lacks it | Superseded | D27 | The tag is taken once, when the row is added |
| D11, the owner needs the permissions through a role | Changed | D33, D42 | The owner needs them through a role seated in the assumed group, and assumes a group like anyone (D42). There is no owner shortcut on the row routes (D72), and a new Instance seats its owner as administrator in a first group (D70) |
| D3, view is one permission for every row | Changed | D21, D22, D28 | View is per field, and rows are reached by tag |
| D4, add, edit and delete do not imply view, a person must hold view too | Superseded in part | D21, D43, D44 | Still true per field: add for a field does not give view of it. The second half, that a person must hold view too, no longer holds for edit (D43) or add (D44), which may be held without view |
| D10, four ticks per record on the role page | Changed | D20, D21 | A record now has a grid of fields by add, edit and view, plus delete |
| The plain codes `record.<code>.add`, `.edit` and `.view` (D1 to D3, D10, D16, sections 1 to 4) | Superseded | D20, D21, D36 | They no longer exist. Add, edit and view are field codes, and only `delete` has no field part. Read section 7 for the forms in force |
| D34, each of the 36 IAS role assignments gains a group | Superseded | D39 | The 36 are RACI labels on steps, not person seats. They become 13 step fields with one accountable role, and no group is given to them. Person seats are made after the import through the actor sibling, which already requires a group |
| D32, a person in several groups picks one at login and may switch | Made exact | D40 | The choice is per login session. A phone and a laptop may act as different groups at once, and nothing is remembered between logins |
| A person's roles from the member's linked role, from roles given to a group, and from actor seats (the three sources the hub reads today) | Changed | D42 | Roles come only from the seats the person holds in the assumed group. The note says two of the three sources go; the member's linked role is named and the other is read as the roles given to a group |
| D41, an API key or AI agent account acts as one group set on the key | Superseded | D55, D56, D57 | D55 moved the group to the granted service and D56 replaced it: an agent is a member with seats. A key session starts with no group and the agent assumes one of its own groups like a person, through the same routes. The fixed group on the key (ISS-181) and the 403 of the assume-group routes for keys (ISS-180) go (ISS-194) |
| D16, one code names the permission, the workflow and its step | Superseded in the naming | D36, D75 | The permissions are field codes. The generated workflow is `record.tender.add` and its step `record.tender.add.1`, a name of their own that is not a permission code. The step is held by a role that holds add for every required field of the record (D75) |
| D8, the publication lists the generated permissions | Stands, longer | D24, D30, D77 | The list holds the field codes and the star as written. It holds no tag, group or seat. The hub reads a role's list from the published version, not from the draft (D77) |
| D46, the no-group message names the hub administrator | Superseded in wording | D65 | The message names nobody and says to ask whoever runs this hub. The rest of D46 stands: a person with no group reaches only the profile and sign-out |
| D34, a role seat names the person, the role and the group, and the import refuses a seat without a group | Superseded | D35 | Groups are created after the publish. The file carries seats with no group, and an imported Instance has none until an administrator sets them up. D34 is also superseded for the 36 IAS assignments by D39 |
| D40, the login screen may keep the last choice as a hint | Settled | D64 | No hint. The group screen is a plain list at every login |
| D54, what a disabled group does, and who may disable it | Settled | D54, D63 | Acts as no group from the next request; a group administrator may disable and enable it, with no separate permission |
| D55, the agent account is the granted service with a fixed group | Superseded the same day | D56, D57 | An agent is a member with seats and assumes a group like a person |
| D61 as first noted, the hidden key of a new record is a hash | Clarified | D61 | The key is a UUID. Old records keep their `RC-n` key |
| D58, a record code `RC-n` | Deprecated | D58 | A readable record code such as `tender`. The permission reads `record.tender.edit.closing_date`. Old counter codes in a file are the conversion issues' work |
| D37 and D38, how a field code is first set | Settled | D76 | The import proposes it, the file may name it, and the designer may rename it before the publish |
| D17 and D3, the step page and the lists show a row to whoever may view rows | Changed | D22, D67, D68, D71 | A field a person holds no view code for is hidden on the step page, in Earlier answers, in the record list and row list, and in the register of declarations. The send-back reason is a note and is not a field |
| The D49 RACI rule against D39 | Extended | D49 | D39 was written for the IAS file. It now applies to the law firm, MAIIC, the hub templates, the test files and the sibling. The hackathon files stay frozen (D50) |
| D39, one accountable role per step | Extended | D59 | A step is listed under its acting role and under its accountable role |
| Backlog access by the roles of a group | Superseded | D74 | A backlog lists the groups that may see and the groups that may move its issues. The route `agency_group_roles` no longer counts for backlog access |

## 7. The code forms

The form is `record.<record code>.<action>`, with a field part on add, edit and view. The record code is a readable code such as `tender`, unique in the agency, and not the counter `RC-n` (D58). It has no dot (see [Record codes in an agency file](agency-import-record-codes.md)). The field part is the field's own readable code, for example `closing_date` (D37), so a permission reads `record.tender.edit.closing_date`.

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
| Record code | A readable code such as `tender`, unique in the agency (D58). A rename follows through the roles that carry it, as a field code does (D38, D58). New records are made with it, and old `RC-n` codes stay until a file is converted |
| Record key | A UUID for a new record, never the `RC-n` counter and never a hash (D61). An old record keeps its stored `RC-n` key. A home entry that names a record by code (`target`, `page_of`) is saved as the key, so a rename never breaks it (D62) |
| First setting of a field code | The import proposes it from the prompt (Closing date becomes `closing_date`, a clash gets a number). The agency file may name a code, and then it is used. The designer may rename any proposal before the publish (D76, D38). A file with no codes written still imports |
| Name on screen | The role page and the Role card name a field permission with the long wording, a full sentence such as "Add the closing date of a tender", and "Add every field of a tender" for a star. The code sits beside it in its own field, not inside the name (D66) |
| The generated workflow and its step | `record.tender.add`, and the step `record.tender.add.1`, named with the `record.` prefix. They are names of a workflow and a step, not permission codes. Until ISS-153 names them, a workflow of a new record is built on its UUID key (D61, D75) |
| The step's holder | A role holds the generated add step when it holds `add.*`, or an `add.<field>` for each required field of the record. A record with no required field is held by a role with `add.*` or at least one `add.<field>` (D75, the last part flagged to the owner) |
| Where the hub reads a role's codes | From the published version, not the draft. The roles of an agency never published grant nothing (D77) |
| Characters in a field code | Not said by any decision |

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
     code: readable, unique, renameable (tender)                         (D58)
     key: UUID for a new record, RC-n kept for an old one                (D61)
     Field: key (hidden, stable), code (readable, closing_date), prompt  (D37, D38)
            the code is proposed by the import, may be named in the file,
            and may be renamed before the publish                        (D76)
        ---- derives ----> record.tender.add.<field code> / add.*
                           record.tender.edit.<field code> / edit.*
                           record.tender.view.<field code> / view.*
                           record.tender.delete
        ---- generates ---> workflow record.tender.add, step record.tender.add.1
                            (record.tender.edit, .delete the same way)   (D75)
   Role.permissions: catalogue codes + record codes, the star stored as written
   Step: one accountable role, a field on the step                       (D39, D49)
   Seats with no group
   no tags, no groups   (D24, D35)

 PUBLISHED VERSION
   the list of generated permissions; the hub reads a role's codes here  (D8, D77)

 AFTER THE PUBLISH (set up by an administrator, D24, D35), in the hub's tables
   Tag (Instance tags): name; `all` is the system tag, made with the Instance (D23)
   Group: name, tags (D25, D28); a group may carry `all` with or without others (D48)
        created after the publish; the Instance's first group is made with the
        Instance and its owner is seated there as administrator          (D70)
        may be disabled and enabled by any group administrator;
        a disabled group is not offered, is read as no group, and keeps its
        seats, tags and rows                                              (D54, D63)
   Group tags (the tags a group carries); a tag is deleted only when no row
        and no group carries it                                           (D53)
   Seat: person + role + group (D34); the file's seat has no group until moved
        an agent is a member and holds seats like a person               (D56)
   Backlog: the groups that may see it and the groups that may move its issues;
        no roles, no seats                                                (D74)
   Person logs in and assumes one Group, each login, may switch (D32, D40)
        no hint of the last group                                         (D64)
        acts with: the roles seated in that group, and no others   (D33, D42)
                   the tags of that group                           (D33)
        the platform owner is no exception                          (D42, D72)
   API key: stands for its agent member; each key session starts with no group
        and assumes one of the member's groups, like a person            (D57)
   Permission tag.manage: creates, renames and deletes a tag          (D60, proposed code)

 ROW (tender), in the agency sibling
   fields saved under their keys                                    (D38)
   tags: a `tags` list on the row, taken from the assumed group when the row
         is added (D27); a further tag only by someone who holds add, by adding;
         never taken off                                                 (D27)

 CHECK, in order
   1. A group is assumed (by the login, or by the key session), is not disabled
      and has tags; if not, no rows at all (D32, D54, D57)
   2. The row shares a tag with the group, or the group has `all` (D28).
      Nothing else reaches a row: not adding it, not being named on it (D47)
   3. A role seated in the group carries the code for the action, read from the
      published version (D77), each action on its own (add and edit need no view,
      D43, D44):
        add      .add.<field> or .add.* for each field written (D31); a required
                 field the role cannot add refuses the add, naming it (D31);
                 the fields it cannot add stay empty
        edit     .edit.<field> or .edit.* for each field changed;
                 fields the person cannot edit are carried over unchanged (D43)
        view     .view.<field> or .view.* for each field shown (D22), on the row,
                 the lists, the step page, Earlier answers and the register of
                 declarations (D22, D67, D71)
        delete   .delete, whole row (D29)
   4. The same check holds for a designed form step (D69), for the designer's row
      routes (D72) and for the step a role holds (D75)
   The send-back and delete reason are notes on the step and are not checked by
   field codes (D68)

 SCAN before a publish, about record permissions (D51)
   a record no role may add to is flagged
   a required field that no role holds an add code for is flagged
   nothing about delete without view, groups or tags
```

### What changes, field by field

| Where | Field | Before | After |
|---|---|---|---|
| Record | `code` | `RC-n` counter code | Readable and unique, such as `tender`, renameable with the roles following (D58) |
| Record | `key` | The `RC-n` counter | A UUID for a new record. An old record keeps its `RC-n` (D61) |
| Record | `questions` and the rest | As section 1 | Same. The questions are the fields the codes name |
| Home entry | `target`, `page_of` | A record code | The record's key, so a rename never breaks it (D62) |
| Field (question) | `key` | None. Answers are saved under the prompt text | New. A stable hidden key; rows are saved under it (D38) |
| Field (question) | `code` | None | New. A readable code such as `closing_date`; a label on the key, renameable, and the roles follow in the same save (D37, D38). First set by the import's proposal or by the file (D76) |
| Role | `permissions` | Four codes per record | Field codes and stars per record, and `record.<code>.delete`. Read from the published version (D77) |
| Role | the line on its page | The code and the short name | The long wording as the name and the field code beside it (D66) |
| Publication | list of generated permissions | Four per record | Field codes and stars as written. No tags, groups or seats |
| Generated workflow and step | `code` | `tender.add`, step `tender.add.1` | `record.tender.add`, step `record.tender.add.1`; the id, role assignments and replaced-by links are kept (D75) |
| Generated step | holder | The role of the record | Every role that holds add for each required field of the record (D75) |
| Step | the accountable role | Role assignments with a label, 36 in the IAS file | One accountable role on the step; the 36 entries become 13 step fields (D39). The same in every repo, and objective labels go (D49). The role brief lists the step under the acting and the accountable role (D59) |
| Agency file seat | the person and the role | Person and role | Person and role, no group (D35). The old D34 group is dropped |
| Group | `tags` | None | A list of tags, set after the publish (D25), `all` included when given (D48) |
| Group | created in | The Instance, by the owner's call | After the publish, by an administrator (D35). A new Instance gets a first group with its owner as administrator (D70) |
| Group | `disabled` | None | A flag in a hub table (`agency_group_disabled`); a disabled group is not offered (D54, D63) |
| Seat | `group` | In the actor module a seat names a group already | Required for the person to use the role; absent until set up (D34, D35). It is the only source of a person's roles (D42) |
| Person | assumed group | None | Chosen at each login, may be switched (D32, D40), with no hint (D64). Kept by the hub in `agency_assumed_groups`, one row for each session key and Instance, dropped when the session ends |
| Agent (key) | assumed group | None | Chosen by the agent in each key session among its member's seats, like a person (D56, D57) |
| Row | `answers` | By prompt text | By field key (D38) |
| Row | `tags` | None | A `tags` list on the row in the agency sibling, set at add from the assumed group (D27) |
| Tag (Instance) | name, `system` | None | New, in the hub's tables. Created after the publish; `all` is built in (D23, D24). Creating, renaming and deleting needs the tag-management permission (D60) |
| Group tag | group, tag | None | New, in the hub's table `agency_group_tags`. Giving and taking off stays with a group administrator (D48) |
| Backlog | access | Roles of a group (`agency_group_roles`) | Groups that may see and groups that may move; no roles and no seats (D74) |
| Task (taskmanager) | `tags` | None | Planned. The assumed group decides which tasks a person sees; designed on ISS-207 before any build (D73) |

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
| 18 | An AI agent for the tender scouts holds a seat in `emea`. Its key session starts with no group, it assumes `emea`, and it then acts with the roles and tags of `emea` | D57 |
| 19 | Anna adds a row as `emea`, then assumes another group that shares no tag with it. She does not see the row, although she added it | D47 |
| 20 | The group `emea` is disabled. Anna's next request acts as no group and reaches no rows. The group is not offered at her next login. Its seats, tags and rows are untouched, and enabling the group brings them back | D54, D63 |
| 21 | The Project Manager opens a step with Earlier answers. She sees only the earlier answers of the fields she holds view for. A send-back reason on the step is a note, so whoever holds the step reads it whatever she may view | D67, D68 |
| 22 | The role page shows the Tender Scout's code as "Add the closing date of a tender", with `record.tender.add.closing_date` beside it | D66 |
| 23 | The generated step `record.tender.add.1` is held by the Tender Scout, who holds add for the five required fields. A role with only `add.country` does not hold it, because it lacks the required fields | D75 |

## 10. Which issue each decision changes

The states are the board's on 2026-11-24 (done, review, doing, in-coming). The range is ISS-148 to ISS-208. ISS-184 and ISS-185 are not on the board listing of that day and are not listed. This page files nothing itself. An issue that is done and is changed by a later decision needs a follow-up issue, not an edit.

| Issue | Now | Decisions | The change |
|---|---|---|---|
| ISS-148 | Done | D20, D21, D36, D66 | The Role card line lists field codes and stars. The long wording is the name and the code sits beside it (ISS-205) |
| ISS-149 | Done | all | This page. D19 to D77 added |
| ISS-150 | Done | D20, D21, D29, D30, D36, D37, D58 | Built with four plain codes and replaced by ISS-182, which emits field codes, the stars and `delete` and names each field by its readable code. The record code in them is the readable one (ISS-195) |
| ISS-151 | Done | D20, D30, D38 | Built for the plain codes. ISS-183 now accepts field codes and stars and refuses a field the record lacks. A rename moves the codes on the roles in the same save |
| ISS-152 | Review | D24, D30, D77 | The publication lists the field codes and the stars as written, and no tag, group or seat. The hub reads a role's codes from the published version |
| ISS-153 | In-coming | D16 superseded, D36, D61, D75 | The generated workflow is `record.tender.add` and its step `record.tender.add.1`. An existing generated workflow keeps its id, role assignments and replaced-by links through the rename. A workflow of a new record, built on its UUID key until now, takes the readable name. The reading for a record with no required field is flagged for the owner |
| ISS-154 | Review | D18 superseded, D44, D51 | The scan flags a record no role may add to and a required field no role holds an add code for. It checks nothing about delete without view, groups or tags |
| ISS-155 | Review | D35, D36 | No seat refusal for a missing group. The record's role fields go and a file that has them is refused. The generated step stores no role |
| ISS-156 | Doing | D20, D24, D30, D35, D36, D76, D77 | The import reads field codes and stars, refuses a field the record lacks, and accepts seats with no group. It proposes a code for a field that has none, shows the proposals, and lets the designer rename them before the publish. A file carrying tags is not expected |
| ISS-157 | In-coming | D12 superseded in part, D33, D42, D69, D75 | A generated step is held by a role seated in the assumed group that holds add for every required field of the record, and by no other source. A designed form step also needs the add or edit field codes |
| ISS-158 | In-coming | D21, D22, D26 to D29, D31 to D33, D38, D40, D42 to D44, D47, D54, D71, D72, D77 | The row check by assumed group, tag, field code, delete by tag, add refused for a required field, no group (or a disabled group) means no rows, tags stamped at add. Rows read and written by field key. No owner shortcut, and the designer's row routes use the same check. Reach by tag only, so the `rowNames` and `AddedBy` paths go (ISS-189 holds the one reach rule). The role codes are read from the published version. The register of declarations moves onto it. The largest change, and likely to be split (ISS-189 to ISS-193) |
| ISS-159 | In-coming | D17 superseded, D22, D28, D67 | A subject step shows only the fields the person may view, of a row the person reaches. Earlier answers follow the same view rule |
| ISS-160 | Done | D20, D21, D30, D36, D43, D44 | Built with the plain four codes. A grid of fields by add, edit and view, with the star, plus delete, is a follow-up |
| ISS-161 | In-coming | D20, D30, D35, D36, D39, D49, D51, D76 | Roles carry field codes (the star where the role did the whole action). The 36 role assignments become 13 step fields. The file need not write every field code out |
| ISS-162 | Done | D20, D36 | The conversion issues per repo (ISS-166 to ISS-171) convert to field codes, the star for what a role did whole |
| ISS-163 | In-coming | D32, D33, D35, D39, D42, D52, D70 | The QA import gives the Instance working groups with seats for the people, because only seats in the assumed group give roles. The groups carry the tag of the cleanup (D52). A new Instance already has its first group (D70) |
| ISS-164 | Done | none | Not related: the console chat tool list |
| ISS-165 | Done | none in scope | The record editor drops the four role pickers |
| ISS-166 | In-coming | D36, D49 | The law firm file gives its roles the record permissions, and takes the one accountable role per step, labels on objectives dropped |
| ISS-167 | In-coming | D36, D49 | The municipality file, the same |
| ISS-168 | In-coming | D36, D49 | The two Malawi MAIIC files, the same |
| ISS-169 | In-coming | D36, D49 | The farmers and boda boda demo templates of the hub, the same |
| ISS-170 | In-coming | D36, D49 | The hub-demo test files in the sibling, the same |
| ISS-171 | In-coming | D36, D49 | The farmers test agency of the wakala-api repo, the same |
| ISS-172 | Done | none | Not related: the users and groups chat pages |
| ISS-173 | Done | none | Not related: the README count of IAS role assignments (D39 later changes the count itself) |
| ISS-174 | Doing | all | This amendment |
| ISS-175 | In-coming | D27, D32, D35, D42, D52 | Every existing row gets one tag (working name `test-data`), real groups carry it, and the existing people are seated in them. Not an `all` group. The tag name and the group layout are confirmed in the first todo |
| ISS-176 | Done | D23, D24, D25, D28, D35, D48, D53, D60 | Tag management inside user and group management. Its three questions are answered by D48, D53 and D60, and the first (where the tag list lives) is in Open after D77 |
| ISS-177 | Review | D26, D32, D33, D40, D45, D46, D64, D65 | The login screen where a person picks the group to assume. No hint of the last group. The no-group message names nobody |
| ISS-178 | Done | D37, D38 | The sibling: a stable hidden key and a readable code on each field, rows saved by key |
| ISS-179 | Done | D39, D49, D59 | The sibling: one accountable role per step, and the role brief reads it. D59 follows in ISS-196 |
| ISS-180 | Done | D40, D42, D57 | The assumed group per login session, kept by the hub keyed by session and Instance. The 403 for keys on the assume-group routes goes with ISS-194 |
| ISS-181 | Done | D41, D56, D57 | A group set on an agency key. Built, then replaced by ISS-194 |
| ISS-182 | Done | D36, D37 | The sibling: each record gives field level permissions, the three stars and `delete` |
| ISS-183 | Review | D20, D30, D36 | The sibling: a role's list takes field codes and stars and refuses a field the record lacks |
| ISS-186 | Done | D23, D27, D47 | The sibling: a record row carries tags, the list filters by tag, and a tag is added to a row and never taken off |
| ISS-187 | Done | D23, D24, D25, D48, D53 | The hub: the tags of an Instance and of a group, `all` made with the Instance, a tag deleted only when nothing carries it |
| ISS-188 | Done | D33, D42, D74 | One resolver reads a caller's roles only from the seats of the assumed group. Backlog access stops counting by roles (D74, ISS-208) |
| ISS-189 | Doing | D28, D29, D32, D47, D54 | The one reach rule: the row and the assumed group share a tag, `all` reaches every row, no group or no tag reaches none, and no other path reaches a row |
| ISS-190 | Doing | D27, D32 | A new row takes the tags of the assumed group when it is added |
| ISS-191 | In-coming | D22, D67, D71 | The record list and the row list show only the fields the person holds view for, even on their own rows |
| ISS-192 | In-coming | D31, D44 | An add fills only the fields the role may add, leaves the rest empty, and refuses a required field the role cannot add, naming it |
| ISS-193 | In-coming | D43 | An edit changes only the fields the role may edit and carries every other field over unchanged |
| ISS-194 | Done | D56, D57 | An agent working through a key assumes a group like a person, through the assume-group routes, and the fixed group on a key goes |
| ISS-195 | Done | D58, D61 | The sibling: a record gets a readable code instead of `RC-n` |
| ISS-196 | Done | D59 | The sibling: the role brief lists a step under its acting role and under its accountable role |
| ISS-197 | Done | D40, D45, D46, D64 | The console group screen at login and the group control in the header |
| ISS-198 | Done | D40, D45, D46, D64 | The same in the phone app |
| ISS-199 | In-coming | none | Not related: the Ward boundary card on the console group page |
| ISS-200 | Review | D36, D38, D39, D49 | The hub moves to sibling v0.3.1 and adapts what breaks: answers by key and one accountable role per step |
| ISS-201 | Done | D61, D62 | The sibling: a new record's hidden key is a UUID, and a home entry names a record by its key |
| ISS-202 | Review | D60 | The hub: a tag-management permission (proposed code `tag.manage`) guards creating, renaming and deleting a tag. Giving a tag to a group keeps the administrator guard (D48) |
| ISS-203 | Review | D70 | The hub: a new Instance gets a first group and its owner is seated there as administrator |
| ISS-204 | Done | D54, D63 | The hub: a group can be disabled and enabled by a group administrator |
| ISS-205 | Done | D66 | The sibling: a field permission is named with the long wording and the field code beside it |
| ISS-206 | Done | D46, D65 | The console and the app: the no-group message names nobody. The console profile link waits for a profile page |
| ISS-207 | Review | D73 | Design: tags on taskmanager tasks, backlogs and smart backlogs, and who sees which task |
| ISS-208 | Doing | D74 | The hub: backlog access levels are their own check for the assumed group, with no roles. The five skipped tests are rebuilt |

D50 (the frozen hackathon files), D55 (replaced the same day), D68 (the send-back reason) and D69 for the designed steps (beyond ISS-157) name no issue in the notes. They are carried by the issues above or are still to be filed.

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
| Who gives an agent its seats | D57 says the agent assumes a group among its own seats. Which permission gives the seats to an agency key's member is not said |

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
