# Taskmanager tools that read the backlog

The taskmanager module (`code/wakala-api/modules/taskmanager`) serves its routes and MCP tools from one declared file, `taskmanager.operations.json`. A tool is named from its action, so `taskmanager.task.find` is `taskmanager_task_find`. Each action is listed under `task.read` in `modules/agency/models/permissions_catalog.json`, and each tool is on the pinned roster in `internal/api/http/testdata/mcp_roster/no-mounts.txt`.

## Which tool answers what

| Question | Tool | Route |
|---|---|---|
| What is open, and how many at each step and priority | `taskmanager_task_pending` | `GET /pending-tasks` |
| Which issue is this id, code or text | `taskmanager_task_find` | `GET /find-tasks` |
| Which issue should a worker take next | `taskmanager_task_next_ready` | `GET /next-ready` |
| Why an issue is Waiting: what it waits on and what waits on it | `taskmanager_task_dependencies` | `GET /tasks/{taskID}/dependencies` |
| Which issues in progress are past their working-time cap | `taskmanager_task_timed_out` | `GET /timed-out` |
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
