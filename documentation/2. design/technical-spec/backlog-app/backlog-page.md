# Backlogs, boards and lists

The bottom bar is Home, Chat and Notifications on every screen; there is no Do Something button and no second bar (D155, which changed D154, D60 and D66). The Notifications button is a bell and carries the unread count (D155, which replaced D78). The app opens on the Home screen, which holds only the options Start, Ongoing and Backlogs, as option rows. The notifications, the invitations, the waiting steps, Mark all read and the "You are all caught up" card are on their own page, Notifications. A screen opened from an option keeps the Home, Chat and Notifications bar with none chosen, and Home is the way back. Start and Ongoing hold the workflow steps for the person
to do, which load as the app already does, and Backlogs holds the backlogs to browse. The Backlogs screen has an All issues row, which opens the list
of every issue the person can see, and a row for each backlog they can see, which
opens that backlog's Kanban board. Each row carries small grey bubbles with its issues in each step, the five most populous steps first and none for a step with no issues, for example To do 1301, In Progress 81, Done 4 (D120, [drawn](../../mockups/app/smart-backlogs.html#s1)). All issues adds the steps of the backlogs up by name; a smart backlog shows the hub's own count for each step, Done and Cancelled included (D125), asked of the pending list with `include_closed`. The Backlogs option shows only when the task module is
on. A board has a List | Board switch to the backlog's list and a Backlog link to
the backlog's page. Everything else is done in Chat (D23, see
[chat-and-mcp.md](chat-and-mcp.md)); a chat card ("show all issues", "show the
Software board") has an Open button that opens the same screen, and "show the
backlogs" gives one button for each backlog. The list has no chat box (D48).

All issues and a smart backlog have the same List | Board switch under the count, and open on Board. Their columns are the steps of the backlogs their issues live in, in the order of those backlogs, and an issue whose step is in none of them goes in an Unplaced column. The choice is kept in the address as `view=list`, so a list can be linked to.

This is a drawing for the owner to change, drawn as
[mockups](../../mockups/app/index.html). The screens use the app's shell: a sticky top
bar with a back arrow and the bottom tab bar. Task rows on the
[board](../../../../../hub-steward-swe/documentation/3.%20implementation/todo.md): SW8, SW30, SW31, SW34.

## The list (SW9, D13)

The screen opens on one list of tasks in priority order. There is no filter bar
and no counts above it.

```text
+------------------------------------+
| < Backlog                          |
+------------------------------------+
| 1  Fix mirrored board drift        |
|    [Ready] [mwanachama-web] |
| 2  Import the municipality         |
|    [Blocked] [hub-steward]|
| 3  Record the voice clips          |
|    [Ready] [community-hubs]|
| ...                                |
+------------------------------------+
```

In Chat, the card that opens it:

```text
| You: show all issues              |
| +--------------------------------+ |
| | Backlog: 83 issues             | |
| | [Open]                         | |
| +--------------------------------+ |
```

Tapping a tag filters the list to tasks with that tag. The chosen tags show
as chips under the title, each with a cross to clear it.

```text
| Backlog                            |
| [Docs x] [Blocked x]               |
| 4  Mirror the story boards         |
|    [Blocked] [mwanachama-git]|
```

| On a row | Comes from | Decision |
|---|---|---|
| Number | the task's `rank` | D11 |
| Title | the task's `title` | D11 |
| Mark tag: Ready, Waiting or Blocked | Ready and Blocked are set by the loading script and by hand; Waiting (light amber-orange) is an open dependency and Blocked (red) a problem a person must look at, never both, neither Ready; each is the tag only (D101, D142) | D8, D13, D101, D142 |
| Repo tag (also the area) | the task's `project_name` | D11, D13, D37 |

The hub orders the list and the screens show it as given. Every step is in rank order except Done: the issues in the Done step are ordered by the time they were moved to Done, the most recent first, and an issue that returns to Done is placed by its latest completion. The order belongs to the hub's list (`taskmanager_task_list`), so the board column, the list and the phone app agree; there is no sort control and no setting (SW218).

The priority is shown as a tag after the repo (D139). Tapping a tag twice, or its cross, clears it.
Tags chosen together narrow the list (Docs and Blocked is both).

## One task opened (SW10, D14)

Tapping a row opens the task on its own screen, one step in from the list: the title, the description,
and what it waits on. Each task it waits on is a row with its title; tapping
it opens that task.

```text
+------------------------------------+
| < Import the municipality          |
+------------------------------------+
| Load the English template into the |
| local database and check that all  |
| 46 workflows are listed.           |
|                                    |
| Waits on                           |
| +--------------------------------+ |
| | Switch on the custody module > | |
| | Fix the import route         > | |
| +--------------------------------+ |
+------------------------------------+
```

Each row of the Waits on card, and of the Waited on by card, carries the issue's current step as a bubble beside its repo and priority bubbles: To do, In Progress, Done or Cancelled. A finished dependency reads Done, so the owner sees at once why it no longer holds the issue. The bubble is the shared tag bubble coloured from the step's name by the same rule as the board's step names, and the step comes from the issue read that already fills the row, not from a call per row. Drawn in [issue-waits-on.html](../../mockups/app/issue-waits-on.html) (SW248).

A task that waits on nothing has no Waits on section. Where the task came
from, where else it appears and why it is ranked are not shown (D14); the
repo is already a tag on the list. They are the task's `depends_on` links (D31).

## The Log on an issue (D109 to D113, built)

An issue's page gains a Log section under the description: a running list of dated entries, oldest first with the newest last, nothing overwritten or removed. Drawn in [issue-log.html](../../mockups/app/issue-log.html) as a Log with four entries and as an empty Log. The Log is there so that a worker whose session is cut off can be followed by the next one, and so that a person who is about to pick an issue, or who reviews a In Progress or Done issue, can see what was tried and what was done.

```text
+------------------------------------+
| Log                              v |
+------------------------------------+
| Backlog worker  [Worker]  10 Nov   |
| Took the issue and moved it to     |
| In Progress.                       |
+------------------------------------+
| Backlog worker  [Worker]  10 Nov   |
| Fixed the importer. ...            |
| [commit 3f9a1c2] [CI run 481]      |
+------------------------------------+
| Owner  [Person]  11 Nov            |
| Checked the list on a phone.       |
+------------------------------------+
| Add a note                         |
| [Add]                              |
+------------------------------------+
```

| Part | What it is |
|---|---|
| Entry | The writer's name, a Worker or Person chip, the date and time, then the text, a line or a longer write-up; links to the work (a commit, a file, a drawing, a CI run) are pills under the text |
| Order | Oldest first, newest last, so the box to add a note is under the latest entry |
| Add a note | A text box and an Add button at the bottom of the Log, used by anyone who can see the issue, a person (a review comment) or a worker; Add is off until something is typed |
| Empty | "Nothing logged yet." above the same box |
| Not changed | The issue's row on the lists and its card on the board show nothing new; there is no Description \| Log switch and no latest line on the card |

A worker writes an entry at each step it finishes (D112). The task module serves the Log through two tools, `taskmanager_task_note_list` (the issue id; oldest first) and `taskmanager_task_note_add` (the issue id, the text, a list of links and a kind, person or worker, person when left out); the hub sets the writer from the session and the time, and both copies of the module carry them (D70). A link is a web address, or a label then a web address (`commit 3f9a1c2 https://...`) which the app shows as a tappable pill under the label; a link without a web address, such as a file path, shows as a pill that is not tappable. The backlog-worker skill writes an entry at each step it finishes.

The add-a-note box shows for anyone who can see the issue, a read-only Backlog member such as tester11 included; no access level is added for it (D113).

## References on an issue (built; D115 to D118 proposed, not yet agreed by the owner)

An issue's page gains a References section under the description and above the Log: what the issue is talking about. Drawn in [issue-references.html](../../mockups/app/issue-references.html) with seven entries, an empty section, and the five pages of adding one. The References, Log and Caps cards always load collapsed (chevron to the right), whatever the owner did on the last issue or the last visit; opening one lasts for that visit only, and nothing remembers it across issues, reloads or sessions. The Waits on and Waited on by cards keep opening when they have rows (SW251). The Log says what was done; References says what it was done to, so the two sit together under the description with References first. Today an issue carries only its repo as a tag.

```text
+------------------------------------+
| References                       v |
+------------------------------------+
| app/src/backlogs/IssuePage.tsx   x |
| hub-steward . File                 |
| [Person]                           |
+------------------------------------+
| loader/importer.go               x |
| hub-steward-swe . File             |
| [Assistant proposed]               |
| [Confirm]                          |
+------------------------------------+
| old-page.md (struck through)     x |
| [Person] [Not found]               |
+------------------------------------+
| [Add a reference]                  |
+------------------------------------+
```

| Part | What it is |
|---|---|
| Entry | One row: what it points at (a path, an issue number and title, a tool or screen name, a URL), then its kind and, for a file or folder, its repo, then a mark and a cross to remove it; tapping the row opens the thing: a file or folder in its repo, a board row as that issue, a link in the browser |
| Kinds | File first, then folder, board row, screen or tool, website link |
| Mark | Person (someone added it) or Assistant proposed; an assistant's entry nobody has confirmed carries a Confirm button until a person confirms or removes it, and afterwards keeps its mark and shows Confirmed |
| Not found | A file or folder no longer on the repo's main branch is struck through and marked Not found; someone removes it and adds the right one; it is worked out when the page is shown (D116) |
| Add a reference | A page that asks the kind; for a file or folder the repos of the catalog with a find box, then the repo's tree one folder at a time, a tap on a file adding it and Use this folder adding the folder; for a board row, a screen or tool and a link one typed or pasted line |
| Empty | "Nothing referenced yet." above the same button; every existing issue starts empty and the loader adds nothing |
| Not changed | The issue's row on the lists and its card on the board show nothing new; there is no commit or line range on an entry |

Settled by the owner on 2026-11-10: the thing named is abstract and has a kind; the kinds above; a person and the assistant both name entries, a person confirms or removes them and each shows who named it; a file or folder holds the repo and the path on the main branch only; every repo in the catalog is offered, with no attach step and no settings page; existing issues start empty. Proposed here and open: the storage as its own records (D115), Not found worked out on display (D116), the picker (D117) and the assistant's propose tool (D118).

The tools are `taskmanager_task_reference_list`, `_add`, `_remove`, `_propose` and `_confirm`, all built. The picker also needs a list of the catalog's repositories and each repo's main branch; the git module has no such tool (hub issue f5f66f7d, `forms_git_repository_list`). Until it exists the Add a reference page takes the repo typed in the find box, and when the tree cannot be read it asks for the path typed (a message says the tree could not be read); the Not found check marks nothing. In a Folder pick the tree lists folders only. Not built: tapping a file or folder entry does not open it (there is no file viewer in the app); a board row opens by looking its number up, and a link opens in the browser.

## Worker caps and the Sinbin tag (D126 to D135, D144 to D147)

A worker that passes a cap leaves its issue in To do tagged Sinbin, a mark beside Waiting and Blocked and not a step; the issue page gains a Caps card under References and above the Log, and the card turns red as the nearest cap fills. Written in [worker-caps.md](worker-caps.md), drawn in [worker-caps.html](../../mockups/app/worker-caps.html).

## The board (SW30, D51, D58, D60)

A backlog's issues laid out by step. The board is opened from the backlog's row in
the Backlogs screen. One column for each step of the backlog in its order (To do,
In Progress, Review, Testing, Done, Cancelled for the six-step Software backlog;
Draft, Writing, Review, Published, Dropped for the five-step Documentation
backlog), one card for each issue with its number, title, mark and repo, and the
columns scroll sideways with the next one peeking in. The top bar holds only a
back arrow (no label), Select for a person who may move issues, a Backlog link that
opens the backlog's page, and the menu; the backlog's name is the headline under the
bar, so a long name wraps and never crowds the buttons (SW117, SW125). A List | Board
switch under the headline flips to this backlog's list. Tapping a tag filters every column at once, and a column with
nothing left says "Nothing here". The chat opens it from a card ("show the
Software board", then Open). Moving a card stays in Chat ("move 2 to In Progress");
dragging is not drawn. Drawn in [kanban.html](../../mockups/app/kanban.html).

## A backlog's page (SW31, D53, D58, D60)

Opened by the Backlog link on a board: the backlog's steps in order with how many
issues each holds, and, for a person who may manage backlogs, the groups with access and their level; a worker or member sees the steps and counts only (D76). There is no
page listing the backlogs; the Backlogs screen is that list. Drawn in
[backlog.html](../../mockups/app/backlog.html).

## Access to a backlog (SW32, D54)

A group has access to a backlog as a whole, at one level: Can see, or Can move
(which includes Can see). A person sees only the backlogs, and the issues in
them, that one of their groups can see, so a Contributor's Backlogs screen lists only the backlogs of their groups, and All issues counts only those. The Product owner group always has Can
move, and a new backlog starts with that group only (Q13). Access can be
given and taken away in Chat ("let Contributors see Documentation") or on the
access screen (D59). The group names in the drawings are made up.

## Managing backlogs in the app (SW34, D59)

A role that holds the permission to manage backlogs sees more on the same
pages: an Add a backlog button under the list on the Backlogs screen, an Edit link on a backlog's
page, and its access screen. A role without it sees none of these.

| Screen | What it does |
|---|---|
| Add a backlog | A name and its steps in order, each step movable up or down or removable before the backlog is created; no limit on backlogs or steps; a new backlog is seen only by the Product owner group |
| Edit a backlog | Rename the backlog, move its steps up or down, add a step, remove a step, delete the backlog; a step that holds issues has its remove button off and says how many it holds, and a backlog that holds issues cannot be deleted |
| Access to a backlog | One row for each group with No access, Can see or Can move; Add a group lists the groups with none yet; a change is saved when a level is chosen |

Drawn in [manage-backlogs.html](../../mockups/app/manage-backlogs.html).

Saving an edited backlog makes one call for each change, in a safe order: rename the backlog, remove the old steps, rename the kept steps, add the new steps, then put the steps in order. The one-call replace is not used, because it would overwrite the list of someone editing at the same time. The hub refuses two steps with the same name and a backlog with no steps, so: a step removed and added again under the same name is kept as it is; renames run so that no name is used twice (B to C before A to B); two steps that swap names are refused before anything is sent, and the person is told to rename one first; and when every step is replaced, the new steps are added before the old ones are removed, so the backlog never has no steps. A step is renamed from its pencil button, which opens a field for the new name. If a call is refused, the screen says which change failed and what was already saved, and the person can save again. Deleting asks first ("Delete Support?" with Delete and Cancel).

## Smart backlogs and sending

A second kind of backlog fills itself from rules, and issues can be selected and sent to a backlog with steps. Written in [smart-backlogs.md](smart-backlogs.md), drawn in [smart-backlogs.html](../../mockups/app/smart-backlogs.html); decided as D90 to D100, which include a Can edit access level (D96).

## The age of an issue (D124)

Every issue card on a board, every issue row in a list and the issue's page end
the tag line with a plain grey bubble that says how long the issue has waited. It
is the app's Chip in its one neutral style, not coloured from its text, and it
shares the tag line, so a card or a row on a phone is no taller. It is not a
filter. Drawn in [kanban.html](../../mockups/app/kanban.html), [lists.html](../../mockups/app/lists.html)
and [wide.html](../../mockups/app/wide.html) 7.

| Case | Reads | Hover or tap text |
|---|---|---|
| Open issue, under one hour old | minutes: "1 min", "59 min" | "Created Wed 11 Nov 2026, 11:01" |
| Open issue, one hour old or more, under one day | hours, rounded down: "1 h", "5 h", "23 h" | "Created Wed 11 Nov 2026, 06:13" |
| Open issue, one day old or more | days: "1 day", "3 days", "120 days" | "Created Tue 10 Nov 2026, 11:00" |
| Done or Cancelled issue | how long it took, created to finished, in the same units | "Created Mon 9 Nov 2026, 09:12, finished Wed 11 Nov 2026, 14:40" |
| Under a minute, or a created_at in the future | "1 min" | the exact time as the hub gave it |
| No created_at, or a closed issue with no completed_at | no bubble | none |

The age counts from created_at. The hub does not record when an issue entered its
step, so an age since the step change is not offered. The first drawing read only
minutes and days; the owner asked for hours after seeing "723 min" on a card
(D124). The thresholds are in `ageOf` in `app/src/ui/age.ts`. The unit words are in
the app's language words, so Swahili and Magyar read them too.

## The empty screen (SW14)

Before the boards have been loaded there is nothing to list. Following the app's
rule that an empty state is a card with the button inside it:

```text
+------------------------------------+
| Backlog                            |
| +--------------------------------+ |
| | No backlog yet                 | |
| | Run the loader on your laptop | |
| +--------------------------------+ |
+------------------------------------+
```

The card shows for a person who may manage backlogs, and only while no backlog holds an issue. The backlogs a person can see are always listed, empty or not, so a backlog shared with a group that holds no issues yet shows as a row (SW123). Opened, an empty list says "Nothing here yet." to a person who cannot manage backlogs, and to a manager too unless no backlog holds an issue anywhere, when it is the loader card (SW152). After Send to backlog from an opened issue, the same one line as on the list ("1 issue sent to Documentation") stays above the issue until the person leaves (SW151).

## Steps on a row (SW16, D19 to D22, D58)

On the list a row can show the backlog it belongs to and the step it sits at as
tags, so tapping one filters, as for the other tags (D13). The backlog tag is
shown on every row; the step tag is drawn on one variant only and is not yet
confirmed.

## The priority of an issue (D139, D140, SW215; moved to the chip row by D152)

Mockup: [issue-priority.html](../../mockups/app/issue-priority.html).

The issue's card has one button: the priority, at the right end of the card's top
row, which is the card's header (the Bulma card shape: header with the title and
one button, body, no footer). Its label is the current priority; tapping it opens
the four values, critical, high, medium and low, with the current one marked, and
choosing one writes it at once. There is no Save and no row of buttons under the
card. A person without Can move on the backlog sees the priority as a tag and no
button. If the hub refuses, the page says "The priority was not changed" and the
button keeps its value.

The board card and the list row show the priority as a plain tag after the repo,
the same tag on both because they are the one shared row. It is not a filter.

The change goes through `taskmanager_task_patch` (the priority field). The hub
puts the issue at the top of its new priority group within its step and adds a Log
entry, "Priority medium to high", written for the person who made the change. The
tie rule (a second critical issue goes above the first) is proposed, not yet agreed
by the owner. Built in the console as the shared `IssueRow` taking an action at its
right end, filled with the shared `ActionsMenu`; the Caps, References and Log cards
use the shared `Card` with a collapsible header and are not changed by this.

## The priority and the effort of an issue (D139, D152, SW380, SW383, SW386)

Every issue carries an estimated effort: very low, low, medium, high, very high, or
unknown, which is what an issue is until someone says otherwise. It is entered when
the issue is filed (`taskmanager_task_create`, field `effort`) and changed later
with `taskmanager_task_patch`; the hub stores it beside the priority and the
estimated hours, and refuses any other word.

Both the priority and the effort are pills in the chip row at the bottom of the
card, with the tags and the age, never in the header: the header holds only the
issue code, because pills beside the code crowd a phone-width header and wrap it
(MUN344 broke into MUN34 and 4). Each pill is the same rounded menu, drawn by the
shared `ChoiceMenu`, and reads "Priority: Medium" and "Effort: Medium", the label,
a colon and the capitalised value, then the arrow. An unset effort reads "Effort:
Unknown". The pills take the chips' own font size (rem) and a tight padding so both
fit on one line beside the age chip. Tapping one opens its values, capitalised the
same way (Critical, High, Medium, Low; Very low, Low, Medium, High, Very high,
Unknown), with the current one marked, and choosing one writes it at once. A person
without Can move on the backlog sees the same text as a plain chip. If the hub
refuses, the card says "The priority was not changed" or "The effort was not
changed". The pills are on the issue page, the list row, the board card and the
smart-backlog row.

An issue in Done shows its priority as the same plain chip, with no arrow and no
menu, on the issue page, the list row, the board card and the Waits on and Waited
on by rows alike: the one shared `IssuePills` draws the menu only while the issue
is not completed, and the card returns to a menu if the issue is ever back in an
open step. The hub enforces it too: `taskmanager_task_patch` (and a `taskmanager_task_update`
that sends a different priority) for an issue in Done is refused with 409 and "the
priority of an issue in Done cannot be changed", so the board, the MCP tools and the
app cannot do it; a patch that leaves the priority alone still goes through.

The menu opens to the right of the pill and over the card below,
so the card does not clip it.

There is no new-issue form in the phone app yet; issues are filed through the hub,
where the field is sent with the rest.

## The card (D149, SW257)

Mockup: [card.html](../../mockups/app/card.html).

Every card on every screen is the one shared `Card`, in the Bulma shape
(https://bulma.io/documentation/components/card/): a header with the title at the
left in bold and at most one control at the right, a thin rule under it, the
content with the card's padding, and an optional footer, one soft shadow around
the whole. The control in the header is the chevron on a card that collapses
(whole header is the tap target, the rule goes when it is shut) or a button on a
card that acts. The footer is a row of equal text actions separated by thin
rules, and a card has none unless it has actions.

| Card | Header | Content | Footer |
|---|---|---|---|
| The issue | the code | title, tags, the priority and effort pills, description | none |
| References, Caps, Log | name, chevron (shut at first) | their rows | none |
| Waits on, Waited on by | name, chevron | rows edge to edge | none |
| Source | name, chevron | the source lines | none |
| A backlog in the chat | the backlog's name | its count | Open |
| A group's access | the group's name, the take-away button | its level | none |
| A board card | none | the shared issue row | none |
| A form or cards in the assistant thread | the title | lines or fields | the buttons or the submit |

Built in the phone app as `app/src/ui/Card.tsx` (`title` takes any node, `action`
is the header control, `footer` the footer) and in the designer console as
`console/src/ui/Card.tsx` (`actions`, `footer`), whose chat message cards all go
through it. The issue page's top row is no longer a static `IssueRow`; the
shared row now only draws rows. The board card and the chat card that had a
class of their own are gone.

## Todo list of an issue (D159, TDL-1)

Mockup: [issue-todos.html](../../mockups/app/issue-todos.html).

An issue holds a todo list: its work cut into smaller pieces, each of which can wait on other pieces, so the list is a dependency tree. Issues keep the steps they have today; the list sits inside an issue and adds no step.

Where it is: the left card of the issue page, under the description. The board card shows a pill such as 2 of 6, the pieces Done out of all pieces, and no pill for an issue with no pieces.

| Status | Means | The API's status |
|---|---|---|
| To do | Nothing it waits on is open, and nobody has started it | `pending` |
| In progress | Someone is working on it | `dispatched` |
| Done | Finished | `completed` |
| Blocked | It waits on a piece that is not Done, or a person marked it | `blocked`, and `failed` shows as Blocked (D159, my choice, needs the owner's word) |

How Blocked works:

- A piece is Blocked by itself while a piece it waits on is not Done, and turns To do when all of them are Done.
- Anyone can also mark a piece Blocked by hand. The reason is written when they do, and shows under the piece.
- Not yet settled by the owner (my choices): a piece Blocked by hand stays Blocked when the pieces it waits on are Done, until a person lifts it, and lifting it clears the reason.

What a person can do: add a piece, rename it, reorder it, delete it, and set what it waits on. A change that would make a cycle, or make a piece wait on a piece of another issue, is refused, and the card says so.

Who writes the list: when an agent picks up an issue that has no pieces, it writes the list first, then works the pieces in order, and sets each one's status as it goes. A person can change what the agent wrote.

Written at creation (D160, in the decisions of hub-steward-swe): whoever creates an issue, a person or a skill, writes its todos then, in the order they are done, each with what it waits on.
The last todo is documentation, short and in place, and the issue is not Done until it is.

Moving to Review: when the last piece is Done, an issue that is In progress moves to Review by itself. An issue in any other step does not move. If the issue's backlog has no Review step, nothing moves.

What exists today in the taskmanager, and what is new:

| Today | New |
|---|---|
| A todo has a status (`pending`, `dispatched`, `completed`, `blocked`, `failed`), `depends_on` and `parent_task_id` | Listing the todos of an issue |
| Todos are listed only by workflow run (`taskmanager_task_todo_list`) | Edit, reorder and delete |
| A todo can be created, read, dispatched and given a status | Refusing a cycle or a piece of another issue |
| There is no edit and no delete | Blocked by itself and back to To do, the written reason, the move to Review, the count for the pill |

The store (TDL-9). The `task_todo` table of the taskmanager holds one row per piece; its fields are declared in `taskmanager.blueprint.json`:

| Field | Holds |
|---|---|
| `parent_task_id` | The issue the piece belongs to; indexed, so one issue's list is one query, read in `ordinality` order |
| `ordinality` | The 1-based position in the list; a reorder renumbers it from 1, and a piece created without one goes to the end |
| `depends_on` | The ids of the pieces of the same issue it waits on, never positions, so a reorder or a delete cannot break it; creating a piece also accepts `depends_on_ordinalities`, which are resolved to ids and not stored |
| `status` | `pending`, `dispatched`, `completed`, `blocked`, `failed` or `skipped`; Done in the pill is `completed` |
| `blocked_reason` | Why a person marked the piece Blocked; required for that, cleared by every other status, including lifting the block |
| `deleted` | Soft delete; every read leaves a deleted piece out, and deleting a piece takes its id out of the `depends_on` of the pieces that waited on it |

Rows written before this change kept ordinalities in `depends_on`. The taskmanager rewrites them as ids when it starts, once: an ordinality that names no piece of the issue is dropped, and a board with none to rewrite is not touched. The store refuses a dependency on a piece of another issue (`ErrTaskTodoCrossIssue`), on one that does not exist (`ErrTaskTodoDependencyNotFound`) and one that would close a cycle (`ErrTaskTodoCycle`). There is no hand-kept SQL mirror: the table follows the blueprint and gains `blocked_reason` when the board is provisioned.

The tools (TDL-2, on the store of TDL-9). Writing needs Can move on the backlog the issue is in; reading needs only that the caller can see it, and an issue the caller cannot see answers not found.

| Tool | Does |
|---|---|
| `taskmanager_task_todo_list_for_issue` | The todos of one issue by its id, in order: id, code, title, instructions, `depends_on` (ids), `status` (the API value), `state` (To do, In progress, Done or Blocked; `failed` reads Blocked), `blocked_reason`, and `done` and `total` for the issue |
| `taskmanager_task_todo_count_for_issues` | `task_id` repeated, at most 500: `done` and `total` for each issue that has todos, in one read, so a board card needs no read of its own (TDL-6); an issue with none, unknown or not visible is left out |
| `taskmanager_task_todo_update` | Only the fields sent: `title`, `description`, `instructions`, `depends_on` (an empty list clears it) |
| `taskmanager_task_todo_reorder` | `ids`: every todo of the issue once, first to last |
| `taskmanager_task_todo_delete` | Removes the todo; the todos that waited on it stop waiting |
| `taskmanager_task_todo_set_status` | `status` is To do, In progress, Done or Blocked (the API values `pending`, `dispatched`, `completed` and `blocked` are taken too); Blocked by hand needs `blocked_reason`, and any other status clears it, so lifting a block is setting To do |
| `taskmanager_task_todo_create`, `_read`, `_dispatch`, `_list` | Unchanged; `_list` still lists by workflow run |

Refusals, each with the store's message and nothing changed:

| Error | Status | When |
|---|---|---|
| `ErrTaskTodoCycle` | 409 | an edit would make a todo wait, directly or through others, on itself |
| `ErrTaskTodoCrossIssue` | 400 | a todo would wait on a todo of another issue |
| `ErrTaskTodoDependencyNotFound` | 400 | `depends_on` names a todo that does not exist |
| `ErrTaskTodoOrderMismatch` | 409 | `ids` of a reorder is not exactly the issue's todos, so the list changed under the caller: read it and send it again |
| `ErrTaskTodoBlockedReasonRequired` | 400 | Blocked by hand with no reason |
| `ErrInvalidTodoStatus` | 400 | a status that is not one of the four |

## What this leaves out

| Left out | Why |
|---|---|
| Separate tabs or a switch for the four views | They are tags on one list (D13) |
| A filter bar or sheet | Tapping a tag filters (D13) |
| Counts of Ready and Blocked | The owner chose the list first (D13) |
| Duplicates and clashes as a page | They are a mark on the task and a line in its detail |
| Editing a task | The agency never edits the boards it reads (D9) |
| A Sort button, an approval card, a progress card | Sorting was removed (D49) |
| A Move button, dragging a card | Moves are done in Chat (D22) |
| A console page | The app is the way the backlog is used (D12) |

Built from the app's existing list rows and cards, not new ones; the Do
Something list (`src/home/StartRows.tsx`) is the reference.

## Using the full width of a window

Drawn in [wide.html](../../mockups/app/wide.html) at phone width, at 42rem and at 84rem, for an issue's page (below), All issues as a list and as a board, a backlog's board, and a smart backlog's page as a list and as a board. The owner chose one wide row for each issue for the List on 2026-11-11 (D108). The Board drawings, columns of at least 15rem that share the spare width, stand as drawn and were not questioned.

The width of the window decides the layout through flex, `clamp()` and grow and shrink rules, with no fixed pixel width, so a window of any width gets a layout that fits it. The one breakpoint is `min-width: 48rem`: below it the header keeps the stacked layout of the phone, and from it up the header is a single line. The phone looks as it does today.

| Part | Strategy |
|---|---|
| Content column | Takes the window's width less a margin of `clamp(1rem, 3vw, 2rem)`; no maximum width |
| Header line on All issues | One line: Search takes the spare width, the issue count follows it in small grey just before the switch and has no row of its own, and the List \| Board switch is at the right end, sized to its content. The count is placed the same way on every screen: just left of the switch. The title stays in the top bar |
| Header line on a backlog's Board | The same line with the backlog's name at its left: name, Search, count, switch |
| Header line on a smart backlog | One line: the title, the Smart chip and the rule beside it ("Tag has hub-steward-swe", quiet grey) at the left; the count at the right, set apart from the rule and in the same small grey as the count on All issues; then the switch; then Actions at the far right of the same top line, level with the title. A smart backlog has no Search box |
| List row | A wrapping flex row. The title is `flex: 1 1 24rem` and the tags follow it: under the title on a phone, at the right of the title on a wide window. One row for each issue (D108) |
| Board | A flex row that scrolls sideways. Each column is `flex: 1 0 15rem`: never narrower than 15rem, and the spare width is shared equally, so how many columns show follows the window (one and a half on a phone, three and a bit at 42rem, all five steps from about 80rem). A column keeps its step's place in the row, so `repeat(auto-fit, minmax(15rem, 1fr))` is not used: it would wrap the fifth step under the first. The Board starts straight after the header line |
| Card | As today; it stretches with its column and keeps its two-line title |
| Top bar and bottom tabs | As today, across the full width; the three buttons share it equally |

Not drawn because it is not built: a Search box on a smart backlog's page.

### Every other screen (D123)

Drawn in [wide.html](../../mockups/app/wide.html#s8) with Chat and the Backlogs list as the two examples. The frame of every screen, backlog or not, is as wide as the window at every width: the earlier phone-width column and the separate `fluid` frame are gone. The only breakpoint is still `min-width: 48rem`, and it changes the header line, never the width of the frame.

| Part | Strategy |
|---|---|
| Frame | The window's width less the margin of `clamp(1rem, 3vw, 2rem)`, on every screen |
| Lists of rows and cards | Spread across the width, as the list rows of All issues do |
| A lone button | `max-width: 28rem`, at the left, so it does not stretch across the window |
| Bottom bar | A centred group; each button grows to at most 10rem |
| Header line | From 48rem one line, only on a screen with a search line or a List \| Board switch; every other screen keeps its stacked head |
| Phone | Unchanged below 26rem; between 26rem and 48rem the page fills the window instead of a centred 26rem column |

Screens whose wide layout needs more than rows spreading across the width, such as a chat room or a form being answered, are drawn and raised as their own issues when the owner wants them different.

### An issue's page

Drawn in [wide.html](../../mockups/app/wide.html) 7 at phone width, at 42rem and at 84rem (D119). The page is a wrapping flex row from `min-width: 48rem`, and the single column of today below it.

| Part | Strategy |
|---|---|
| Frame | As on every screen (D123): the page takes the window's width less the margin of `clamp(1rem, 3vw, 2rem)` |
| Card column | The card with the code, title, tag bubbles and description: `flex: 1 1 24rem` and `max-width: 40rem`, so the description is never one long line; the Source card sits under it |
| Sections column | `flex: 1 1 18rem`: the rest of the width, for the References and Log sections (D117, D111), the send-to-backlog button and the Waits on cards; it drops under the card when the window is too narrow for both |
| Phone | One column: the card, then the sections, as built |
