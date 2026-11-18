# Taskmanager tools that read the backlog

The taskmanager module (`code/wakala-api/modules/taskmanager`) serves its routes and MCP tools from one declared file, `taskmanager.operations.json`. A tool is named from its action, so `taskmanager.task.find` is `taskmanager_task_find`. Each action is listed under `task.read` in `modules/agency/models/permissions_catalog.json`, and each tool is on the pinned roster in `internal/api/http/testdata/mcp_roster/no-mounts.txt`.

## Which tool answers what

| Question | Tool | Route |
|---|---|---|
| What is open, and how many at each step and priority | `taskmanager_task_pending` | `GET /pending-tasks` |
| Which issue is this id, code or text | `taskmanager_task_find` | `GET /find-tasks` |
| Which issue should a worker take next | `taskmanager_task_next_ready` | `GET /next-ready` |
| Which issues can start together because their files do not clash | `taskmanager_task_next_ready_batch` | `GET /next-ready-batch` |
| Take the next ready issue and hold it under a lease | `taskmanager_task_claim_next` | `POST /claim-next` |
| Keep the lease of an issue taken with claim_next, or with claim and a holder, alive | `taskmanager_task_heartbeat` | `POST /tasks/{taskID}/heartbeat` |
| The state of the board in one read | `taskmanager_task_board_snapshot` | `GET /board-snapshot` |
| Which open issues finishing would unblock the most others | `taskmanager_task_unblock_impact` | `GET /unblock-impact` |
| Which issues break the filing rules | `taskmanager_task_lint` | `GET /lint` |
| Which issues in progress are not moving, and why | `taskmanager_task_stuck` | `GET /stuck` |
| The todos that can start now across the issues in progress | `taskmanager_task_todo_ready_board` | `GET /todo-ready-board` |
| What changed on the board after a cursor | `taskmanager_task_changes_since` | `GET /changes-since` |
| Patch or move up to 50 issues in one call | `taskmanager_task_batch` | `POST /batch` |
| Create an issue with its todos and their order in one call | `taskmanager_task_create_with_todos` | `POST /create-with-todos` |
| Which backlogs the caller can see, with their steps and counts, or just one of them | `taskmanager_backlog_list` | `GET /backlogs` (`?backlog=` for one) |
| Cap how many issues a step may hold | `taskmanager_backlog_step_wip_limit` | `PUT /backlogs/{backlogID}/steps/{stepID}/wip-limit` |
| Why an issue is Waiting: what it waits on and what waits on it | `taskmanager_task_dependencies` | `GET /tasks/{taskID}/dependencies` |
| Everything a worker reads before starting an issue, in one call | `taskmanager_task_brief` | `GET /tasks/{taskID}/brief` |
| Which issues in progress touch the same files as an issue or a list of paths | `taskmanager_task_file_overlaps` | `GET /file-overlaps` |
| Which issues in progress are past their working-time cap | `taskmanager_task_timed_out` | `GET /timed-out` |
| Take an issue: move it to In Progress, write the taken entry, record the caps (and the holder and lease when a `holder` is sent) | `taskmanager_task_claim` | `POST /tasks/{taskID}/claim` |
| Stop work on an issue as Blocked or Sinbin, with the tags and the move done right | `taskmanager_task_release` | `POST /tasks/{taskID}/release` |
| The whole issue | `taskmanager_task_read` | `GET /tasks/{taskID}` |
| Page through every issue | `taskmanager_task_list` | `GET /tasks` |

## taskmanager_task_find

Inputs: `q` (required), `backlog` (id or name), `step` (id or name), `tag` (repeat it to require every tag), `include_closed` (default false), `limit` (default 25, at most 100) and `offset`. The caller is taken from the session.

`q` is read as one of three things:

| `q` | Matches | Order |
|---|---|---|
| A uuid | the issue with that id | one issue |
| One token of letters then digits, with or without a dash (`SW39`, `app67`, `DEV-1`) | every issue whose code starts with it, without regard to case; an issue that only names the code in its description is not matched | the exact code first, then rank |
| Anything else | every word appears, without regard to case, in the title, the code, a tag or the description | rank |

The answer is `total`, counted over everything that matches, and `items`: the same compact items as `taskmanager_task_pending` (id, code, title, state, backlog, step, priority, tags, rank, blocked, waiting, sinbin), without the description. Only issues of backlogs the caller may see are matched, as for `taskmanager_task_pending`. A blank `q` is refused with 400 and a message that names `q`; an unknown backlog or step is also a 400.

Open issues only, unless `include_closed` is true. The in-tray sorter and the backlog workers use one find call for a duplicate check; a words search over the description is what finds a duplicate that names the same thing in other words.

## taskmanager_backlog_list

Inputs: `backlog` (optional, an id or a name; case does not matter). The caller is taken from the session.

The answer is `items`: every backlog the caller can see, each with its steps and counts. With `backlog` the list holds only that backlog, so a worker that needs one backlog's step ids does not receive them all; an unknown backlog, or one the caller cannot see, gives `{"items": []}` and not an error. Without `backlog` the list is unchanged.

## taskmanager_task_next_ready

Inputs: `backlog` (id or name), `tag` (repeat it to require every tag) and `limit` (1 to 5, default 1). The caller is taken from the session.

The answer is `total_ready`, every Ready issue at the To do step that the filters match, and `items`: the first `limit` of them, lowest rank first, each with id, code, title, priority, effort, tags, rank, backlog and step and without the description. An issue that carries Sinbin, Blocked or Waiting is never counted or returned, even beside Ready. With nothing ready, `items` is empty and `total_ready` is 0. A backlog the caller cannot see is refused as unknown, 400, the same as a backlog that does not exist; a limit outside 1 to 5 is also 400. A worker takes the first item and reads it with `taskmanager_task_read`.

## Filters for orchestrating agents

`taskmanager_task_list` and `taskmanager_task_pending` take all of these; `taskmanager_task_next_ready` takes the ones marked next_ready and also `priority` and `repo` (the issue's `project_name`). A bad value is 400, and `by_step`, `by_priority` and `total` follow the filter.

| Filter | Keeps | next_ready |
|---|---|---|
| `assignee`, `unassigned` | issues held by that agent, or by nobody; not both | yes |
| `blocked`, `waiting`, `sinbin` | issues that carry the mark (true) or not (false) | no |
| `has_todos`, `todos_open` | issues with todos, or with at least one todo not Done | yes |
| `has_files` | issues whose `files` list is not empty (true) or is (false) | yes |
| `effort` | one of unknown, very_low, low, medium, high, very_high | yes |
| `created_since`, `updated_since` | issues changed at or after an RFC 3339 time | yes |
| `ids` | these issue ids, repeated, at most 100 | no |
| `min_days_in_step` | issues that have sat in their step at least that many whole days (`days_in_step`) | no |
| `sort` | `rank` (default), `priority`, `updated` or `created` | no |
| `fields` | only those keys of each item, repeated or comma-separated, on all three tools; an unknown name is 400 naming it; `total`, `by_step` and paging do not change | yes |

## taskmanager_task_next_ready_batch

Inputs: `count` (1 to 10, default 3), `skipped_limit` (1 to 50, default 3; 0, a negative, above 50 or a non-number is 400), `backlog`, `tag` and `include_unfiled`. Read-only.

The answer is `items` (the chosen Ready issues at To do, lowest rank first, each with id, code, title, priority, effort and files), `skipped` (the first `skipped_limit` passed-over issues in rank order, each with `clashes_with`, the code of the issue in progress or the earlier chosen issue its files overlap), `skipped_total` (the full number passed over because they clash) and `unfiled_left_out`. The choice is greedy: no two items overlap and none overlaps an issue in progress, by the rule of `taskmanager_task_file_overlaps`. An issue with no files is left out and counted, unless `include_unfiled` is true, then it clashes with nothing.

## taskmanager_task_claim_next

Inputs: `backlog`, `tag`, `agent` (default the caller) and `lease_minutes` (1 to 240, default 30; another value is 400). Needs Can move.

It does what `taskmanager_task_claim` does to the first Ready issue at To do that is not Sinbin, Blocked or Waiting, does not wait on an open dependency and does not overlap an issue in progress, and also records the agent as the assignee and `lease_until`. The answer is as for claim. Two agents calling at once take different issues. 409 when none is free, 403 when some are free but the caller cannot move them.

The lease rule: an issue still In Progress past its `lease_until` is put back at To do with its assignee cleared and a Log entry, before every `claim_next` and `heartbeat`.

## taskmanager_task_heartbeat

Inputs: `taskID`, `agent` (default the caller) and `lease_minutes` (as above). It renews the lease taken by `taskmanager_task_claim_next` and also one taken by `taskmanager_task_claim` with a `holder`, when `agent` is that holder. `lease_until` becomes `lease_minutes` from now, not added to the old one. The answer is `id`, `code`, `agent` and `lease_until`. 409, writing nothing, when the issue is not In Progress, was taken without a lease, is held by another agent or its lease had already run out.

## taskmanager_task_board_snapshot

Inputs: `backlog` and `stalled_days` (default 2; below 0 is 400). Read-only, about five queries.

The answer is `steps` (`name`, `count` equal to `by_step` of `taskmanager_task_pending`, `oldest_days` and `oldest_code`, measured from the last change; a named backlog lists every step, zeros included), `agents` (issues In progress per assignee, most loaded first), `stalled` (In progress and unchanged for more than `stalled_days`, longest first), `blocked_chains` (each Blocked issue with `waits_on`, each `code` and whether it is itself blocked), `ready` (the `total_ready` of next_ready) and `todo_progress` (`done`, `total` over the issues In progress). Dependencies on issues outside the backlog asked for are not followed.

## taskmanager_task_unblock_impact

Inputs: `limit` (default 10, at most 50), `backlog` and `tag`. Read-only.

The answer is `items`: every open issue that another open issue waits on, with `direct` (issues waiting on it), `total` (down the whole chain, each counted once, cycles not followed) and `dependents` (their codes), ordered by `total`, then `direct`, then rank. Done, failed and cancelled issues are neither listed nor counted.

Where a tool lists issues by code, an issue with no code is named by its title trimmed to 40 characters, else by its id: `dependents` of `taskmanager_task_unblock_impact`, `oldest_code`, the `codes` of `agents` and `waits_on` of `taskmanager_task_board_snapshot`, and `clashes_with` of `taskmanager_task_next_ready_batch`. The `code` field of an item stays as stored.

## taskmanager_task_lint

Inputs: `taskID`, or `backlog` and `step` for the open issues there in rank order; `limit` (default 50, at most 200) and `offset`. Read-only; a `taskID` that is unknown or unseen is 404, and an unseen `backlog` is 400.

The answer is `items` (id, code, title and `findings`, each a `rule` and a `message`; empty when clean), `total` and `clean` (issues on this page with no finding).

| Rule | Fires when |
|---|---|
| `no_description` | the description is blank |
| `no_done_when` | the description has none of Done looks like, Pass when, Done when |
| `no_todos` | the issue has no todos |
| `last_todo_not_documentation` | the last todo's title does not say document |
| `no_files` | `files` is empty |
| `effort_unknown` | effort is unknown |
| `no_priority` | priority is blank |
| `todo_without_description` | a todo has no description |

## taskmanager_task_stuck

Inputs: `backlog`, `tag` (repeat it to require every tag), `stalled_days` (default 2), `reason` (keep only issues that break that rule), `limit` (default 25, at most 100; more is 400) and `offset`. Read-only; a person sees only the backlogs their groups see, and an unseen `backlog`, a negative `stalled_days` and an unknown `reason` are refused.

The answer is `items` and `total` (every stuck issue). Each item is an In Progress issue that breaks at least one rule: `id`, `code`, `title`, `assignee`, `days_in_step`, `days_since_activity`, `todos_done`, `todos_total`, `reasons` and `next_action` (the sentence for the first reason). Items with most reasons come first, then the longest quiet. A closed issue is never listed.

| Rule | Fires when |
|---|---|
| `no_todos` | the issue has no todos |
| `no_todo_started` | it has todos and none is In progress or Done |
| `all_remaining_todos_blocked` | open todos exist, none is In progress, and none can start |
| `only_documentation_left_open` | every open todo has document in its title and none is In progress |
| `lease_expired` | `lease_until` is in the past: the holder of a lease (from `taskmanager_task_claim_next`, or `taskmanager_task_claim` with a `holder`) stopped heartbeating |
| `no_activity` | `days_since_activity` has reached `stalled_days` |
| `unassigned_in_progress` | `assigned_to` and `held_by` are both empty, so the issue was taken without a holder (`taskmanager_task_claim` with no `holder`) or never given one |
| `files_clash_with_another_in_progress` | its files overlap those of another open In Progress issue |

`days_since_activity` counts from the latest of the issue's own update, its todos' updates and its newest note. `days_in_step` is whole days since the issue entered its step (`entered_step_at`); an issue that has not moved since the hub began recording it counts from its `updated_at`, then its `created_at`.

## taskmanager_task_todo_ready_board

Inputs: `backlog`, `tag` (repeat it to require every tag) and `limit` (1 to 100, default 25; anything else is 400). Read-only; a person sees only the backlogs their groups see, and an unknown or unseen `backlog` is 400.

The answer is `items`, ordered by the issue's rank and then the todo's order: each is a todo (`id`, `code`, `title`, `instructions`, `ordinality`, `state`, `can_run_parallel`, `elapsed_seconds`) with its issue (`issue_id`, `issue_code`, `issue_files`), and `total`, which counts every match. Only issues at the In Progress step contribute, and a todo is listed by the same rule as `taskmanager_task_todo_ready`.

## taskmanager_task_changes_since

Inputs: `cursor` (opaque; empty returns no changes and a cursor for now), `limit` (default 100, at most 500), `backlog` and `tag`. Read-only; a cursor this tool did not return and a `limit` above 500 are 400, and a person sees only the issues of the backlogs their groups see.

The answer is `changes` in time order (`id`, `code`, `title`, `kind`, `from`, `to`, `at`), `next_cursor` to send next and `has_more`.

| Kind | `from` and `to` | Read from |
|---|---|---|
| `created` | empty | the time the issue was filed |
| `priority` | the old and new priority | the Log entry a priority change writes |
| `moved` | the old and new `backlog/step` | the automatic Log entry of the move |
| `status` | the old and new status | the automatic Log entry of the change |
| `tags` | the old and new tags, sorted and comma-joined | the automatic Log entry of the change |
| `assigned`, `unassigned` | the old and new holder (empty for none) | the automatic Log entry of the hand-over or release |
| `deleted` | empty | the automatic Log entry of the delete |

Every move, hand-over, status change, tag change and delete writes one automatic Log entry (kind `automatic`, with the from and to), through every route including `taskmanager_task_batch`, `taskmanager_task_claim` and `taskmanager_task_claim_next`; a write that changes nothing writes none, and the workflow-run cancel and rollback paths write none. Changes made before these entries existed are not reported.

## taskmanager_task_batch

Inputs: `operations` (1 to 50, else 400), each `{op, task_id}` with `op` `patch` (and `patch`, the fields of `taskmanager_task_patch`) or `move_to_step` (and `backlog`, `step`), and `all_or_nothing` (default false). Needs Can move on the backlog of each issue, checked per operation as the single tool does.

The answer is `results` (one per operation in order: `index`, `op`, `task_id`, `ok`, `applied`, `error`), `applied` and `failed`. By default a refused operation is reported and the rest still run. With `all_or_nothing` every operation is checked first, each against the state the earlier ones leave, a move into a step at its WIP limit included (an earlier move out of that step frees room); if any is refused nothing is applied, and the ones that would have passed read `ok` true, `applied` false. There is no true undo: if an operation fails after passing the check, the ones after it are not applied and the ones before it stay. Every operation that carries an error reads `ok` false and counts in `failed`, in every mode.

## taskmanager_task_create_with_todos

Inputs: the fields of `taskmanager_task_create` and `todos`, in order, each `{title, instructions, description, can_run_parallel, waits_on}`. Needs Can move on the backlog the issue lands in. `waits_on` lists positions, 1-based (1 is the first todo sent), and each must be an earlier one: a reference to itself, a later todo or a cycle is 400. A todo that waits on others lands Blocked and turns To do when they are Done.

The answer is `issue` and `todos` (id, code, ordinality, `depends_on` as ids, status, state), 201. The todos are checked before the issue is made, and an issue whose todo cannot be made is taken away again, so nothing is left behind.

## taskmanager_backlog_step_wip_limit

Inputs: `backlogID`, `stepID` and `wip_limit`, a whole number, 0 or more; 0 clears it. Needs Can edit on the backlog. A step with a limit shows `wip_limit` in the backlog list and every backlog summary.

A `taskmanager_task_move_to_step`, `taskmanager_task_claim` or `taskmanager_task_claim_next` into a step that already holds that many issues is 409 and names the limit. `taskmanager_task_move_to_step` takes `override` true, which works only with Can edit on the backlog. Lowering a limit below the count removes nothing and only refuses new issues until the count is under it. An issue moved to the step it is already at is not counted again. A move into a step that names no statuses still changes the status when it closes or reopens an issue: into Done or Archive the status becomes `completed`, into Cancelled `cancelled`, and out of Done, Archive or Cancelled into To do or In coming `pending`, into In progress `in_progress`. Review and the other open steps leave the status as it is. An issue that depends on a moved issue can then be claimed. `taskmanager_task_batch` moves are limit-checked like single moves (there is no override in a batch). Creating an issue straight into a full step is not limit-checked, and two moves in the same instant can both pass.

Every issue read and every `taskmanager_task_pending` item carries `entered_step_at` and `days_in_step`, worked out when read. The hub records `entered_step_at` on each move; an issue that has not moved since then counts from its `updated_at`, then its `created_at`.

## taskmanager_task_dependencies

Input: `taskID`. The caller is taken from the session; an issue the caller cannot see is 404.

The answer is `depends_on` (the issues this one waits on) and `needed_by` (the issues that wait on it), each a list in rank order of `id`, `code`, `title`, `step`, `state` and `open`, where `open` is true while that issue is not Done or Cancelled. `blocks_start` is true when any issue it waits on is open. An issue in a backlog the caller cannot see is not named: `hidden_depends_on` and `hidden_needed_by` count them, and a hidden open dependency still makes `blocks_start` true so a worker is not told an issue is free when it is not.

## taskmanager_task_timed_out

Input: `backlog` (id or name, required: a blank or missing one is 400, and a backlog that does not exist or that the caller cannot see is refused as unknown). The caller is taken from the session.

The answer is `items`: every issue of the backlog that sits at its In Progress step (the step named In Progress, without regard to case; the card's status is ignored) and whose time since the start of its working-time clock (the Taken entry of its latest claim; see `worker-clock.md`) is past its working-time cap, the issue's own or else the default 15 minutes, which is the board's Time is up measure. The hub's own automatic entries do not start the clock. An issue at that step with no start (no worker entry since it was moved into doing) is also listed. Each item has `id`, `code`, `title`, `minutes_since_first_entry` and `minutes_since_last_entry` (both null when there is no entry), `cap_minutes`, `clock_stopped` (as `taskmanager_task_caps_read` reports it, including the hub's idle stop) and `last_entry` (`kind`, the first 200 characters of `text`, `created_at`; null when there is none).

The tool names no cause. Whether the run was interrupted, idle or too big stays the lead's call, made from the last entry and `clock_stopped`. It moves and tags nothing.

## taskmanager_task_claim

Inputs: `taskID`, and optionally `holder` and `lease_minutes`. The caller is taken from the session and needs Can move on the backlog the issue is in; an issue the caller cannot see is 404 and one they can only see is 403.

The tool finds the backlog's In Progress step by what it holds, not by its id: the step that names the in_progress status, else the step called In Progress or Doing (the default Backlog uses `doing`, the Journey Book `in-progress`). It then, in one transaction, moves the issue there, sets its status to in_progress and writes the first Log entry, `Taken by <caller>. Caps in force: <input> input, <output> output, <minutes> minutes`, with the caps as `taskmanager_task_caps_read` reports them (the issue's own, else the default). The answer is `issue` (id, code, title, status, priority, effort, tags, backlog, step), `note_id` and `caps`.

`holder` is a short agent label such as `take-up-2`, trimmed; blank or longer than 64 characters counts as no holder. `lease_minutes` is 1 to 240, default 30, and 400 outside that. With a holder the claim also records it as the assignee (`assigned_to`) and sets `lease_until`, and the answer adds `agent` and `lease_until`; the issue then shows under that holder in `taskmanager_task_board_snapshot` `agents` and as `assignee` in `taskmanager_task_stuck`, and `taskmanager_task_heartbeat` with `agent` set to the holder renews the lease. An agent that holds an issue by claim must heartbeat before the lease runs out (every 10 to 15 minutes for the default 30), or the issue is put back at To do and `taskmanager_task_stuck` lists it as `lease_expired`; sending `lease_minutes` up to 240 for a long run reduces the calls. Without a holder nothing is recorded: no assignee and no lease, and `taskmanager_task_stuck` lists the issue as `unassigned_in_progress`.

Atomic: the first statement of the transaction updates the issue only while its status is still the one the claimer read, so of two claims at once exactly one writes the move and the entry, and the other is refused 409 as already in progress and leaves no entry. An issue tagged Sinbin, Blocked or Waiting, one that waits on an open dependency, one already at the In Progress step and one that has left To do are refused 409 with the reason.

## taskmanager_task_brief

Inputs: `taskID` and optionally `log_limit` (1 to 50, default 10; another value is 400). The caller is taken from the session; an issue the caller cannot see is 404.

It replaces the five reads a worker made at the start of an issue (the issue, its caps, its Log, its todos and its dependencies with their Logs). The answer is `issue` (the whole record, description included), `caps` (exactly what `taskmanager_task_caps_read` gives), `log` (the newest `log_limit` entries, oldest first, plus every entry of kind person older than those, because a person note is an instruction), `todos` (`items`, `done`, `total`, as `taskmanager_task_todo_list_for_issue` gives them), `depends_on` (each `id`, `code`, `title`, `step`, `state`, `open` and `last_entries`, the last 3 Log entries of that issue, oldest first) and `needed_by` (each `id`, `code`, `title`, `step`, `state`, `open`). An issue in a backlog the caller cannot see is never named and its Log is never read: `hidden_depends_on` and `hidden_needed_by` count them.

The worker's start-of-run Log read is the brief's `log`. With `log_limit` 50 it holds every entry, so a run calls `taskmanager_task_brief` once and does not follow it with an unfiltered `taskmanager_task_note_list`; the Log list tool is for the entries since, called with `after` set to the id of the last entry seen (SW603).

It composes the code of its siblings and holds none of its own: the dependency sides are `taskmanager_task_dependencies`, the caps the caps reading, the Log the paged Log read and the todos the todo list.

## taskmanager_task_file_overlaps

Inputs: `taskID` and `files` (a list of paths, repeated in the query for several), at least one of them; with both, the issue's paths and the listed ones are asked together. A bad path is 400 with the same rule as `files` on create, and an unseen `taskID` is 404. The caller is taken from the session.

The answer is `items`: every issue at the In Progress step of a backlog the caller can see, status ignored, whose `files` overlap, each with `id`, `code`, `title`, `step` and `overlapping`, a list of `{asked, theirs}` pairs. Two paths overlap when they are equal, or one is a folder (trailing slash) containing the other, and both carry the same repo prefix, so `hub-steward:code/app/` overlaps `hub-steward:code/app/src/menu.go` and not `other:code/app/src/menu.go`. The issue asked about is never listed against itself, and an issue with no `files` overlaps nothing.

The In Progress step comes from the same rule as `taskmanager_task_timed_out`, across all the non-smart backlogs, and visibility from the rule the lists use: an issue in a backlog the caller cannot see is neither listed nor counted. It is read-only and holds only the overlap rule and the query; the path checks are the ones `files` uses on create.

## taskmanager_task_release

Inputs: `taskID`, `mode` (`blocked` or `sinbin`), `reason` (not blank), and optionally `todo_id` (only with `blocked`: that todo of the issue is set Blocked with the reason as its blocked reason) and `links` (a list of strings for the Log entry). The caller is taken from the session and needs Can move on the backlog the issue is in; an issue the caller cannot see is 404 and one they can only see is 403.

It replaces the four calls a worker made by hand when it could not finish (set the todo Blocked, write the note, patch the whole tag list, move to To do). In one transaction it writes the Log entry (kind worker: `Released as Blocked` or `Released as Sinbin`, then the reason, with the links), sets the tags to the issue's own tags minus Ready, Waiting, Blocked and Sinbin plus the one mark for the mode, sets the named todo Blocked, moves the issue to the To do step of its backlog and sets its status back to pending (a card's step and its status move independently, so the status is set whatever the To do step holds). Because the old marks are removed first, an issue that carried Ready and Waiting ends with only Blocked or only Sinbin, and every other tag stays. The answer is `id`, `code`, `title`, `mode`, `tags`, `backlog`, `step`, `status`, `note_id` and `todo_id`.

Refused, with nothing written: 409 unless the issue sits at the backlog's In Progress step (the step named In Progress without regard to case, or with the id doing or in-progress), whatever its status, 403 without Can move, 400 for another mode, a blank reason, a todo that belongs to another issue or a todo sent with mode `sinbin`, 404 for an issue that is unknown or unseen or a todo that is unknown.

## When Waiting clears

Nobody calls `taskmanager_task_unblock_dependents` by hand for this (SW236, SW594; the closing move itself was fixed by SW591). When an issue reaches Done or Cancelled by any way (a move to the Done, Archive or Cancelled step, `taskmanager_task_move` to a state, a patch or replace with status completed or cancelled, `taskmanager_task_batch`, the HTTP routes), the hub looks at every issue that depends on it, in the same write as the close.

| Case | Result |
|---|---|
| A dependent tagged Waiting whose `depends_on` issues are now all Done or Cancelled | Waiting is dropped, Ready is added, and one worker Log entry names the issue that finished |
| A dependent with another open dependency | Keeps Waiting, no entry |
| The last open `depends_on` edge is removed | The same as above |
| A new `depends_on` edge to an open issue | Waiting is added and Ready is dropped |
| Blocked and Sinbin | Never touched |
| Waiting on an issue with no `depends_on` edge (an owner decision) | Never dropped by this |
| The todo list of the dependent | Untouched; a todo waiting on another todo turns To do by itself when that todo is Done |

The design is in [backlog-page.md](../../2.%20design/technical-spec/backlog-app/backlog-page.md).

## Where the code is

| Part | File |
|---|---|
| The tool | `modules/taskmanager/task_find.go` |
| The place, access and tag narrowing, the word match and the compact items it shares with pending | `modules/taskmanager/task_pending.go` |
| Input and answer types | `modules/taskmanager/models/find.go` |
| Tests | `task_find_test.go` and `routes/find_tasks_test.go` |
| The next-ready tool and its types | `modules/taskmanager/task_next_ready.go`, tests in `routes/next_ready_test.go` |
| The orchestration filters | `modules/taskmanager/task_orchestration_filter.go`, `models/orchestration.go`, tests in `routes/orchestration_filters_test.go` |
| The next-ready-batch tool | `modules/taskmanager/task_next_ready_batch.go`, tests in `routes/next_ready_batch_test.go` |
| The claim-next and heartbeat tools and the lease | `modules/taskmanager/task_claim_next.go`, `task_heartbeat.go`, `task_lease.go`, tests in `routes/claim_next_test.go` |
| The board-snapshot tool | `modules/taskmanager/task_board_snapshot.go`, tests in `routes/board_snapshot_test.go` |
| The unblock-impact tool | `modules/taskmanager/task_unblock_impact.go`, tests in `routes/unblock_impact_test.go` |
| The name of an issue with no code | `modules/taskmanager/task_display_name.go`, tests in `task_display_name_test.go` |
| The lint tool and its rule table | `modules/taskmanager/task_lint.go`, tests in `routes/task_lint_test.go` |
| The stuck tool and its rule table | `modules/taskmanager/task_stuck.go`, tests in `routes/task_stuck_test.go` |
| The todo-ready-board tool | `modules/taskmanager/todo_ready_board.go`, the readiness rule in `todo_ready.go`, tests in `routes/todo_ready_board_test.go` |
| The changes-since tool | `modules/taskmanager/task_changes_since.go`, tests in `routes/changes_since_test.go` |
| The batch and create-with-todos tools | `modules/taskmanager/task_batch.go`, `task_create_with_todos.go`, the move rule in `task_move_path.go`, tests in `routes/task_batch_test.go` |
| The step WIP limit and days in step | `modules/taskmanager/backlog_step_wip.go`, the move check in `backlog.go` and `task_claim.go`, `min_days_in_step` in `task_orchestration_filter.go`, tests in `routes/step_wip_test.go` |
| The dependencies tool and its types | `modules/taskmanager/task_dependencies.go`, tests in `routes/task_dependencies_test.go` |
| The timed-out tool and its types | `modules/taskmanager/task_timed_out.go`, tests in `routes/timed_out_test.go` |
| The claim tool and its types | `modules/taskmanager/task_claim.go`, tests in `routes/claim_task_test.go` |
| The release tool and its types | `modules/taskmanager/task_release.go`, tests in `routes/release_task_test.go` |
| The brief tool and its types | `modules/taskmanager/task_brief.go`, tests in `routes/task_brief_test.go` |
| The file-overlaps tool and its types | `modules/taskmanager/task_file_overlaps.go`, tests in `routes/file_overlaps_test.go` |
