# Record permissions: every row path in the hub and the siblings

Research for ISS-174. It lists where the hub and the sibling repos it imports read, write, list, count, export, search or return record rows or a field of a row, where roles are read, and what the field-level and tag decisions (D20 to D35 of the owner's answers, see [Record permissions](record-permissions.md)) would change in each. Nothing was changed in code. Read on 2026-11-24 from `dev` of the hub and the working trees of the siblings.

| Built | Planned |
|---|---|
| Nothing. This page is the inventory | The issues of section 8 |

## 1. The decisions this page works from

| # | In short |
|---|---|
| D20 | `edit.*` replaces `edit`. Codes are `record.<code>.edit.*` (every field) and `record.<code>.edit.<field>` |
| D21 | The field level applies to add, edit and view |
| D22 | A person sees only the fields they hold view for, even on their own rows |
| D23 | The row dimension is tags. A system tag `all` reaches every row and is still limited by the field codes |
| D24 | Apart from `all`, tags are managed after publish. The publication carries only field codes |
| D25 | Users are put in groups. A group is given tags and roles |
| D26, D27 | A user logs in and assumes a group. A row takes the tags of the assumed group when it is added. After that tags change only when someone holding the add code of that record adds a further tag. A row from before tags is reachable only through `all` |
| D28 | A row is reached when the row and the assumed group share at least one tag. `all` reaches every row |
| D29 | Delete stays one code, `record.<code>.delete`, for rows the assumed group reaches |
| D30 | The star is stored as written and means every field the record has at the time of the check. The scan checks that a named field exists |
| D31 | A person who holds add for some fields adds a row with those fields. The rest stay empty. If a field is required and the role lacks add for it, the add is refused naming the field |
| D32 | No assumed group, or a group with no tags, reaches no rows. A person in several groups picks one at login and may switch |
| D33 | A person who assumes a group acts with only that group's roles. The group's tags decide the rows |
| D34, D35 | A seat names the person, the role and the group. Groups and tags are created after publish. The file carries seats with no group |

## 2. The hub row paths

Hub files are under `code/wakala-api/internal/api/http/`. The check names are the functions in `record_rows.go`: `callerMayAddRows` (the record's `RoleID`), `callerMaySeeEveryRow` (adding role, or `ViewerRoleID`), `callerMayDoRowAction` (`RoleOfRowAction`), all three through `callerIsOwnerOrHolds`, which lets the platform owner pass and otherwise looks for the role among `heldRoleKeys`. `requireHeld` is the separate check of a workflow step's role.

Two things hold for every row below. First, the reads and writes of rows all go through the sibling's `ListRecordRows`, `CreateRecordRow`, `RetireRecordRow` and `ReturnRecordRow`, and none of them knows a caller, a tag or a field permission, so the hub must filter after the read. Second, the catalogue gate does not help: `instance.live_record.list`, `instance.live_record_row.list` and `instance.live_record_row.add` are in `seated_may.go`, so every seated agent passes the action gate, and the row check is the only gate.

### 2.1 Direct row routes and tools (`record_rows.go`, `record_mcp.go`)

| Where | What it does | Kind | Check today | What field-level and tag rules change |
|---|---|---|---|---|
| `liveRecordsOf` (`GET /instances/{id}/live-records`, tool `agency_list_live_records`) | Lists every record with its questions and `can_add_rows` | add (flag), view (questions) | `callerMayAddRows` per record | `can_add_rows` becomes the list of fields the assumed group's roles may add. The `questions` list is cut to the fields they may view or add, or the form leaks field names. Add needs no tag reach (a new row takes the group's tags) but needs a group with tags (D32) |
| `liveRowsOf` (`GET .../live-records/{code}/rows`, tool `agency_list_live_record_rows`) | Reads the rows of every publication's draft, drops replaced and retired ones (or keeps only those with `history`), keeps a row when `callerMaySeeEveryRow` or `rowNames` (the person is picked in an answer), then `answer_actor_id` and `where` | view | `callerMaySeeEveryRow`, else `rowNames` | Keep a row only when its tags meet the assumed group's tags (D28) and the role holds a view code. Strip `answers`, `place_refs` and the `deleted_reason` and `returned_reason` text to the viewable fields (D22). `where` and `answer_actor_id` read answers, so a condition on a field the person cannot view must be refused, or the result lets them test hidden values. `history` reads old versions of a row and needs the same filter. Decide whether the `rowNames` fallback survives (question 7) |
| `addLiveRow` (`POST .../rows`, tool `agency_add_live_record_row`) | Owner-only direct write; anyone else gets `directRowClosed` naming the generated workflow. `Replaces` makes it an edit | add, edit | `callerMayAddRows`, then `callerIsPlatformOwner` | The owner needs the codes too (D11) and a group with tags (D32). An edit through `Replaces` is today not checked against the old row at all in the hub; it needs edit codes per field and tag reach to the replaced row |
| `writeRow` | Stores the row: `RoleID: record.RoleID`, `AddedBy` the caller, answers as sent | add, edit | none of its own | `RoleID` goes with the record's role field (ISS-155). Stamp the assumed group's tags on a new row (D27). Refuse an answer to a field with no add (or edit) code, or drop it; refuse the add when a required field lacks add, naming the field (D31). On an edit, the replacing row is a full copy, so the fields the editor may not see or edit must be carried from the old row, not blanked |
| `recordKeptByStep`, `directRowClosed` | Decide whether a record is filled only through its step | none | none | None |
| `namesAStranger`, `rowNames`, `picksAPerson` | Checks that a person-picked answer names a member | add, view | none | `rowNames` is the own-row path of a view; see question 7 |

### 2.2 Row steps (`step_row_submit.go`)

| Where | What it does | Kind | Check today | Change |
|---|---|---|---|---|
| `submitRowStep` (`POST /instances/{id}/steps/{stepID}/answers` for a step with `RowRecord`; tool `agency_submit_step_answers`) | Runs the generated Add, Edit or Delete step | add, edit, delete by `step.RowAction` | `callerMayDoRowAction` | One decision function that takes the action, the record, the row and the fields answered. Add: fields vs add codes. Edit: fields vs edit codes and tag reach to the current row. Delete: tag reach only (D29) |
| `applyRowAction` | Adds, edits or retires | add, edit, delete | none after `submitRowStep` | Delete calls `RetireRecordRow` on `req.RowID`; it must check the row's tags first |
| `requireCurrentRow` | Checks the row is a current row of the record | edit, delete | none for the caller | Only checks the row exists. The tag reach check goes here or beside it, so a row id guessed from another group is refused as "not a current row" without saying more |
| `writeRowFromAnswers` | Resolves answers and calls `writeRow` | add, edit | none | As `writeRow` |
| `reasonOfDelete` | The delete reason is the one answer of a delete step | delete | none | The reason is stored on the row as `deleted_reason`; it is an answer to a system question, not a record field. Decide who sees it (question 9) |

### 2.3 Designed form steps and runs (`step_runs.go`, `step_records.go`, `step_routing.go`)

| Where | What it does | Kind | Check today | Change |
|---|---|---|---|---|
| `submitStepAnswers`, the branch with no `RowRecord` | A designed form step stores its answers as a row of the step's derived record: `CreateRecordRow` with `RoleID: chain[index].record.RoleID` | add | the step's role is held (`heldAgencyRoles`), not a record code | Open point of the design page: does the step holder also need the add code? The row must take the group's tags (D27), or later steps cannot reach it. Field codes: a designed step answers every question, so decide whether field add applies (question 10) |
| `runsOf` | Reads all rows of every step's record, for every publication, and builds the runs | view | none | It reads every row regardless of caller to find which step is waiting. Return only runs the assumed group reaches, or the open-steps list shows other groups' runs |
| `callerAvailableSteps` and the `Earlier` list (`earlierStepsOf` in `earlier_steps.go`) | The next step's holder sees the earlier steps' answers (`run.answers`), and `RoleName` from `record.RoleID` | view | the step's role only | This shows field values to a role that may not hold view for them. Decide if a workflow hand-over is exempt (question 8). `record.RoleID` goes with ISS-155; the role name comes from the step |
| `sentBackNoteOf` (`send_back_step.go`) | Shows the sender's reason and the answers already given on a reopened step | view | none | Same as `Earlier` |
| `step_records.go` (`ensureStepRecords`, `recordMatchesStep`) | Keeps a derived record in step with a designed step; copies `RoleID` | none | none | `RoleID` goes with ISS-155 |

### 2.4 Send back, sent steps, subject runs

| Where | What it does | Kind | Check today | Change |
|---|---|---|---|---|
| `sendBackStep`, `returnedStepOf`, `currentRowsOfRun` (`send_back_step.go`) | `ReturnRecordRow` on the previous step's rows of one run | edit (changes a row's state) | the step's role is held | Needs tag reach to the rows of the run. Which code it needs is open (question 9) |
| `callerSentSteps`, `currentRowsAddedBy`, `currentRowsOfRecord`, `answersOf` (`caller_sent_steps.go`) | "My sent steps": the rows the caller added, with answers | view | `AddedBy == caller` | D22 says even own rows show only viewable fields. A caller who switches group loses sight of rows sent under the old one unless own rows are exempt (question 7) |
| `sentRowSteps`, `everyRowOfRecord`, `sentRowItem` (`caller_sent_row_steps.go`) | The same for Add, Edit and Delete steps; delete shows `deleted_reason` | view | `AddedBy` or `DeletedBy == caller` | As above |
| `subjectRowOf`, `carry`, `withSubjects` (`subject_run.go`) | Reads rows by `order_id` only to carry the `SubjectRowID` into the open step | view (id only) | none | Returns an id, not answers. The subject row must be reached by tag for the step to open it |
| `subjectRowForStart` | Starting a subject workflow names a row | edit-like | `requireCurrentRow` | Tag reach to the named row, and view of the subject record (D17) |
| `declarationsFor` (`declaration_register.go`) | The register of declarations of interest, rows of one record, all or only the caller's | view | catalogue permission `declaration.read`, else own row | A record permission path by another name. Decide if it moves to the record codes (question 11) |

### 2.5 Internal reads that return no rows to a caller

These read rows for a check or a count and send nothing but a yes or no. They stay system reads, but each must be named in its issue so nobody filters them by the caller by mistake.

| Where | Use |
|---|---|
| `form_send_row_owner.go`: `liveRowsOfTheAgency`, `rowOwnedBy`, `sendsNamingRows` | A form send that names a row must name a row that names the sender; `ListSubmissionsOfPerson` follows the row's lineage |
| `record_row_lineage.go`: `everyLiveRecordRow`, `rowLineage`, `partyRowsOfAgency` (`RowExists`, `RowChain`) | The taskmanager checks that a project party's row exists and follows its corrections |
| `record_rows.go`: `rowRunIsReal`, `groupOrderExists`, `workflowHasRun` | A row's `order_id` must name a real run |
| `mcp_audit_records.go`, `addLiveRecordRowTool` | The audit text of a direct add (`rowAction`) and the row id. Add the tags and fields written |

### 2.6 Checked and found without a row read

| Place | Result |
|---|---|
| Counts and exports | No hub path counts or exports the agency's rows. `forms_catalog_record_count` and the forms and catalog "records" are the catalog module's own, not agency rows. The Home (`home_mcp.go`) names a record by code and reads no row |
| Search | The `where` of `liveRowsOf` is the only search over answers |
| Designer routes `agency_list_record_rows`, `agency_create_record_row`, `agency_retire_record_row`, `agency_return_record_row` (the sibling's routes mounted in `agency_routes.go`, tools guarded in `mcp_agency_permissions.go`) | They read and write any row of a draft with no row check. No catalogue permission lists the actions `agency.record_row.*` (searched `permissions_catalog.json`: no match), so an agent role never passes them; the owner does. They must stay owner-only and outside the tag rule, or be closed; question 13 |
| `record_grants.go` | Grants on named records of other modules (`record:<module>/<object>/<id>`), not agency rows |

## 3. Where the caller's roles are read today

The one rule: a person holds a role when its id or code is in the set `heldRoleKeys` builds. It is built from three sources, and the same three are re-read in four other places.

| # | Source | Stored in | Read at |
|---|---|---|---|
| 1 | The member's linked agency role (`agency_role_id` on the member, set by `PUT /instances/{id}/members/{memberID}/agency-role`, `agency_role_link.go`) | hub registry, `internal/agencies/member.go` (`SetAgencyRole`, `AgencyRoleOf`) | `heldRoleKeys`, `agentRoleIDs`, `rolesHeldBy`, `group_role_access.go`, `module_mounts.go`, `ai_gateway.go`, `studio_agencies.go`, `service_grants.go` |
| 2 | Roles given to a group (`agency_group_roles`; tools `agency_give_group_role`, `agency_take_group_role`, `agency_list_group_roles`), reached through every group the person is in, closed groups only | hub registry, `internal/agencies/group_roles.go` (`RoleIDsThroughGroups`) | `heldRoleKeys`, `agentRoleIDs`, `rolesHeldBy` |
| 3 | Actor seats (`ActorRoleAssignment`: actor, group, role kind, active). A role kind carries `definition_role_id`, kept in step with the roles of each publication by `syncDefinitionRoleKinds` (`definition_role_kinds.go`) | the actor sibling | `heldRoleKeys` (`ListRoleAssignmentsForActor`), `staff.go` (`holdsStaffKind`), `step_approval_limit.go`, `author_roles.go`, `agencies/rooms.go`, `agencies/inspector_forms.go` |

Resolvers that copy the three sources, so each needs the assumed group:

| Function | File | Used for |
|---|---|---|
| `heldRoleKeys`, `heldAgencyRoles` | `caller_roles.go` | the row checks, open steps, step answers, send back, payment holders, `my-roles` |
| `agentRoleIDs`, `unionPermissions`, `agentPermissioned` | `agent_permissions.go` | every catalogue permission gate of an agent |
| `callerPermissionCodes`, `heldRolesAllow`, `residentPermissioned` | `group_role_access.go` | permission gates of residents and some agent paths |
| `rolesHeldBy`, `declarationHolders` | `declaration_register.go` | who is expected to declare |
| `stepRoleBoard.requireHeld` | `step_role_board.go` | starting and beginning a taskmanager workflow step |

Two points about seat source 3. A seat already names a group: `GrantRole` requires a live group and a role kind, and refuses the same person, group and kind twice. So the actor sibling already holds "person, role, group", and the hub today ignores the `GroupID`. And what the Instance import writes is not a person seat (section 5).

### Where an assumed group enters

| Step | Where | Today |
|---|---|---|
| Login | `signIn` in `auth_routes.go` (operator password) and the member sign-in by link (`member_signin.go`), also the GoTrue-style project tokens (`callers.projectUser`) | The session is `HMACManager.Mint(memberID)`: a signed token holding member, issue and expiry. It names a person, not an agency and not a group |
| Which agency | The path of every route (`/instances/{instanceID}/...`) and the tool argument `instance_id`. `me_agencies.go` lists the agencies a person joined | One login spans every agency, so an assumed group is per person per Instance, and cannot be a claim inside the session |
| Per request | `callers.require` puts the member id in the context (`asCaller`); `partitionOf(ctx)` holds the Instance. The MCP session binding (`mcp_session_binding.go`) keeps the owner of an `Mcp-Session-Id` and a memo | The assumed group would be read at this point (a new context value beside the partition) and cached in the MCP session memo |
| API keys and agents | `apikeys.Verify` returns an `AccountID` with no login | They have no screen to pick a group. See question 2 |

## 4. App and console readers of rows

| Reader | File | Tool or route | What changes |
|---|---|---|---|
| App, record list and form | `app/src/app/menu/declaredRecord.ts`, `liveRecordRows.ts`, `RecordRowForm.tsx` | `agency_list_live_records`, `agency_list_live_record_rows`, `agency_add_live_record_row` | Read `can_add_rows` as a list of fields, show only the fields returned, and send only the fields the person may add |
| App, Home tables | `app/src/app/home/HomeRecordTable.tsx`, `HomeRecordRows.tsx`, `homeFacts.ts`, `agencyHome_contract_adapters.tsx` | the same list tools; `agency_get_my_roles` | A table with fewer fields, and an empty table for a person with no assumed group |
| App, pickers | `app/src/app/menu/referenceChoices.ts` | `agency_list_live_record_rows` | Choices come from a title field; a person who cannot view that field gets no choices. Decide whether a picker is exempt |
| App, payments | `app/src/features/market/payments/api.ts` | list and add tools | Add with the fields the role may add |
| App, steps | `app/src/features/steps/api.ts` | `agency_list_my_open_steps`, `agency_list_my_sent_steps`, `POST .../steps/{id}/answers` | The `earlier` answers and sent answers arrive with fewer fields. A step refusal for a missing field needs words |
| App, council | `app/src/app/menu/sections/council/declarationsData.ts` | `agency_list_declarations` | As the register decision |
| App, login | `app/src/app/...` sign-in and `shared/wakala/openAgency.ts` (`openAgencyId`) | `/me/agencies` | A group screen after the agency is picked (ISS-177), and the assumed group sent with each call |
| Console, records page | `console/src/data/pages/records.ts` (`listRecords`, `listRows`, `addRow`) | the three tools | Same as the app list and form |
| Console, role page | `console/src/data/pages/roles.ts`, `roleChange.ts`, `pages/views/RolesView.tsx` | role update | Ticks per record and per field, with the star (ISS-160 reshaped) |
| Console, my roles | `console/src/wakala/rest.ts` | `GET /instances/{id}/my-roles` | Returns the codes of the assumed group's roles only |
| Console, tag management | none | none | A new page (ISS-176) |
| Console, chat pages | `console/src/data/chatPages/workflows.ts` | `agency_list_record_rows` | Owner tool, unchanged |

## 5. Where an Instance import writes seats

It does not write person seats. `importRoleAssignment` in `instance_import.go` is `{work_item_id, role_id, label}`: the RACI label of a role on a step, written with `CreateRoleAssignment` into the draft (`role_assignments` in the file, 36 in the largest file). That is a different thing from the actor sibling's `ActorRoleAssignment` (a person in a role of a group). Person seats are made after the import, one at a time, through `POST /instances/{id}/actor/role-assignments` (the actor routes mounted by `actor_routes.go`), as `agency/import-run.md` of the largest file records. The import also writes no group, no tag and no group role.

| What the import does | Where | D34 and D35 effect |
|---|---|---|
| Writes RACI labels on steps | `instance_import.go`, the `RoleAssignments` loop | None. The 36 do not gain a group |
| Writes records and their role fields | `instance_import_steps.go` (`recordRoleRefs`), `instance_import.go` (`importRecord`) | ISS-155 and 156 already remove them |
| Writes roles with their permissions list | `instance_import.go` | Field codes are accepted and checked by the sibling |
| Syncs role kinds on publish | `definition_role_kinds.go` (`rolesPublished.PublishAgency`) | A role kind is created per role; seats of those kinds are made later |
| Writes person seats, groups, tags | nowhere | A new Instance has no group and so no row is reachable until an administrator (or the cleanup and QA issues) creates a group, gives it roles and tags, and seats people |

So the first working group of a demo or QA Instance has to be made by a script or a call, not by the file (question 1).

## 6. The sibling repos

Siblings are public repos the hub takes by tag. The hub's `go.mod` holds `mwanachama-backend-agency v0.1.6`, `-actor v0.1.0`, `-auth v0.1.0`, `-shared v0.3.1`, `-taskmanager v0.2.0`. The agency working tree is 13 commits past v0.1.6 (the derive function and the role permissions check of the record permission work) and is not yet tagged. A sibling issue pushes and tags only with the owner's yes, and a hub issue then bumps `go.mod`.

### 6.1 `mwanachama-backend-agency`

| Question | Answer | Field level and tags need |
|---|---|---|
| Where rows are stored | Role `record_row` of `agency.blueprint.json` (table `record_rows`): `record_id`, `record_code`, `role_id`, `added_by`, `answers` (json by prompt), `place_refs`, `order_id`, `subject_row_id`, `replaces`, retired and returned fields, `send_key` | A new `tags` field (json list of strings) on the row, and an index so the list can filter by tag |
| Where rows are listed | `ListRecordRows(draftID, RecordRowFilter{RecordID, RecordCode, OrderID, SubjectRowID, IncludeRetired, IncludeReturned})` in `record_impl.go`, operation `list_record_rows` | A `Tag` filter (rows that carry any of a list of tags), so the hub does not read every row of every publication to filter in memory |
| Where rows are written | `CreateRecordRow` (needs `row.RoleID == record.RoleID`), `RetireRecordRow`, `ReturnRecordRow`, `settleReplacement` (an edit is a replacing row), `settleSubjectRow` | `RoleID` goes with ISS-155. `CreateRecordRow` takes the tags. A new call adds a tag to an existing row (D27 "adds a further tag"), with its own operation and action. `validateRowAnswers` and `RowAllowance` (the "waived" and "extra" details) is where a field a role may not add is left empty and a required field is checked; the allowance is now a per-record setting, not a per-role one |
| Where permission codes are derived | `RecordPermissionsOf` and `RecordPermissionCode` in `record_permissions.go`: four codes per record | Emit the field codes: `add.*`, `add.<field>`, `edit.*`, `edit.<field>`, `view.*`, `view.<field>`, and `delete` (D20 to D22, D29) |
| Where a role's codes are checked | `role_record_permissions.go` (`checkRoleRecordPermissions`, `validateDocumentRolePermissions`), on create, update, set, import and publish | Accept the field codes, check that a named field exists in the record (D30), keep the star as written |
| Where the scan runs | `record_issue_impl.go` (`checkRecords`), `issue_impl.go`, `generated_workflows.go` (`checkGeneratedFor`) | The three setups of D18 are re-worded for fields: a record with no role that may add, a role with add for a field and no view of it, a required field no adding role may add (D31) |
| Where generated workflows get their role | `generated_workflows.go` (`RoleOfRowAction`, `models/rowstep.go`) | ISS-155 removes it; the generated step is held by every role carrying its code, as before |
| Where groups, seats and sessions are | None. The agency sibling knows roles, not people | None |
| Publication | `models/agencydocument.go`, `publication_impl.go` | The list of generated permissions (ISS-152) names field codes. Tags are not in it (D24) |

### 6.2 `mwanachama-backend-actor`

| Question | Answer | Field level and tags need |
|---|---|---|
| Where groups are stored and managed | Role `group` in `actor.blueprint.json`; `CreateGroup`, `EditGroup`, `MoveGroup`, `ListGroups` in `group_impl.go`; tools `actor_create_group`, `actor_edit_group`, `actor_list_groups`. A `Group` has `Attributes map[string]any` | Group tags: either an attribute of the group, or a hub table beside `agency_group_roles`. The hub table needs no sibling change; see question 12 |
| Where people join groups | `ActorGroupAssignment` (`AssignGroup`, `UnassignGroup`, `ListGroupsForActor`, `ListActorsForGroup`) | A person's list of groups is already here, so the login group screen can list them. No change |
| Where seats are made | `GrantRole` in `role_assignment_impl.go` (actor, group, role kind), `RevokeRole`, `StepDownRole`; `ListRoleAssignmentsForActor` and `ListRoleAssignmentsForGroup` return `GroupID`; unique per person, group and kind | Already "person, role, group" (D34). A hub issue filters the seats by the assumed group. No change in the sibling |
| Where a person's roles are resolved for a request | Not here; the hub does it (section 3) | None |
| Login and session | None | None |
| Rows | None | None |
| Group roles | Not in the actor sibling; the hub keeps them in `agency_group_roles` | A hub table `agency_group_tags` of the same shape |

### 6.3 `mwanachama-backend-auth`

| Question | Answer | Field level and tags need |
|---|---|---|
| Where login and the session are made | The sibling holds the stores and operations: operator sign-in, device challenges, recovery, verification, and the session ledger (`SessionRepository`, `identity_sessions.go`, role `session` with subject, token, user agent, times). The hub's own `session.HMACManager` mints the token (`Mint(memberID)`) and keeps the ledger | A session is per subject and has no agency. An assumed group per Instance does not fit a session row without a schema change, and the sibling is shared by other products |
| Rows, groups, roles | None | None |

The hub should keep the assumed group in its own registry (section 8, H1) and not in the auth sibling. No sibling tag.

### 6.4 `mwanachama-backend-shared`

| Question | Answer | Field level and tags need |
|---|---|---|
| Where checks are mounted | `dispatch.Authorizer func(ctx, action string) error` and `dispatch.Caller` (`dispatch/dispatch.go`), used by every sibling's routes | An action string cannot carry a field or a tag, so the field and tag checks stay in the hub's own row code, not in dispatch. No change |
| Identity and storage | `identity` (the `partition/owner/object/id` form), `specstore` (the row store the siblings use) | The new `tags` field in the agency blueprint is a normal json field. No change |

### 6.5 `mwanachama-backend-taskmanager`

| Question | Answer | Field level and tags need |
|---|---|---|
| Where groups touch it | Backlog access by group: `give_backlog_access`, `take_backlog_access`, `set_backlog_owner_group` | Tasks are not record rows and have their own access rules. No change; question 14 asks the owner to confirm they are out of this work |
| Rows | `PartyRows` (the interface the hub fills with `partyRowsOfAgency`) asks only whether a row exists and its chain | None; the hub's answer stays a system read |

### 6.6 Other siblings checked

| Repo | Result |
|---|---|
| `mwanachama-backend-forms` | A submission may name `recordRowID`; the hub's `sendsNamingRows` wrapper checks the owner before it. No row is stored there |
| `mwanachama-backend-permissions` | Grants on named objects through `MayPerformIn` (`record_grants.go`). Not the record codes of an agency. No change |
| `mwanachama-backend-catalog`, `-comm`, `-engage`, `-market`, `-accounting` and the rest | Hold their own objects, none of them agency record rows. Not read further |

## 7. What the field-level rules mean for the data

| Point | Detail |
|---|---|
| The field key | A row's `answers` is keyed by the question's prompt, a free text with spaces, capitals and perhaps dots (`Why is it removed`). The record permission code form `record.<code>.edit.<field>` needs a key that has none of those problems and does not break when the prompt is reworded. See question 4 |
| An edit is a copy | An edit adds a new row that replaces the old, with all answers. With field-level edit, the new row must carry, from the old row, every field the editor may not edit. The hub does that merge (it can read the old row) and the sibling stores it |
| Required fields | `validateRowAnswers` refuses a missing required field for a whole form. D31 refuses before it is reached, naming the field, when the adding role lacks add for it |
| Old rows | Existing rows have no tags, so they are reached only through `all` (D27). The cleanup that tags them is ISS-175 |
| Several tags | A row may hold several tags (D27 "a further tag"); a group may hold several. The stored form is a list |

## 8. Proposed small issues

One repo each, one agent each. "Tag" means the sibling is tagged and pushed with the owner's yes and the hub's `go.mod` is bumped by a hub issue. The existing issues ISS-150 to ISS-165 and ISS-175 to ISS-177 are named where a new one reshapes them.

Order. A1 and A2 first (they decide the code form). Then the tag. The hub issues H1 and H2 need no sibling and can start at once. H3 to H8 take the bump. Console and app after the hub.

| # | Title | Repo | Depends on | Sibling tag and hub bump |
|---|---|---|---|---|
| A1 | Derive the field-level record codes `add.*`, `add.<field>`, `edit.*`, `edit.<field>`, `view.*`, `view.<field>`, `delete` (reshapes ISS-150) | mwanachama-backend-agency | Owner answer to question 4 | Yes, tag 1 |
| A2 | A role's permissions list takes the field codes and refuses a field no record has; the star stays as written (reshapes ISS-151 and ISS-152) | mwanachama-backend-agency | A1 | Yes, tag 1 |
| A3 | A row carries `tags`; `ListRecordRows` filters by tag; `CreateRecordRow` takes tags; a new call adds a tag to a row | mwanachama-backend-agency | Owner answer to question 12 | Yes, tag 1 |
| A4 | The scan refuses the three setups of D18 for fields, and a required field no role may add (reshapes ISS-154) | mwanachama-backend-agency | A1, A2 | Yes, tag 1 |
| A5 | The record's role fields go; a file that has them is refused; the generated step stores no role (ISS-155) | mwanachama-backend-agency | A1 to A4 | Yes, breaking tag 2 |
| H1 | The assumed group: a registry table per person and Instance, routes and tools to list my groups, assume and switch, carried in the request context and the MCP session memo; no group means no rows | hub (code/wakala-api) | Owner answers to questions 2 and 3 | No |
| H2 | Group tags: a registry table `agency_group_tags`, routes and tools to list, give and take a tag of a group, with `all` as the system tag (shape of `group_role_routes.go`) | hub (code/wakala-api) | Question 12 | No |
| H3 | One resolver for the roles a caller holds, reading only the assumed group's seats and group roles; the five copies of the three sources use it (section 3) | hub (code/wakala-api) | H1; question 3 | No |
| H4 | The row access decision: one function from caller, action, record, row and field to allowed or refused, replacing `callerMayDoRowAction`, `callerMayAddRows`, `callerMaySeeEveryRow` and `callerIsOwnerOrHolds` (ISS-158 reshaped) | hub (code/wakala-api) | H2, H3, A1 to A3 and the bump to tag 1 | Bump to tag 1 |
| H5 | `liveRowsOf` and `liveRecordsOf` use H4: tag reach, fields stripped, `where` and `answer_actor_id` limited to viewable fields | hub (code/wakala-api) | H4 | No |
| H6 | The writes use H4: tag stamp on add, field add and edit checks, the required-field refusal naming the field, the merge of the unchanged fields on an edit, delete reach (`addLiveRow`, `writeRow`, `submitRowStep`, the designed branch of `submitStepAnswers`) | hub (code/wakala-api) | H4 | No |
| H7 | The step and run readers use H4: `runsOf`, `Earlier`, sent steps, send back, subject runs | hub (code/wakala-api) | H4; questions 7 to 9 | No |
| H8 | The declaration register follows the record codes | hub (code/wakala-api) | H4; question 11 | No |
| H9 | The import refuses the old role fields (ISS-156) and reads the field codes; the hub drops `RoleID` and the removed fields (ISS-155 side) | hub (code/wakala-api) | A5 | Bump to tag 2, landing with ISS-157 and ISS-159 as the design page says |
| H10 | The demo and QA cleanup: a first group with roles and tags, seats for the people, tags on the existing rows (ISS-175) | hub (code/wakala-api) | H1, H2, H3 | No |
| C1 | The role page ticks field codes with the star (ISS-160 reshaped) | hub (code/console) | A1, A2 and the bump | No |
| C2 | The tag management page (ISS-176) | hub (code/console) | H2 | No |
| C3 | The console records page shows only returned fields and adds only allowed ones | hub (code/console) | H5, H6 | No |
| P1 | The login group screen and the assumed group sent with each call (ISS-177) | hub (code/app) | H1 | No |
| P2 | The app record list, form and Home table use the field lists | hub (code/app) | H5, H6 | No |
| P3 | The app steps and sent screens, pickers and payments follow the stripped answers | hub (code/app) | H7 | No |
| I1 | The IAS and other agency files: field codes on the roles (ISS-161, 166 to 171 reshaped) | one repo each, as ISS-162 lists them | A1, A2, A5 | No |

The hub issues that change `go.mod` (H4, H9) are the only ones that can fail to compile against an untagged sibling, so each lands after its tag. H5 to H8 can be split between agents once H4 is merged, each on disjoint files.

## 9. Questions for the owner

| # | Question |
|---|---|
| 1 | Do D34 and D35 mean the person seats of the actor sibling and not the 36 role assignments of the IAS file? Those 36 are RACI labels of a role on a step (`work_item_id`, `role_id`, `label`), not people in groups, so the file needs no change for them. The seats that already name a group are the actor seats, made after the import |
| 2 | Is the assumed group kept per person and Instance until the person switches, or per login session? And which group does an API key or an agent account assume, since it never logs in? |
| 3 | Under D33, which of the three role sources survive: the member's linked agency role, the roles given to a group, the actor seats? And does the platform owner need a group with tags too (D11, D32), which means the owner reaches no row until a group exists |
| 4 | What is a field in a code? Questions are keyed by their prompt, free text that can hold spaces and dots and be reworded. Do we use the prompt as written, a short key made from it, or a new stable key on each question, which means the sibling gains a field and old records get keys |
| 5 | May a person hold edit for a field without view for it (edit blind)? And an edit leaves the unchanged fields as they were, even those the editor cannot see; is that right |
| 6 | D26 says every record a user handles takes the group's tag if it lacks it; D27 says a row takes tags only when added and then only by an add of a further tag. Is D27 the rule, and can a tag ever be taken off a row |
| 7 | Does a person always reach the rows that name them in an answer, or the rows they added, whatever the tags and the assumed group? Today they do. If not, a person who switches group loses sight of what they sent |
| 8 | Do the earlier answers shown to the holder of the next step (the Earlier list and the sent-back note) follow the view codes, or is a hand-over from one step to the next exempt |
| 9 | Which code does send back need, and who sees the delete reason (`deleted_reason`), a system answer and not a field of the record |
| 10 | Does a designed form step's row write need the add code of its derived record and field add codes, or does holding the step suffice (the open point of the design page) |
| 11 | Does the register of declarations of interest move to the record codes, or stay on the `declaration.read` permission |
| 12 | Where are tags stored: group tags in a hub table (no sibling tag) and row tags in a new field of the agency sibling (a tag and a bump), which I recommend, or both in the hub |
| 13 | The sibling's designer routes (`agency_list_record_rows` and the others) read any row and no agent role passes them. Do they stay owner-only and outside the tag rule |
| 14 | Taskmanager tasks and their backlog access are out of this work; is that right |
| 15 | Who may give the tag `all` to a group, and may a group carry `all` together with other tags |
