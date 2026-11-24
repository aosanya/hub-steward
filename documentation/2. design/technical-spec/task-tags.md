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
