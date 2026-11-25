# Task tags

Design for ISS-207 (TD-6179 to TD-6181). The decision it rests on is D73, quoted from the issue: taskmanager tasks carry tags too, and the assumed group decides which tasks a person sees. The rules it extends are in [Record permissions](record-permissions.md) (D23 to D28, D32, D53) and [Tag management](tag-management.md). D73 is not yet in the decision pages of this repo; this page takes its words from ISS-207. This is a design page: no code. The owner answered its questions on 2026-11-24 (section 4), and the build issues of section 7 are filed from it.

| Built | Planned |
|---|---|
| The reach tag stores of a group and the routes to manage them (ISS-187, [Tags](../../3.%20implementation/guides/tags.md)). The taskmanager's own label tags and its backlog access by group, both described in section 1 | Everything this page asks: reach tags on backlogs, the check on every read and write of a task through its backlog, and the sibling's part |

Sibling means `mwanachama-backend-taskmanager`, a public repo the hub takes by tag (`go.mod` holds v0.2.0). It was read, not changed. Hub files are under `code/wakala-api/internal/` and client files under `code/app/src/` and `code/console/src/`.

## 1. The inventory

### 1.1 Two things called a tag

| | Label tag (exists) | Reach tag (D23 to D28) |
|---|---|---|
| What it is | A free-form label on a task: `sprint 1`, `hub-steward-swe`, `design`, `permissions`, a repo name, and the four marks Ready, Waiting, Blocked and Sinbin | A name that decides which rows a group reaches; the system tag `all` reaches every row |
| Stored in | The sibling: tables `tag` (id, code, name, color, description; the name is unique) and `tagging` (task id, tag id, tagged at). Read back as `tags`, a list of names, on the task | The hub registry: `agency_tags` and `agency_group_tags`. No row, and no task, carries one yet: the row tag store (ISS-186) is not built, and `agencies.WithTagRowCounter` has no counter behind it |
| Set by | Whoever patches or updates the task. A patch replaces the whole list. The sibling also rewrites the marks by itself when a dependency finishes or opens (`waiting_tag.go`) | An administrator, on groups. A row takes the assumed group's tags when added (D27), planned |
| Meaning | None for a plain label. The four marks mean something to the Waiting, Blocked and Sinbin filters and to the Ready list | Decides reach (D28) |
| In this page | Label tag | Reach tag |

"Label tag" and "reach tag" are this page's words, chosen to keep the two apart. They are not the owner's words.

### 1.2 What the sibling stores

Tasks, todos, notes and the rest are rows of the Instance's tables for the mount. Backlogs and their access are not rows: they are stored settings.

| Object | Stored as | Fields that matter here | Tag today |
|---|---|---|---|
| Task (issue) | Table `task` | `backlog`, `step`, `assigned_to`, `held_by`, `linked_ref`, `workflow_run_id`, `parent_task_id`, `project_name`. No creator and no group | Label tags through `tagging`. The project name also counts as a tag in the smart backlog rules |
| Todo | Table `task_todo` | `parent_task_id` (the issue), `agent_id`, `workflow_run_id` | None |
| Note (a Log entry) | Table `task_note` | `task_id`, `author_id`, `kind` (person or worker), `automatic` | None |
| Backlog, smart backlog | Setting `backlogs`, a JSON list: steps for a backlog, rules for a smart one | Name, steps, rules | A smart backlog's rules may name a label tag |
| Backlog access | Settings `backlog_access` (backlog, group, level see, move or edit) and `backlog_owner_group` | Group ids | None |
| Project, project party | Tables `project`, `project_party`, with a membership join to tasks | Name, record rows of the parties | None |
| Case, case task, case vote | Tables `case`, `case_task`, `case_vote` | Requester, linked tasks, votes | None |
| Workflow run | Table `workflow_run`, joined to tasks and todos by `workflow_run_id` | Status, step | None |
| Repeating task, sourced task, generated task | Tables `repeating_task` and `repeating_task_period`, `sourced_task`, `generated_task` | Each makes tasks | None |
| Assignment, reference, dependency, blocker, caps, usage | Tables `assignment`, `task_reference`, `dependency`, `blocker`, `task_caps`, `task_usage` | Task ids | None |

### 1.3 Who writes

The sibling declares 158 operations in `taskmanager.operations.json`. The hub mounts them all, unchanged, at `/instances/{instanceID}/taskmanager` (`registerTaskManagerRoutes`) and as the `taskmanager_*` MCP tools (`registerTaskManagerMCPTools`), so a rule written in the sibling covers the routes and the tools alike.

| Writer | Where | What it writes | Who is the caller |
|---|---|---|---|
| Create a task | `create_task`, `create_task_in_project`, `create_with_todos`, `import_project` | A task, and its label tags from the request | The first three carry the person, who needs Can move on the target backlog. The import carries none |
| Change a task | `update_task`, `patch_task`, `batch`, `move_task_to_state`, `move_task_to_step`, `place_task`, `claim_task`, `claim_next`, `heartbeat`, `release_task`, `assign_task`, `unassign_task`, `assign_task_to_holder`, `unblock_task`, `unblock_dependents`, `delete_task` | Fields, the whole label tag list (patch, update), the place, the holder | The person, who needs Can move on the task's backlog |
| Tasks made by something else | `open_sourced_tasks`, `generate_tasks`, and the upkeep of a repeating task (`MakeRepeatingTaskDue`, called by the hub's `schedule_sweep.go`) | A task each | The first two carry the person. The repeating upkeep carries none |
| The sibling itself | `setTaskTags` from `waiting_tag.go` | Swaps the label marks Waiting and Ready when a dependency opens or finishes | No caller |
| Todos | `create_task_todo`, `add_todos`, `create_with_todos`, `update_task_todo_status`, `finish_task_todo`, `edit_task_todo`, `reorder_issue_todos`, `delete_task_todo`, `dispatch_task_todo`, `link_todo_to_run` | A todo of an issue | `create_task_todo`, `dispatch_task_todo` and `link_todo_to_run` carry none; the others carry the person |
| Notes | `add_task_note`; `finish_task_todo` adds one with it | A note; the author is the caller | The person; it reads the task first with `GetTaskFor`, so a task the person cannot see takes no note |
| Backlogs | `create_backlog`, `set_backlog_rules`, `rename_backlog`, `archive_backlog`, `unarchive_backlog`, `delete_backlog`, `replace_backlogs`, the four step routes and the step limit, `give_backlog_access`, `take_backlog_access`, `set_backlog_owner_group` | The `backlogs` and access settings | `create_backlog`, `set_backlog_rules` and `set_backlog_owner_group` carry no person; the others carry the person and need Can edit on the backlog |
| Cases, runs, projects, relationships, references, caps | `open_case`, `link_case_task`, `link_task_to_run`, `add_task_to_project`, `create_relationship`, `add_task_reference`, `set_task_caps`, and their delete and stop forms | Links between tasks and other objects | Mostly the person |
| The hub, with no person | `agencies/report_promises.go` (`CreateTask`, `UpdateTask` through `board` directly), `agencies/step_limit.go` (`UpdateTask`, `MoveTaskToState`), `agencies/schedule_sweep.go`, `api/http/form_case_landing.go` (`OpenCase`), `agencies/test_copy.go` (`ForRun`, a copy of the board for a test run), `agencies/code_backfill.go` (env-driven) | Tasks, states, cases | None; these calls skip the backlog check, because an empty caller sees everything |

### 1.4 Who reads

Of the 158 operations, 95 carry the caller as `requester_id` and 63 carry none.

| Reader | Where | How reach could be applied |
|---|---|---|
| Narrowed by backlog visibility through three helpers | `narrowToVisible` (a query): `list_tasks`, `list_tasks_for_run`, `pending_tasks`, `find_tasks`, `get_caps_nearest`, the change log, the todo counts and ready board, the smart backlog list and count. `GetTaskFor` (one task): `get_task`, `list_task_notes`, `add_task_note`, `task_brief`, `task_report`, `list_issue_todos`, `add_todos`, `list_task_assignments`, `list_task_references`, `file_overlaps`, `lint`. `readScope` (a list or one name): `list_overdue_tasks`, `get_task_by_name`, `list_tasks_in_project`, `list_case_tasks`, `traverse_relationships`, `task_dependencies` | Each helper is one place. A reach rule added to the three covers these readers |
| Narrowed by checking the backlog only | `requireSeenBacklog` and `requireVisibleBacklog` refuse a backlog the caller cannot see and do not look at a single task: `next_ready`, `next_ready_batch`, `board_snapshot`, `unblock_impact`, `stuck`, `pending_todos`, `timed_out`, `lint` (the backlog form). `batch` checks each operation by Can move on its task | These are the readers a tag check must reach separately: a task inside a visible backlog is not yet checked one by one |
| Carry no caller | Todos by id and by run (`get_task_todo`, `list_task_todos`), workflow runs and their closure, cases and their votes (`get_case`, `list_cases`, `list_case_votes`, `list_cases_by_votes`), repeating tasks, projects and their parties, deliverables and acceptance criteria, the agent list, `list_backlog_access`, `list_task_states` | Today only the hub's role check limits them. A reach rule needs a caller on each that shows a task or a todo |
| Hub readers | `api/http/promise_outcome_route.go` (`GetTask`), `api/http/taskmanager_case_progress.go` (case and its tasks), `agencies/report_promises.go` (`ListTasks`), `agencies/case_threads.go`, `agencies/case_notices.go`, `agencies/run_use.go`, `agencies/ask_run.go` | Direct calls on the board, with no person |
| App | MCP tools `taskmanager_task_list`, `_task_read`, `_task_pending`, `_backlog_list`, the todo, note and smart backlog tools, in `features/backlogs/*`, the asset work orders in `app/menu/sections/assets/*`, the assistant in `features/assistant/*` | The App reads tasks as tools, so it needs no route change of its own |
| Console | `taskmanager_task_list` in `data/pages/users.ts` and `usersDetail.ts`, the worker caps and the workflow run tools | Same |

### 1.5 The rules that decide who sees a task today

| Rule | Where | What it does |
|---|---|---|
| The module is mounted and the caller admitted | `api/http/membership.go` (`taskManagerFor`, `taskManagerAdmitted`) | A member passes. A resident passes only when a role carries `task.read` |
| A catalogue permission per action | `api/http/group_role_access.go` (`taskPermissioned`), `api/http/agent_permissions.go` (`agentPermissioned`) | An agent or a resident needs a role whose permissions allow the route's action: `task.read`, `task.edit`, `backlog.manage` |
| Backlog access by group | Sibling `backlog_access.go`, `backlog_access_list.go`, `backlog_access_reads.go` | Each backlog gives a group see, move or edit. The caller holds the highest level of any of their groups. With no grant and no owner group set, every backlog is visible. An issue is seen when its backlog is |
| The groups the caller holds | `agencies/groups.go` (`groupsOf`, wired by `UseGroups` in `agencies/registry.go`) | Every group the person holds a seat in. It does not read the assumed group (D33, D40), so a person in two groups sees the union today |
| The owner | `agencies/groups.go` (`ownerIn`, `UseInstanceOwner`) | The platform owner sees and edits every backlog. D42 says the owner assumes a group like anyone |
| No caller | `backlog_access.go` (`backlogVisibility`) | An empty requester id sees everything. The hub's own jobs of section 1.3 use it |
| Can move | `backlog_access_writes.go` (`requireMoveOn`, `requireMoveOnTask`) | Create, update, patch and the moves need Can move on the backlog |

### 1.6 The tag field and its Tag filter

| Piece | Where | Behaviour |
|---|---|---|
| The field | `models/task.go` (`Tags`), written by `setTaskTags` in `task_impl_task.go` | A list of names, resolved from `tagging` at read time, not a column. Setting it deletes the task's links and writes the new list; a name not yet in `tag` is created |
| The filter | `models/task.go`, `models/pending.go`, `models/find.go` (`Tag`, query `tag`); `task_list_filter.go` (`taskIDsWithTag`) | Each tag named adds a condition, so several tags mean all of them. The match ignores case |
| Free text | `task_pending.go` (`scopedTasks`) | The query `q` also matches tag names |
| The marks | `waiting_tag.go`, `task_orchestration_filter.go`, `task_pending.go` | Ready, Waiting, Blocked and Sinbin are label tags the sibling reads and rewrites |
| The smart backlog rule | `backlog_rules.go` (`RuleFieldTag`: has, does not have) | Compares the rule's value, ignoring case, with the task's label tags and its project name. A rule with `sprint 1` matches the label `sprint 1` |
| Where rules run | `backlog_smart.go` (`smartTaskIDs`) | Over the tasks the caller can see (`narrowToVisible`). The count on the Backlogs list is read per caller, so two people can already see two counts |
| The App filter | `features/backlogs/shared/tags.ts` (`tagsOf`, `withAllTags`) | A client-side filter over the issues already loaded: the mark, the repo, the topics and the backlog name, all chosen tags required |
| Saved as a smart backlog | `features/backlogs/smart/fromFilter.ts` | Each chosen tag becomes a Tag rule, matching all |

## 2. The decisions this page rests on

Taken from [Record permissions](record-permissions.md) section 5 and [Tag management](tag-management.md) section 1; none is new. D73 is quoted from ISS-207.

| # | Decision | Source |
|---|---|---|
| D23 | The system tag `all` always reaches every row; field codes still limit what is seen | record-permissions.md |
| D24 | Apart from `all`, tags are managed after the publish; none is in the agency file | record-permissions.md |
| D25 | Users are put in groups, and a group is given tags and roles | record-permissions.md |
| D27 | A row takes the tags of the assumed group when it is added. After that only someone holding the add code of that record adds a further tag. A row that existed before tags is reachable only through `all` | record-permissions.md |
| D28 | A person reaches a row when the row and the assumed group share at least one tag; `all` reaches every row | record-permissions.md |
| D32 | A person with no assumed group, or whose group has no tags, reaches no rows | record-permissions.md |
| D33 | A person acts with only the assumed group's roles, and its tags decide the rows | record-permissions.md |
| D40 | The assumed group is per login session | record-permissions.md |
| D42 | Roles come only from the seats in the assumed group. The platform owner assumes a group like anyone | record-permissions.md |
| D48 | Any group administrator may give `all` to a group, with or without other tags | tag-management.md |
| D53 | A tag cannot be deleted while any row or group carries it | tag-management.md |
| D56 | An AI agent acts just like a human: it is a member with seats in groups | record-permissions.md |
| D57 | A key session starts with no group and the agent assumes one of its own groups, like a person | record-permissions.md |
| D73 | Taskmanager tasks carry tags too, and the assumed group decides which tasks a person sees | ISS-207 |

## 3. The data model

### Before

```
 Task (issue) --- tagging ---> Label tag   sprint 1, hub-steward-swe, Ready, Waiting ...
   backlog, step                 free-form, name unique, set by a patch that replaces the list
   no creator, no group
        ^                 ^
        | parent_task_id  | task_id
 Todo (task_todo)      Note (task_note)   author_id, kind person | worker
   no tag                no tag

 Backlog (setting)  steps, or rules for a smart backlog (rule field Tag: has, does not have)
 Backlog access (setting)  backlog + group + level see | move | edit; owner group

 Who sees a task today
   1. the module is mounted and the caller admitted; a catalogue permission per action
   2. backlog access: the highest level among ALL groups the person holds a seat in
   3. the platform owner and an empty caller see everything

 Group ---- agency_group_tags ----> Reach tag (hub registry, `all` built in)
   no task, no row carries a reach tag yet
```

### After

Drawn on the owner's answers of 2026-11-24 (section 4).

```
 Backlog (setting `backlogs`) --- tags ---> Reach tag    new, a list of tag ids on the backlog, like RecordRow.Tags   (T1, T6)
   steps, or rules for a smart backlog      set when the backlog is made from the assumed group's tags (F8, not asked);
   a smart backlog has none                 a further tag only by add, never removed                                 (T5)

 Task (issue)  no reach tag of its own: it is reached through the backlog it is in; a move changes who sees it   (T1)
   --- tagging ---> Label tag   unchanged; a patch of labels cannot touch reach
        ^                 ^
        | parent_task_id  | task_id
 Todo: reach is its issue's (T2)     Note: reach is its issue's (T4)

 Backlog access (setting)  backlog + group + level
   see  : replaced by reach, a shared tag or `all`                                                 (F1)
   move : stays, per group                       edit : stays, per group

 Reach tag: name and group tags stay in the hub registry (agency_tags, agency_group_tags)
 The hub tells the sibling the assumed group's tag ids for each call                               (T6, F2)

 CHECK, in order, on every read and write of a task
   1. A group is assumed and has tags; if not, no tasks at all (D32)
   2. The task's backlog shares a reach tag with the group, or the group has `all` (D28)
   3. For a write: the assumed group has move or edit on the backlog (F2)
   4. A role seated in the group carries the catalogue permission of the action (D33, D42)
   A smart backlog's rules run over the tasks that pass 1 and 2                                    (T3)
   No person (the hub's own jobs): no check                                                        (F3)
```

### What changes, field by field

| Where | Field | Before | After |
|---|---|---|---|
| Backlog | `tags` | None | New, a list of tag ids in the entry of the `backlogs` setting. Set when the backlog is made and by the add route of T5. A smart backlog has none |
| Task | `tags` | Label tags, a list of names | Stays, labels only. A task has no reach tag of its own |
| Todo, note | any | No tag | None; reach is read from the issue and so from its backlog (T2, T4) |
| Backlog access | `see` level | Per group, the highest of every group the person holds | Replaced by reach. `move` and `edit` stay, per assumed group (F1, F2) |
| Smart backlog | rules | Over the tasks the person's backlog access shows | Over the tasks the check above lets through (T3) |
| Owner pass | `ownerIn`, `backlog_owner_group` view | The platform owner sees every backlog | Goes. The owner reaches a backlog through an assumed group (F3) |
| Operations with no caller | the 63 of section 1.4 that return a task or a todo | Only the hub's role check limits them | Each takes the caller and the same check (F4) |
| Reach tag (hub) | `agency_tags` row | Counts groups, and rows once ISS-186 exists | Also counts backlogs, so D53 refuses a delete while a backlog carries it (F6) |
| Sibling | a function from caller to the assumed group's tag ids | `UseGroups` gives all groups of the caller | A new function beside it, injected by the hub (T6) |

## 4. The owner's answers

The owner answered on 2026-11-24, one question at a time. The first drafts of this page recommended that a task copy the assumed group's tags; the owner chose the backlog's tags instead, and the rest follows from that. Each row says what was asked, the answer, and what it means for the build.

| # | Asked | Answer | What it means |
|---|---|---|---|
| T1 | How a task gets its reach tags | The backlog's tags. A task is reached through the backlog it is in | A task stores no reach. Moving a task to another backlog changes who sees it. A backlog needs a tag store |
| T1b | The tasks no session creates (import, repeating upkeep, report promises, sourced and generated tasks) | The backlog, as in T1 | No stamping at all. Each such task is reached through the backlog it lands in |
| F1 | Whether the backlog's tags sit beside backlog access or replace part of it | Replace the `see` level. `move` and `edit` stay | One rule for seeing: shared tag or `all`. A group can have `move` on a backlog it does not reach and still do nothing, because reach comes first |
| T2 | Do todos follow their issue | Yes | A todo has no tag. A person reaches a todo when they reach its issue's backlog. The five todo operations with no caller need one |
| T3 | A smart backlog filtered by "sprint 1" and the group tags | Reach first, then the rules | A smart backlog stores no tag. Two people with different groups see different lists and counts from the same rules. The Tag rule keeps meaning labels only |
| T4 | Do notes and an agent's reads follow the same rule | Yes, the same rule for everyone | A note follows its issue. An agent is held to its assumed group, and with no group reaches nothing, `next_ready` and `claim_next` included (D57, D32). The hub's own jobs with no person are not limited |
| T5 | Who may add a reach tag to an existing backlog | A person with Can edit on the backlog, from the tags of their assumed group | One route and one tool to add a tag. Nobody takes a tag off, as for a row (D27). The label patch never carries reach |
| T6 | Where the tags are stored | The owner asked why not a tags column like other records, and whether anything deviates. Answer: it is the same. A row has `tags`, a list of tag ids, in the agency sibling (ISS-186); a backlog gets `tags`, a list of tag ids, in the taskmanager sibling | The link-table option of the first draft is dropped. The tag names and the groups' tags stay in the hub. The only difference is the name of the thing that carries them: a task already uses `tags` for labels, so reach sits on the backlog, which has none |
| F3 | The owner's pass and the empty caller | The owner pass on backlogs goes. The empty caller stays for the hub's own jobs | The owner reaches a backlog through an assumed group that shares a tag or carries `all`, as D42 says |
| F4 | The operations with no caller | Each that returns a task or a todo takes the caller and gets the same check | A change in the sibling to about the half of the 63 operations |
| F5 | Backlogs that exist before reach tags | A cleanup first, then the check is switched on | A dry run and an apply with a backup first, tagging each existing backlog with the tags of the groups that hold it today. No check is switched on before it has run |

### Settled by an earlier decision, not asked

| # | Point | Settled as | By |
|---|---|---|---|
| F2 | Which groups count | Only the assumed group, for reach and for the `move` and `edit` levels | D33, D40, D42 |
| F6 | A tag a backlog carries | It cannot be deleted while a backlog carries it, as for a row or a group | D53 |
| F7 | Who gives `all` to a backlog | Only by the add route of T5, from the tags of an assumed group that carries `all`; the route has no other source | D48, D23 |

## 5. Not yet asked

| # | Point | Options | Recommended |
|---|---|---|---|
| F8 | How a new backlog gets its first tags. It is made by a person with Can edit, or by the hub with no person | A. The tags of the assumed group of the person who makes it, as a row takes them (D27). A backlog the hub makes with no person carries none and is reached only through `all`. B. The creator names them from the tags of their assumed group. C. None at creation; an editor adds them after | A, the nearest copy of D27. It is written into the build issues as the open owner question |
| F9 | A backlog nobody reaches, because every group that held it lost the tag or was disabled (D54) | A. Only a group with `all` reaches it, and an administrator adds a tag there. B. The sibling refuses to leave a backlog with no tag | A. A disabled group gives no tag (D54) and the same case exists for rows |

## 6. A worked example

Groups after the publish: `emea` with the tag `emea`, `apac` with the tag `apac`, and an administrator group with the tag `all`. The backlog Sprint 1 carries `emea`. The levels `move` and `edit` are given to `emea` and to the administrator group.

| Step | What happens | Question |
|---|---|---|
| 1 | Anna assumes `emea` and makes the task "Fix login" in Sprint 1, with the label `sprint 1`. The task carries no reach tag of its own | T1 |
| 2 | Carla in `emea` lists tasks and sees it. Ben in `apac` does not: Sprint 1 and `apac` share no tag | D28 |
| 3 | An administrator whose assumed group has `all` sees it | D23 |
| 4 | Carla's smart backlog "Sprint 1" (Match all, Tag has sprint 1) lists it. Ben's smart backlog with the same rules lists nothing of it, and its count leaves it out | T3 |
| 5 | Anna adds todos and a note. Carla reads them; Ben cannot read the issue, so he reads neither | T2, T4 |
| 6 | An AI agent seated in `emea`, with no group yet, calls `next_ready` and gets nothing. After it assumes `emea` it gets "Fix login" among the ready issues | T4, D57, D32 |
| 7 | Anna patches the labels to add `design`. The backlog's tags do not move; the label patch cannot reach them | T5, T6 |
| 8 | Anna moves "Fix login" to the backlog Backlog Apac, which carries `apac`. Carla no longer sees it; Ben now does | T1 |
| 9 | A backlog that exists before reach tags carries none. Only the administrator group sees its tasks until the cleanup tags it | F5, D27 |
| 10 | Dina, with Can edit on Sprint 1 and `apac` assumed, adds the tag `apac` to it. Ben now reaches every task in it. Nobody can take `emea` off | T5, D27 |
| 11 | Someone tries to delete the tag `emea`. It is refused: a group and a backlog carry it | F6, D53 |
| 12 | The owner of the Instance, assuming `emea`, sees the same as Carla. The owner assuming the administrator group sees all | F3, D42 |

## 7. Follow-up build issues

Filed from this page on 2026-11-24. They follow [Issue pattern](issue-pattern.md): the title is `<Where>: <outcome> (D<n>)`; the tags are exactly `sprint 1`, `hub-steward-swe` and `permissions`, plus the area tag; the description has Decision, Design, Output and Done when, with an Open owner question label until the owner answers; the todos are the four of section 4 of that page (inventory, red tests, build, update the page). A sibling issue adds a fifth todo, tag and push, which waits for the owner's yes.

Design for all of them is this page. The pattern names no area tag for the sibling, so the sibling issues take `taskmanager`.

| # | Title | Area tag | Waits for | Output | Done when |
|---|---|---|---|---|---|
| 1 | Sibling: a backlog carries reach tags, set when it is made, and one route adds a further tag (D73, D27) | taskmanager | The owner's answer to F8 | `tags` in the entry of the `backlogs` setting, the stamp on `create_backlog`, an add-one-tag route and tool, no way to take a tag off, the injected function from caller to the assumed group's tag ids | A red test of the stamp, of the add and of the refusal of a removal passes; a smart backlog carries no tag |
| 2 | Sibling: every read and write of a task checks the reach of its backlog (D73, D28, D32) | taskmanager | 1 | Reach added to `narrowToVisible`, `GetTaskFor`, `readScope`, `requireSeenBacklog` and `requireVisibleBacklog`; the `see` level of backlog access replaced; a caller added to the operations with none that show a task or a todo; todos and notes read through the issue; the owner pass removed | A red test for every reader of section 1.4 passes; no reader shows a task the group does not reach |
| 3 | Sibling: a smart backlog counts and lists only reached tasks (D73) | taskmanager | 2 | The smart backlog list and count run behind the check | Two groups see different counts of the same rules; a rule with `sprint 1` matches the label only |
| 4 | Hub: the board reads the assumed group (D33, D40, D42) | hub | 2 | The registry wires the new function; the groups of the board are the assumed group only; the owner pass is gone | A person in two groups reaches what the assumed one reaches and no more |
| 5 | Hub: a tag a backlog carries cannot be deleted (D53) | hub | 1 | The tag delete count includes backlogs, through the counter ISS-187 left open | The delete refusal names the backlog count |
| 6 | Hub: a cleanup tags the backlogs that exist before reach tags (D27, D32) | hub | 1, and the tag question ISS-175 holds | A dry run and an apply, with a backup first | After it, each existing backlog is reached by the groups that hold it; no check is switched on before it has run |
| 7 | App: a backlog shows its reach tags and an editor adds one (D73) | app | 1 | The backlog page names the reach tags apart from the labels, with an add action | The App reads the new field and no label filter changes meaning |
| 8 | Console: the tag page counts backlogs (D73, D53) | console | 5 | The tag page's count of what carries it includes backlogs | The count equals the delete refusal's |

Issue 1 is built in the sibling (ISS-219, branch iss219, not yet tagged): a backlog carries `tags`, `create_backlog` stamps the assumed group's tags of the caller, `add_backlog_tag` adds one, and no save removes one. The hub passes the assumed group's tag ids with `UseGroupTags`.

Order: 1, then 2 and 3 (sibling), the first tag and push with the owner's yes; then 4 and 5 on that tag; then 6 before the check is turned on; then 7 and 8. The hub switches at 4, as D5 of record permissions switches the row check, so 6 must have run before it.

## Open

| Point | Why it matters | State |
|---|---|---|
| F8 How a new backlog gets its first tags | Decides what `create_backlog` stamps, and so issue 1 | Not asked yet; the build issue carries it as an open owner question |
| F9 A backlog nobody reaches | Decides whether the sibling refuses to leave a backlog with no tag | Not asked yet |
