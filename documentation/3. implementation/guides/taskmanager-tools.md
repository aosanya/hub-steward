# Taskmanager tools that read the backlog

The taskmanager module (`code/wakala-api/modules/taskmanager`) serves its routes and MCP tools from one declared file, `taskmanager.operations.json`. A tool is named from its action, so `taskmanager.task.find` is `taskmanager_task_find`. Each action is listed under `task.read` in `modules/agency/models/permissions_catalog.json`, and each tool is on the pinned roster in `internal/api/http/testdata/mcp_roster/no-mounts.txt`.

## Which tool answers what

| Question | Tool | Route |
|---|---|---|
| What is open, and how many at each step and priority | `taskmanager_task_pending` | `GET /pending-tasks` |
| Which issue is this id, code or text | `taskmanager_task_find` | `GET /find-tasks` |
| Which issue should a worker take next | `taskmanager_task_next_ready` | `GET /next-ready` |
| Why an issue is Waiting: what it waits on and what waits on it | `taskmanager_task_dependencies` | `GET /tasks/{taskID}/dependencies` |
| Everything a worker reads before starting an issue, in one call | `taskmanager_task_brief` | `GET /tasks/{taskID}/brief` |
| Which issues in progress touch the same files as an issue or a list of paths | `taskmanager_task_file_overlaps` | `GET /file-overlaps` |
| Which issues in progress are past their working-time cap | `taskmanager_task_timed_out` | `GET /timed-out` |
| Take an issue: move it to In Progress, write the taken entry, record the caps | `taskmanager_task_claim` | `POST /tasks/{taskID}/claim` |
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

## taskmanager_task_next_ready

Inputs: `backlog` (id or name), `tag` (repeat it to require every tag) and `limit` (1 to 5, default 1). The caller is taken from the session.

The answer is `total_ready`, every Ready issue at the To do step that the filters match, and `items`: the first `limit` of them, lowest rank first, each with id, code, title, priority, effort, tags, rank, backlog and step and without the description. An issue that carries Sinbin, Blocked or Waiting is never counted or returned, even beside Ready. With nothing ready, `items` is empty and `total_ready` is 0. A backlog the caller cannot see is refused as unknown, 400, the same as a backlog that does not exist; a limit outside 1 to 5 is also 400. A worker takes the first item and reads it with `taskmanager_task_read`.

## taskmanager_task_dependencies

Input: `taskID`. The caller is taken from the session; an issue the caller cannot see is 404.

The answer is `depends_on` (the issues this one waits on) and `needed_by` (the issues that wait on it), each a list in rank order of `id`, `code`, `title`, `step`, `state` and `open`, where `open` is true while that issue is not Done or Cancelled. `blocks_start` is true when any issue it waits on is open. An issue in a backlog the caller cannot see is not named: `hidden_depends_on` and `hidden_needed_by` count them, and a hidden open dependency still makes `blocks_start` true so a worker is not told an issue is free when it is not.

## taskmanager_task_timed_out

Input: `backlog` (id or name, required: a blank or missing one is 400, and a backlog that does not exist or that the caller cannot see is refused as unknown). The caller is taken from the session.

The answer is `items`: every issue of the backlog that sits at its In Progress step (the step named In Progress, without regard to case; the card's status is ignored) and whose time since its first worker Log entry is past its working-time cap, the issue's own or else the default 15 minutes, which is the board's Time is up measure. The hub's own automatic entries do not start the clock. An issue at that step with no worker entry at all is also listed. Each item has `id`, `code`, `title`, `minutes_since_first_entry` and `minutes_since_last_entry` (both null when there is no entry), `cap_minutes`, `clock_stopped` (as `taskmanager_task_caps_read` reports it, including the hub's idle stop) and `last_entry` (`kind`, the first 200 characters of `text`, `created_at`; null when there is none).

The tool names no cause. Whether the run was interrupted, idle or too big stays the lead's call, made from the last entry and `clock_stopped`. It moves and tags nothing.

## taskmanager_task_claim

Input: `taskID`. The caller is taken from the session and needs Can move on the backlog the issue is in; an issue the caller cannot see is 404 and one they can only see is 403.

The tool finds the backlog's In Progress step by what it holds, not by its id: the step that names the in_progress status, else the step called In Progress or Doing (the default Backlog uses `doing`, the Journey Book `in-progress`). It then, in one transaction, moves the issue there, sets its status to in_progress and writes the first Log entry, `Taken by <caller>. Caps in force: <input> input, <output> output, <minutes> minutes`, with the caps as `taskmanager_task_caps_read` reports them (the issue's own, else the default). The answer is `issue` (id, code, title, status, priority, effort, tags, backlog, step), `note_id` and `caps`.

Atomic: the first statement of the transaction updates the issue only while its status is still the one the claimer read, so of two claims at once exactly one writes the move and the entry, and the other is refused 409 as already in progress and leaves no entry. An issue tagged Sinbin, Blocked or Waiting, one that waits on an open dependency, one already at the In Progress step and one that has left To do are refused 409 with the reason.

## taskmanager_task_brief

Inputs: `taskID` and optionally `log_limit` (1 to 50, default 10; another value is 400). The caller is taken from the session; an issue the caller cannot see is 404.

It replaces the five reads a worker made at the start of an issue (the issue, its caps, its Log, its todos and its dependencies with their Logs). The answer is `issue` (the whole record, description included), `caps` (exactly what `taskmanager_task_caps_read` gives), `log` (the newest `log_limit` entries, oldest first, plus every entry of kind person older than those, because a person note is an instruction), `todos` (`items`, `done`, `total`, as `taskmanager_task_todo_list_for_issue` gives them), `depends_on` (each `id`, `code`, `title`, `step`, `state`, `open` and `last_entries`, the last 3 Log entries of that issue, oldest first) and `needed_by` (each `id`, `code`, `title`, `step`, `state`, `open`). An issue in a backlog the caller cannot see is never named and its Log is never read: `hidden_depends_on` and `hidden_needed_by` count them.

It composes the code of its siblings and holds none of its own: the dependency sides are `taskmanager_task_dependencies`, the caps the caps reading, the Log the paged Log read and the todos the todo list.

## taskmanager_task_file_overlaps

Inputs: `taskID` and `files` (a list of paths, repeated in the query for several), at least one of them; with both, the issue's paths and the listed ones are asked together. A bad path is 400 with the same rule as `files` on create, and an unseen `taskID` is 404. The caller is taken from the session.

The answer is `items`: every issue at the In Progress step of a backlog the caller can see, status ignored, whose `files` overlap, each with `id`, `code`, `title`, `step` and `overlapping`, a list of `{asked, theirs}` pairs. Two paths overlap when they are equal, or one is a folder (trailing slash) containing the other, and both carry the same repo prefix, so `hub-steward:code/app/` overlaps `hub-steward:code/app/src/menu.go` and not `other:code/app/src/menu.go`. The issue asked about is never listed against itself, and an issue with no `files` overlaps nothing.

The In Progress step comes from the same rule as `taskmanager_task_timed_out`, across all the non-smart backlogs, and visibility from the rule the lists use: an issue in a backlog the caller cannot see is neither listed nor counted. It is read-only and holds only the overlap rule and the query; the path checks are the ones `files` uses on create.

## taskmanager_task_release

Inputs: `taskID`, `mode` (`blocked` or `sinbin`), `reason` (not blank), and optionally `todo_id` (only with `blocked`: that todo of the issue is set Blocked with the reason as its blocked reason) and `links` (a list of strings for the Log entry). The caller is taken from the session and needs Can move on the backlog the issue is in; an issue the caller cannot see is 404 and one they can only see is 403.

It replaces the four calls a worker made by hand when it could not finish (set the todo Blocked, write the note, patch the whole tag list, move to To do). In one transaction it writes the Log entry (kind worker: `Released as Blocked` or `Released as Sinbin`, then the reason, with the links), sets the tags to the issue's own tags minus Ready, Waiting, Blocked and Sinbin plus the one mark for the mode, sets the named todo Blocked, moves the issue to the To do step of its backlog and sets its status back to pending (a card's step and its status move independently, so the status is set whatever the To do step holds). Because the old marks are removed first, an issue that carried Ready and Waiting ends with only Blocked or only Sinbin, and every other tag stays. The answer is `id`, `code`, `title`, `mode`, `tags`, `backlog`, `step`, `status`, `note_id` and `todo_id`.

Refused, with nothing written: 409 unless the issue sits at the backlog's In Progress step (the step named In Progress without regard to case, or with the id doing or in-progress), whatever its status, 403 without Can move, 400 for another mode, a blank reason, a todo that belongs to another issue or a todo sent with mode `sinbin`, 404 for an issue that is unknown or unseen or a todo that is unknown.

## Where the code is

| Part | File |
|---|---|
| The tool | `modules/taskmanager/task_find.go` |
| The place, access and tag narrowing, the word match and the compact items it shares with pending | `modules/taskmanager/task_pending.go` |
| Input and answer types | `modules/taskmanager/models/find.go` |
| Tests | `task_find_test.go` and `routes/find_tasks_test.go` |
| The next-ready tool and its types | `modules/taskmanager/task_next_ready.go`, tests in `routes/next_ready_test.go` |
| The dependencies tool and its types | `modules/taskmanager/task_dependencies.go`, tests in `routes/task_dependencies_test.go` |
| The timed-out tool and its types | `modules/taskmanager/task_timed_out.go`, tests in `routes/timed_out_test.go` |
| The claim tool and its types | `modules/taskmanager/task_claim.go`, tests in `routes/claim_task_test.go` |
| The release tool and its types | `modules/taskmanager/task_release.go`, tests in `routes/release_task_test.go` |
| The brief tool and its types | `modules/taskmanager/task_brief.go`, tests in `routes/task_brief_test.go` |
| The file-overlaps tool and its types | `modules/taskmanager/task_file_overlaps.go`, tests in `routes/file_overlaps_test.go` |
