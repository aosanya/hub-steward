# Task tags

Design for ISS-207 (TD-6179 to TD-6181). The decision it rests on is D73, quoted from the issue: taskmanager tasks carry tags too, and the assumed group decides which tasks a person sees. The rules it extends are in [Record permissions](record-permissions.md) (D23 to D28, D32, D53) and [Tag management](tag-management.md). D73 is not yet in the decision pages of this repo; this page takes its words from ISS-207. This is a design page: no code, and no build issue is filed from it.

| Built | Planned |
|---|---|
| The reach tag stores of a group and the routes to manage them (ISS-187, [Tags](../../3.%20implementation/guides/tags.md)). The taskmanager's own label tags and its backlog access by group, both described in section 1 | Everything this page asks: reach tags on tasks, the check on every read and write of a task, and the sibling's part |

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

Drawn on the recommended answer of each question in section 4. Nothing here is decided.

```
 Task (issue) --- tagging ---------> Label tag      unchanged; a patch of labels cannot touch reach   (T6)
   backlog, step
        | --- task_reach_tag ------> Reach tag      new, in the sibling, holds the tag id only        (T6)
        |        stamped when the task is created from the assumed group's tags (D27)               (T1)
        |        a further tag only by add, never removed                                            (T5)
        |
        |  parent_task_id               task_id
 Todo: no tag of its own,        Note: no tag of its own,
   reach is its issue's (T2)       reach is its issue's (T4)

 Backlog, backlog access: unchanged. A smart backlog stores no reach               (T3, F1)

 Reach tag: name and group tags stay in the hub registry (agency_tags, agency_group_tags)
 The hub tells the sibling the assumed group's tag ids for each call                  (T6, F2)

 CHECK, in order, on every read and write of a task
   1. A group is assumed and has tags; if not, no tasks at all (D32)
   2. The task shares a reach tag with the group, or the group has `all` (D28)
   3. The group's backlog level allows the action: see, move or edit               (F1)
   4. A role seated in the group carries the catalogue permission of the action (D33, D42)
   A smart backlog's rules run over the tasks that pass 1 and 2                     (T3)
```

### What changes, field by field

| Where | Field | Before | After |
|---|---|---|---|
| Task | `tags` | Label tags, a list of names | Stays, labels only |
| Task | `reach_tags` | None | New, read-only on the task; set only at creation and by the add route of T5. The name is not chosen |
| Sibling table | `task_reach_tag` | None | New: task id, tag id, tagged at. The tag id is a hub `agency_tags` id |
| Todo | any | No tag | None; reach is read from `parent_task_id` (T2) |
| Note | any | No tag | None; reach is read from `task_id` (T4) |
| Backlog access | grants and owner group | Per group, any group the person holds | Per assumed group (F2) |
| Smart backlog | rules | Over the tasks the person's backlog access shows | Over the tasks the check above lets through (T3) |
| Reach tag (hub) | `agency_tags` row | Counts groups, and rows once ISS-186 exists | Also counts tasks, so D53 refuses a delete while a task carries it (F6) |
| Sibling | a function from caller to the assumed group's tag ids | `UseGroups` gives all groups of the caller | A new function beside it, injected by the hub (T6) |

## 4. The questions, asked one by one

Each has the facts from section 1, the options, and the recommended one. The owner has not been asked any of them. The drawings above show the recommended answers.

### T1. How does a task get its reach tags?

Today a task has no creator and no group. A task is made by a person with Can move on a backlog, or by something with no person: the import, a repeating task's upkeep, the hub's report promises, a sourced or generated task. A person's task is created under the group they have assumed (D40) or, for an agent, the group it assumed (D57).

| Option | What happens | Cost |
|---|---|---|
| A. The assumed group's tags at creation | The task copies every tag of the group the creator has assumed, as a row does (D27). Moving a task to another backlog changes nothing | A creator with no group, or a group with no tag, cannot make a task that anyone but `all` reaches (D32) |
| B. The backlog's tags | The backlog carries reach tags and a task is reached through the backlog it is in. A move changes who sees the task | Backlogs would need a reach tag store; the task is not stamped by who made it, so it is not D27 |
| C. The creator picks | The creator names tags from those of the assumed group, at creation | A person can leave a task with no tag, and nobody sees it |
| D. A and B together | Reach is the union of both | Two sources to explain; a move changes only half |

Recommended: A. It is what D27 says for a row and what D73 asks, and no second tag store is needed.

T1b. Tasks that no session creates (the import, a repeating task's upkeep, the hub's report promises, sourced and generated tasks, the sibling's own marks, which are label tags and need no answer here).

| Option | What happens |
|---|---|
| i. The source stamps | A repeating task, a sourced or generated batch and a report promise keep the tags of the group the person who made them had assumed; the task copies them. The import takes the importer's |
| ii. Only `all` | These tasks carry no tag, so only a group with `all` reaches them (as D27 does for rows that existed before tags) |
| iii. Refuse | These calls must run as a group, so the hub's jobs would need an assumed group |

Recommended: i where a person made the source, and ii where nobody did. iii would change every hub job for no gain.

### T2. Do todos follow their issue?

A todo has `parent_task_id` and no tag. Twelve of the todo operations carry the person; `create_task_todo`, `get_task_todo`, `dispatch_task_todo`, `list_task_todos` (the todos of a run) and `link_todo_to_run` carry none.

| Option | What happens | Cost |
|---|---|---|
| A. Follow the issue | A todo has no tag; a person reaches it when they reach its issue. Changing an issue's tags changes its todos at once | Every todo read must look up the parent. The five operations with no caller need one |
| B. A copy at creation | Each todo copies the issue's tags | Copies drift when a tag is added to the issue |
| C. Its own tags | A todo is tagged like a task | A todo of an issue the person reaches could be hidden, or the reverse |

Recommended: A. A todo is a part of its issue (the todo counts and ready board already narrow through the issue's backlog), and a copy is a second place to keep right.

### T3. How does a smart backlog already filtered by "sprint 1" combine with the group tags?

`sprint 1` is a label tag. A smart backlog's rule `Tag has sprint 1` compares labels and the project name only, and its rules run over the tasks the person's backlog access shows; the count on the Backlogs list is already read per person.

| Option | What happens | Cost |
|---|---|---|
| A. Reach first, then the rules | The rules run over the tasks the assumed group reaches. The result is the tasks that are reached and match. A smart backlog stores no reach. Two people with different groups see different lists and counts from the same rules. The Tag rule keeps its meaning: labels only. "Match any" never widens beyond reach | A smart backlog is not the same list for everyone, which it already is for backlog access |
| B. A rule can name a reach tag | As A, and the Tag rule also accepts a reach tag, so a smart backlog can say "Tag has emea" | One rule field means two things. A label and a reach tag may share a name; one of the two would need a prefix |
| C. The smart backlog carries reach tags | A smart backlog has reach tags like a group and shows only the tasks that share one | A saved view would hide tasks from a person who has the right group tag |

Recommended: A. The rules answer "which of what I may see", and reach answers "what I may see"; they should not be one field. B can be added later without changing A.

### T4. Do notes and an agent's reads follow the same reach rule?

Notes (the Log) are read and written through `GetTaskFor`, so they already follow the issue's backlog. An AI agent acts as a member (D56) and, in a key session, assumes a group like a person (D57). An agent reads tasks through the same operations (`next_ready`, `claim_next`, `pending_tasks`) with its member id as the caller. The hub's own jobs call the board with no person.

| Option | What happens | Cost |
|---|---|---|
| A. The issue's rule, for everyone | A note follows its issue: whoever reaches the issue reads and adds to its Log. An agent is held to the same check from its assumed group; with no group it reaches no task, `claim_next` and `next_ready` included (D32). The hub's own jobs with no person are not limited, and stamp what they create (T1b) | An agent that has not assumed a group sees an empty board, which is the rule for a person too |
| B. A note has its own tags | A note carries the tags of the author's group; a note can be narrower than its issue | Two people on one issue read different Logs; a worker's automatic notes need a group too |
| C. Agents are exempt | An agent keeps reading every task of a mount | Contradicts D57, and an AI role would see what its seat does not |

Recommended: A.

### T5. Who may tag an existing task?

The label list is replaced whole by a patch or an update, and a person needs Can move on the task's backlog. D27 lets only the holder of a record's add code add a further tag to a row, and only by adding. A task has no record, no add code and no field codes; the nearest code is `task.edit`, which carries `taskmanager.task.create`.

| Option | What happens | Cost |
|---|---|---|
| A. Nobody | Reach tags are set at creation only | A task made under the wrong group is stuck |
| B. A person who may move the task and holds `task.edit` | May add a tag from those of the group they have assumed, by a route of its own. Nobody removes a tag, as in D27 | A new route and tool for the add; the label patch must never carry reach tags |
| C. A new permission | A catalogue code, name not chosen, carried by a role; its holder adds | The catalogue grows by one code |
| D. Group administrators only | Whoever may give tags to groups may give them to tasks | Task owners cannot fix their own tasks |

Recommended: B. It is the nearest copy of D27 and uses a code that exists. Taking a tag off stays impossible, as for a row.

### T6. What does the taskmanager sibling store?

Reach tags of groups, and the list of tags, live in the hub registry. The sibling (a public repo, taken by tag, where a change needs a tag and push with the owner's yes) stores tasks, label tags, notes and todos, and already takes functions from the hub: `UseGroups`, `UseGroupExists`, `UseInstanceOwner`.

| Option | What happens | Cost |
|---|---|---|
| A. The sibling stores the link | A table `task_reach_tag` holds task id and tag id. The hub injects a function from caller to the assumed group's tag ids, as it does for groups. The sibling filters in its own queries, so counts, pages and every route and tool are right. The hub keeps the tag list and the groups | A sibling change, tagged and pushed |
| B. The hub stores the link | The hub keeps (task id, tag id) in a registry table and drops what the person may not see from each answer | The hub would filter 158 operations after the fact: pages and counts go wrong, and a hidden task's id can leak through links |
| C. One store: reach tags are label tags | A reserved name or kind in the existing `tag` table | Labels are free-form and replaced whole, so any patch could remove or forge reach; a label named like a group's tag would reach rows |

Recommended: A, as [Record permissions](record-permissions.md) recommends for rows ("Where tags are stored"). The task shows the reach tags in their own field and never in `tags`.

## 5. Found while writing, not yet asked

Each has options and a recommendation, like the six above.

| # | Point | Options | Recommended |
|---|---|---|---|
| F1 | Reach and backlog access together. Backlog access (see, move, edit per group) already exists; D73 adds reach. The issue's title names backlogs and smart backlogs | A. Both must pass: reach says which tasks, the backlog level says what the group may do with them. Neither backlog carries a tag. B. Reach replaces backlog access. C. A backlog carries reach tags and a task is reached through it (T1 option B) | A. Backlog access keeps its meaning, and a backlog or a smart backlog needs no tag of its own |
| F2 | Which groups count. Today `groupsOf` returns every group the person holds a seat in, so the backlog level is the highest of all of them. D33 says only the assumed group counts | A. Only the assumed group, for reach and for the backlog level. B. Reach by the assumed group, backlog level by all groups | A, because D33 says the group's roles and tags are all a person has |
| F3 | The owner and the empty caller. `ownerIn` lets the platform owner see every backlog, and an empty caller sees everything. D42 says the owner assumes a group like anyone | A. The owner pass for backlogs goes; the owner reaches tasks only through a group with `all`. The empty caller stays for the hub's own jobs. B. The owner keeps the pass | A, as D42 says; an administrator group with `all` is how the owner sees every task |
| F4 | The 63 operations with no caller. Some return a task, a todo or text of one: todos by id and by run, cases and their linked work, workflow run lists, repeating tasks | A. Each that returns a task or todo gets a caller in the sibling and the same check. B. The hub refuses them to everyone but the owner. C. Leave them | A. B and C leave a hole next to the rule |
| F5 | Tasks that exist before reach tags, among them the tasks of the hub-steward-swe board this repo is worked from. D27 says a row without a tag is reachable only through `all` | A. Same for tasks, plus a cleanup that tags the existing tasks first, the way ISS-175 does for rows. B. Stamp each existing task with the tags of the groups that hold its backlog. C. Stamp all with `all` | A, with the cleanup built and run before the check is switched on. The tag the cleanup uses is ISS-175's open point |
| F6 | D53 and tasks. A tag cannot be deleted while a row or group carries it | A. A task counts like a row: the refusal names the task count too. B. Tasks do not count | A, since a task that loses its only tag is reachable only through `all` (D27) |
| F7 | Who gives `all` to a task. D48 lets a group administrator give `all` to a group. A task takes `all` only by copying it from the creator's group | A. Only by that copy. B. Also by the add route of T5 | A. `all` reaches everything and should not be given one task at a time |

## 6. A worked example

Groups after the publish: `emea` with the tag `emea`, `apac` with the tag `apac`, and an administrator group with the tag `all`. The backlog Sprint 1 gives all three Can move. Every answer below is the recommended one.

| Step | What happens | Question |
|---|---|---|
| 1 | Anna assumes `emea` and makes the task "Fix login" in Sprint 1, with the label `sprint 1`. The task takes the reach tag `emea` | T1, D27 |
| 2 | Carla in `emea` lists tasks and sees it. Ben in `apac` does not: no tag is shared | D28 |
| 3 | An administrator whose assumed group has `all` sees it | D23 |
| 4 | Carla's smart backlog "Sprint 1" (Match all, Tag has sprint 1) lists it. Ben's smart backlog with the same rules lists nothing of it, and its count leaves it out | T3 |
| 5 | Anna adds todos and a note. Carla reads them; Ben cannot read the issue, so he reads neither | T2, T4 |
| 6 | An AI agent seated in `emea`, with no group yet, calls `next_ready` and gets nothing. After it assumes `emea` it gets "Fix login" among the ready issues | T4, D57, D32 |
| 7 | Anna patches the labels to add `design`. The reach tag stays; the label patch cannot remove it | T5, T6 |
| 8 | Anna, holding `task.edit` and Can move, adds the reach tag `apac` while she has `apac` assumed. Ben now reaches the task. Nobody can take `emea` off | T5, D27 |
| 9 | A task made before reach tags carries none. Only the administrator group sees it until the cleanup tags it | F5, D27 |
| 10 | Someone tries to delete the tag `emea`. It is refused: a group and tasks carry it | F6, D53 |

## 7. Follow-up build issues, drafted and not filed

They follow [Issue pattern](issue-pattern.md): the title is `<Where>: <outcome> (D<n>)`; the tags are exactly `sprint 1`, `hub-steward-swe` and `permissions`, plus the area tag; the description has Decision, Design, Output and Done when, with an Open owner question label until the owner answers; the todos are the four of section 4 of that page (inventory, red tests, build, update the page). A sibling issue adds a fifth todo, tag and push, which waits for the owner's yes. Each draft is written for the recommended answers and changes if an answer does.

Design for all of them is this page. The pattern names no area tag for the sibling, so the sibling drafts take `hub`; the owner may prefer another.

| # | Title | Area tag | Waits for | Output | Done when |
|---|---|---|---|---|---|
| 1 | Sibling: a task carries reach tags, stamped when it is created (D73, D27) | hub | The owner's answers to T1, T1b and T6 | The table `task_reach_tag`, the field `reach_tags`, the injected function from caller to the assumed group's tag ids, the stamp on every task creation path of section 1.3, a migration | A red test of each creation path fails without the stamp and passes with it; a task made with no group carries no tag |
| 2 | Sibling: every read and write of a task checks reach (D73, D28, D32) | hub | 1, and F1 to F4 | Reach added to `narrowToVisible`, `GetTaskFor`, `readScope`, `requireSeenBacklog` and `requireVisibleBacklog`; a caller added to the operations with none that show a task or todo; todos and notes read through the issue | A red test for every reader of section 1.4 passes; no reader shows a task the group does not reach |
| 3 | Sibling: add a further reach tag to a task (D27) | hub | 1, and the answer to T5 | One route and one MCP tool; no way to take a tag off; the label patch carries no reach | A person with the right to add may add; a patch of labels leaves the reach tags unchanged |
| 4 | Sibling: a smart backlog counts and lists only reached tasks (D73) | hub | 2, and the answer to T3 | The smart backlog list and count run behind the check | Two groups see different counts of the same rules; a rule with `sprint 1` matches the label only |
| 5 | Hub: the board reads the assumed group (D33, D40, D42) | hub | 2 | The registry wires the new function; `groupsOf` for the board returns the assumed group only; the owner pass is removed (F2, F3) | A person in two groups reaches what the assumed one reaches and no more |
| 6 | Hub: the hub's own jobs stamp the tasks they create (D27) | hub | 1, and the answer to T1b | Report promises, the repeating task upkeep, the import and the case landing pass the tags of their source | A task from each job carries the tags of its source |
| 7 | Hub: a tag a task carries cannot be deleted (D53) | hub | 1, and the answer to F6 | The tag delete count includes tasks, through the counter ISS-187 left open | The delete refusal names the task count |
| 8 | Hub: a cleanup tags the tasks that exist before reach tags (D27, D32) | hub | 1, and the tag question ISS-175 holds | A dry run and an apply, with a backup first | After it, the tasks of the working boards are reached by the groups that should reach them; no check is switched on before it has run |
| 9 | App: an issue shows its reach tags and a person adds one (D73) | app | 3 | The issue page names the reach tags apart from the labels, with an add action | The App reads the new field and no label filter changes meaning |
| 10 | Console: the tag page counts tasks (D73, D53) | console | 7 | The tag page's count of what carries it includes tasks | The count equals the delete refusal's |

Order: 1, then 2, 3 and 4 (sibling), the first tag and push with the owner's yes; then 5, 6 and 7 on that tag; then 8 before the check is turned on; then 9 and 10. The hub switches at 5, as D5 of record permissions switches the row check, so 8 must have run before it.

## Open, asked one by one

None is decided. They are asked of the owner in this order, one at a time.

| Point | Why it matters | State |
|---|---|---|
| T1 How a task gets its reach tags, and T1b the tasks no session makes | Decides what every creation path stamps | Not asked yet |
| T2 Whether todos follow their issue | Decides whether a todo needs a tag store | Not asked yet |
| T3 How a smart backlog and the group tags combine | Decides what a smart backlog means for two groups | Not asked yet |
| T4 Whether notes and an agent's reads follow the same rule | Decides the reach of the Log and of an AI role | Not asked yet |
| T5 Who may tag an existing task | Decides one new route and maybe one new permission | Not asked yet |
| T6 What the taskmanager sibling stores | Decides where the code goes and whether the sibling needs a tag and push | Not asked yet |
| F1 to F7 | Each follows from the six above or from D33, D42 and D53; asked after them | Not asked yet |
