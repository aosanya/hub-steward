# Taskmanager tools that read the backlog

The taskmanager module (`code/wakala-api/modules/taskmanager`) serves its routes and MCP tools from one declared file, `taskmanager.operations.json`. A tool is named from its action, so `taskmanager.task.find` is `taskmanager_task_find`. Each action is listed under `task.read` in `modules/agency/models/permissions_catalog.json`, and each tool is on the pinned roster in `internal/api/http/testdata/mcp_roster/no-mounts.txt`.

## Which tool answers what

| Question | Tool | Route |
|---|---|---|
| What is open, and how many at each step and priority | `taskmanager_task_pending` | `GET /pending-tasks` |
| Which issue is this id, code or text | `taskmanager_task_find` | `GET /find-tasks` |
| The whole issue | `taskmanager_task_read` | `GET /tasks/{taskID}` |
| Page through every issue | `taskmanager_task_list` | `GET /tasks` |

## taskmanager_task_find

Inputs: `q` (required), `backlog` (id or name), `step` (id or name), `tag` (repeat it to require every tag), `include_closed` (default false), `limit` (default 25, at most 100) and `offset`. The caller is taken from the session.

`q` is read as one of three things:

| `q` | Matches | Order |
|---|---|---|
| A uuid | the issue with that id | one issue |
| One token of letters then digits, with or without a dash (`SW39`, `mun67`, `DEV-1`) | every issue whose code starts with it, without regard to case; an issue that only names the code in its description is not matched | the exact code first, then rank |
| Anything else | every word appears, without regard to case, in the title, the code, a tag or the description | rank |

The answer is `total`, counted over everything that matches, and `items`: the same compact items as `taskmanager_task_pending` (id, code, title, state, backlog, step, priority, tags, rank, blocked, waiting, sinbin), without the description. Only issues of backlogs the caller may see are matched, as for `taskmanager_task_pending`. A blank `q` is refused with 400 and a message that names `q`; an unknown backlog or step is also a 400.

Open issues only, unless `include_closed` is true. The in-tray sorter and the backlog workers use one find call for a duplicate check; a words search over the description is what finds a duplicate that names the same thing in other words.

## Where the code is

| Part | File |
|---|---|
| The tool | `modules/taskmanager/task_find.go` |
| The place, access and tag narrowing, the word match and the compact items it shares with pending | `modules/taskmanager/task_pending.go` |
| Input and answer types | `modules/taskmanager/models/find.go` |
| Tests | `task_find_test.go` and `routes/find_tasks_test.go` |
