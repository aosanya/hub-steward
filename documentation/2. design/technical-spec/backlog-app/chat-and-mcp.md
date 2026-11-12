# The backlog in Chat

Every use of the backlog is a conversation in the Chat tab (D23). The roles
answer from MCP tools. The look of each reply is in
[chat-replies.md](chat-replies.md) and drawn in
[mockups](../../mockups/app/chat-replies.html); the screens they open are drawn in
[backlog-page.md](backlog-page.md). Whether a tool exists is read from the task
module's operations (`taskmanager.operations.json`); its tools are generated
from every operation in that file, so each existing operation is already a
tool. Every gap is a row on the [board](../../../../../hub-steward-swe/documentation/3.%20implementation/todo.md).

## What the owner says

The operation column names the operation keys of `taskmanager.operations.json`.
The test in `loader/agencycheck` reads this table: every row whose Exists cell
starts with Yes must have its operations declared, covered by a permission in
the hub's catalog and held by the Triager, and the Triager's description in
`agency/agency.json` must name each tool. A row that starts with No or Partly
is listed as a known gap.

| The owner says | The roles do | Task module operation | Exists |
|---|---|---|---|
| "Load the boards" | Say it is not done in Chat: the loader runs in a terminal on the owner's laptop, and point to `documentation/3. implementation/loader.md` (D71) | none | No; not in Chat, D71 |
| "Show the Software board" | Reply with a card and an Open button that opens that backlog's board (D51, D60) | `list_tasks`, `list_backlogs` | Yes; the card is SW27 |
| "Show all issues" | Reply with a card and an Open button that opens the list of all issues (D40, D60) | `list_tasks` | Yes; the card is SW27 |
| "shoe" (a bare word or phrase, "show me stuff", anything that could be a tag, a repo, a title word or an issue code) | Ask one short clarifying question before any tool is called, with each reading as an option button (never a text list); once a reading is chosen make one call, for a word one `pending_tasks` call with `q`; say so in one sentence when nothing matches, with no empty list (D88) | `pending_tasks` | Yes; `q` |
| "What is pending?" / "which issues are left?" / "what git issues are open?" | Call the pending tool first: it answers with the counts by step and by priority and the top issues in one call, compact and without descriptions, then say the counts in a sentence; page the full list only when the owner asks for more (D87) | `pending_tasks` | Yes; `tag`, `q`, `backlog`, `step`, `priority`, `limit` and `offset` |
| "Show issues untouched for 30 days" | The same card, narrowed by age | `list_tasks` | Yes; `untouched_days` |
| "Show mwanachama-web and Blocked" | The same card narrowed to both | `list_tasks` | Yes; `repo` and `tag` |
| "Open 2" | Reply with the title, the description, and a button for each issue it waits on (D41, D42) | `get_task`, `traverse_relationships` | Yes |
| "Show the backlogs" | Reply with one button for each backlog the person can see; a button opens that backlog's board (D60) | `list_backlogs` | Yes |
| "Let Contributors see Documentation" / "let Contributors move issues in Software" | Give the group that access to the backlog and say so; a group that already has access changes level (D54, D69) | `give_backlog_access`, `list_backlog_access` | Yes |
| "Remove access to Documentation for Contributors" / "who can see Documentation?" | Take it away and say so, or list the groups and what each may do; the Product owner group's access cannot be taken away (D54, D69) | `take_backlog_access`, `list_backlog_access` | Yes |
| "Add a step called Review after In Progress in Software" | Add it and say the new order of the backlog's steps | `list_backlogs`, `add_backlog_step` | Yes |
| "Add a backlog called Support with the steps New, Answering, Closed" | Add it and say it is seen only by the Product owner group (D69) | `create_backlog` | Yes |
| "Make a smart backlog of ready issues at To do" | Read the rules back with the count and offer Create and Edit rules as option buttons; nothing is made until Create; the backlog has no steps | `count_backlog_rules`, `create_backlog` | Yes |
| "Show Ready to start" | Reply with a card with the count and an Open button, as for any backlog | `list_backlogs` | Yes |
| "Change Ready to start to the last 14 days" | Change that one rule and answer in one line with the new count | `list_backlogs`, `set_backlog_rules`, `count_backlog_rules` | Yes |
| "Rename / reorder / remove a step, rename or delete a backlog" | Do it; a step that holds issues cannot be removed and a backlog that holds issues cannot be deleted (D25, D59) | `rename_backlog_step`, `reorder_backlog_steps`, `remove_backlog_step`, `rename_backlog`, `delete_backlog` | Yes |
| "Move 2 to In Progress" / "move 4 to Software" | Put the issue at that step, or in that backlog at its first step (D58) | `move_task_to_step`, `list_backlogs` | Yes |

An issue is pointed at by its number in the current list (D41). Choosing
between several named issues follows the app's rule for chat: the roles offer
clickable option buttons rather than asking the owner to retype a name. A bare
"move the import" for something just discussed means that issue.

## Group roles

A group reaches the Backlogs only through an agency role that holds `task.read`
(D76). These tools belong to the agency module, not the task module, so they
are not rows of the table above and `agencycheck` does not read them. The
names and arguments are the hub's (`group_role_routes.go`).

| Ask | Tool and arguments | Who can ask |
|---|---|---|
| "Give Contributors the Backlog member role" | `agency_give_group_role` with `instance_id`, `group_id`, `agency_role_id`; giving a role the group already holds changes nothing | The owner only |
| "Take the role away from Contributors" | `agency_take_group_role`, the same three arguments; the members lose the role's permissions at once | The owner only |
| "Which roles do the groups hold?" | `agency_list_group_roles` with `instance_id` and optionally `group_id`; each item has the group, the role's id, name and code | The owner only |

The Triager cannot call them. The hub lets an agent seated in the agency
through to the task tools its role holds, but these three answer an agent with
403 and anyone who is not in the agency with 404. The Triager's description in
`agency/agency.json` therefore does not name them, and when the owner asks the
Triager to give a group a role, it says that the owner does it, or that giving
the group access to a backlog gives the matching role in the same step.

Giving and taking backlog access (`give_backlog_access`, `take_backlog_access`)
also set the group's role (D79). The group holds Backlog member when its
highest level over all backlogs is Can see, Backlog worker when it is Can move,
and neither once its last access is taken away or its last backlog is deleted;
the Product owner group is left alone, and roles the owner gave by hand are not
touched. When the published agency has no role with the code `backlog_member`
or `backlog_worker`, the access is still given and no role follows.

`list_backlog_access` marks each group with the roles it holds (`roles`), `no_role`
when it holds none that can read, and `role_too_small` when it has Can move but
its roles cannot edit (D81). A group with Can move and a read-only role can
look at the backlog but is refused when it writes.

## What this leaves out

Sorting as a run with approval, counts and send back (D49),
a Move button and swipe. Managing backlogs on screens is in the app too (D59, [manage-backlogs.html](../../mockups/app/manage-backlogs.html)).
