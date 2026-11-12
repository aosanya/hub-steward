# Load journey

How the boards become issues, from the owner's side. Built from
[decisions.md](../../../../../hub-steward-swe/documentation/1.%20requirements/decisions.md); sorting as a run with an approval was
removed (D49).

## The cast

| Role | Who | Does | Decision |
|---|---|---|---|
| Product owner | Person | Runs the loader in a terminal on their laptop, then browses and works the list in Chat | D7, D49, D71 |
| Loading script | Program on the owner's machine | Reads the boards, folds mirrors, links dependencies, ranks, marks, takes the area from the repo | D28, D36, D37 |
| *Triager* | AI | Answers in Chat and uses the task tools: lists, opens, moves | D6, D49 |

## The stages

| # | Stage | Who | Result |
|---|---|---|---|
| 1 | Gather | Script | Every open row from every board, as an issue with its repo (also its area), id, priority, status and source file |
| 2 | Match | Script | Mirrored rows folded into one issue (D29); identical titles listed as duplicates |
| 3 | Link | Script | A `depends_on` link for each dependency (D31); done rows only clear a dependency (D30) |
| 4 | Order | Script | The priority order (D32, D34) and a Ready or Blocked mark (D33) |

There is no approval step: the loaded issues are the backlog, and the owner
changes them in Chat.

## Rules a mark follows

| Mark | When |
|---|---|
| Ready | Status 📋 and every row it depends on is done, and no open question blocks it |
| Blocked | Status ⏸️, or it depends on a row that is not done |

The ready rule is the one the boards already state in their own headers.

## Where items live and where you see them

Each item is a task in the hub's `taskmanager` module (D11):

| Board row | Task field |
|---|---|
| Task text | `title`, with the Notes in `description` |
| Status 📋 🚀 ⏸️ | `status` pending, in_progress, blocked |
| Pri | `priority` (D32) |
| Repo (also the area) | `tags` and `project_name` (D37) |
| Depends on | a `depends_on` link between two tasks (D31) |
| Order in the list | `rank` |
| Board file and row | `linked_ref` |

The owner works with them in Chat through MCP tools
([chat-and-mcp.md](chat-and-mcp.md)); the list is the screen the chat opens
([mockups](../../mockups/app/index.html)). No board in any other repo is changed.
