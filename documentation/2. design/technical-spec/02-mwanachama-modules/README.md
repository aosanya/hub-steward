# 02 · Mwanachama modules

Each module is a Go library that declares its objects and operations as data. One declaration gives the tables, REST routes and (where it has them) MCP tools, so a person in the app and an agent over MCP pass the same checks. The Mwanachama API mounts each module once per agency, so every agency has its own tables. Which modules an agency has depends on its published definition; the community computer lab in Siaya is the worked example in the tables below.

## What each module gives an agency's roles

State is for the bundled API in `code/wakala-api`, which mounts the module per agency unless the row says otherwise.

| Module | Holds | Gives an agency's roles | The lab uses it for | State |
|---|---|---|---|---|
| Agency | Roles, goals, objectives, responsibilities, rules, workflows, drafts and publications | The agency's definition, its review and the rules agents quote | The lab itself and the rules it quotes | Exists; its 145 declared operations are all MCP tools |
| Actor | Members, groups (names in several languages, reviewed before members see them), join requests, join by code, removal with history kept | People and rooms; joining; finding a member by name or code | Members and rooms; member set-up | Exists; MCP tools registered |
| Comm | Rooms, threads, messages, read markers, notifications | Chat between members and with AI roles | Reading members' questions and replying | Exists; the chat tools are registered |
| Sources | Sources, passages with heading and position, verifications, search | Answers drawn from the agency's own documents, with the citation | The lab's documents and the citation in each answer | Exists; REST and MCP |
| Asset manager | Assets, locations, movements, holds, time-slot holds | A register of what the agency owns and holds on it for a time | Seat bookings as holds on terminals; the equipment register (how it is shown and looked after is still to be designed) | Exists; REST and MCP |
| Digital twin | Nodes, links, metrics with limits, readings over time | A picture of the things an agency tracks and their state | Not switched on in the lab's file | Not in the bundled API; who may read and write is not decided; 19 tools in the module (counted in its own repository, not here) |
| Task manager | Tasks, projects, assignments with history, cases that group tasks, a plain state per task (To do, Doing, Waiting, Done, Cancelled) | Work handed to people and roles, grouped in cases | Wi-Fi accounts and repairs as tasks; one access request as a case holding its tasks | Exists; REST and MCP |
| Insights | Short notes about a subject | Notes an AI role keeps about one subject | Member memory (stretch) | Tools `insight_create` and `insight_list` registered; who may read a member's notes is not decided |
| Forms | Forms, questions, answers, publishing to a group | Intake, reports and surveys, answered one question at a time on the phone | Intake and exit surveys for funders' numbers; not in the demo. Turning forms on also brings the catalog and git modules, mounted for the agency's owners and agents only | Exists; REST and MCP; anyone else is answered as if the agency did not exist (self-tests) |
| Catalog | Catalogues with audiences, services, appointments, the board | What an agency offers and the items its members raise | Not used by the lab | Module and routes exist; the API serves them at `/catalog`, not under an agency |
| Voting | Polls put to groups, answered in a window and counted | Decisions made by a chosen group | Not used by the lab | Mounted per agency at `/instances/{agency}/voting` |
| Market | Offers by approved posters, asks to one poster, orders and group orders that wait for a named person's yes | Farmers' buying and selling | Not used by the lab | Exists; MCP tools registered |
| Risk manager | A register of bow-ties: threats, consequences and the safeguards between them | A risk owner's view of what could go wrong with the agency's AI roles | Not used by the lab | Exists; MCP tools registered |
| AI | AI accounts, AI roles with their model, limits and instructions, and use per role | The model behind each agent and what it has used | Hub Steward's own model and key | Exists; MCP tools registered |
| Permissions | Declared actions and the grants that allow them | The check behind every tool: may this role perform this action, here | Which tools Hub Steward may call | Exists |

Accounting, ratings and workspace are also in the bundled API and are not described here yet. Engage (notices, events, volunteer calls) is named in the module catalog and is not in the bundled API. The digital twin and Engage live in their own Mwanachama repositories (`mwanachama-backend-digitaltwin`, `mwanachama-backend-engage`), not in this repository; "Built in the module" below means built there.

## Languages

Each agency stores its content languages and a default, chosen from the phone app's nine; only the owner sets them. The planned Siaya lab names English, Swahili and German. Group names and forms keep translations per language and show members only reviewed ones. An address for owners and agents drafts translations; which model it uses is not chosen and it stores nothing yet. An AI role such as Hub Steward answers in the language a member writes in, so it does not depend on these.

## What was added to the modules

The changes below were built for the agency and serve any agency. Built and shown by tests unless the State says otherwise.

### Comm

| Change | State |
|---|---|
| Listing a thread's messages can take the last message seen and return only newer ones | Built |
| Eight chat operations as MCP tools from the REST declaration: list threads, list messages, post, mark read, start thread, archive, unarchive, list archived. Archiving sets a thread aside for the caller only; the caller comes from the session | Built; registered on the bundled API's MCP endpoint |
| A private thread about one record, with a notice to the other side on each message and when access ends | Built in the module |
| The host can decide who is told when a thread is declined or a reply is posted; defaults stand otherwise | Built; the API uses it for a declined thread |
| Notice records keep delivery attempts to phones; owners and agents can read them; attempts older than 90 days are pruned by the API's housekeeping | Built |
| One notice raised to everyone behind one record, muting and caps honoured, with a count reached and missed | Module only; the address, who may call it, retry guard and the API supplying the people are to be built |

### Sources, Insights, Digital twin, Asset manager

| Change | State |
|---|---|
| Sources: a document added as text or Markdown is split into passages keeping their headings and position, so an answer can cite exact words | Built |
| Sources mounted per agency at `/instances/{agency}/sources`, behind the membership check | Built, REST and MCP |
| Insights: a note filed about one member by opaque id and listed back | Built in the module |
| Asset manager mounted per agency, REST and MCP, behind the membership check | Built |
| Asset manager: a hold may carry a start and end; overlapping live holds on one asset are refused, back-to-back are allowed | Built |
| Digital twin: all 19 operations as MCP tools, each naming its agency (counted in its own repository, not here) | Built in the module; not mounted on the API |
| Digital twin places: a node can carry a shape; nodes match by preferred, alternative and hidden names per language (`GET /nodes/matching`); `GET /nodes/holding` finds the innermost node holding a point (a street's shape is its line); `GET /nodes/numbered` matches an address by street name then leading house number. REST and MCP. An area-level group names its node in the twin; old group outlines are retired | Built; not mounted on the API |

### Mwanachama API

| Change | State |
|---|---|
| An agency's owner adds a member with the agent role, over REST and MCP; others are refused, and naming an existing owner is refused | Built |
| A key scoped to one agency acts as its agent; only an owner can make one; it reaches no other agency, cannot do owner-only things or create agencies | Built |
| Agent drafts, manager approves: one record per draft (kind, summary, payload, decision), REST and MCP; only an owner decides, the agent never approves its own | Built |
| Task and form tools generated from their declarations and registered per agency | Built |
| Staff open the console with the same email sign-in link; `GET /me` lists the agencies where the caller is owner, agent or staff, with role and permissions (owner: every permission in the library; agent: every unlocked one; resident: empty) | Built. A staff role's own permissions read empty until published role permissions reach the permission check; how console pages follow them is not decided |
| A new hosted agency waits for approval. The platform owner lists waiting agencies and approves or declines with a note up to 500 characters; others are answered as if the address did not exist; a second decision is refused | Listing and deciding built; the directory hides waiting and declined agencies. Refusing invitations, form publishing and public links while waiting, and showing a decline note to owners, are to be built |
| An owner reads and sets, per notification event, who is told, and previews a rule for one group before saving | Built for join request decided, thread started or declined, group invitation, form sent, and who answers a form's private chat. Reply-in-thread keeps its default (meaning undecided) |
| An agency's published definition decides which modules run (ledger, task manager, forms with catalogue and git, comm, polls), with the modules they need; others answer as an unknown agency. Comm is on by default; workflow steps that fill or send a form or ask yes/no turn on forms, notify steps turn on comm. Members, the agency, documents and asset manager are always on. Re-read within 30 seconds, at once after a publish | Built. An agency with no published definition is not switched yet. The agency's definition declares the task manager |
| A scheduled sweep (every five minutes by default) makes due repeating tasks and posts due standing messages in every agency; after an outage it makes only the current period's; no address can start it | Built |

### Actor

| Change | State |
|---|---|
| A list of people to invite is checked row by row and sent in one call, `POST /instances/{agency}/invitations/batch`; owners and agents only; a row with no account gets one; links go out at a steady pace; answer per row | Built |
| A role kind can be marked staff. A dropped role's kind is retired and its holders lose the seat with history kept; a returning role is brought back. On the API, publishing copies the staff mark, revives old kinds, ends dropped seats; staff-role holders count as staff for task hand-over | Built |
| A role can be marked an outsider's, for someone invited to help with one record: left out of member lists, cannot join groups | Built in the module |
| An owner or agent removes a person from one group (told in their Inbox) or the whole agency (every group, record kept). Agents remove residents only; the last owner cannot be removed; others are answered as if the agency did not exist. A removed person sees which agencies removed them and when, never by whom; comm and forms stop serving them at once; earlier messages keep their name. Only the API's route applies this | Built |
| A group's leader sets its join mode and hidden flag and decides its join requests; other leaders and plain members are refused | Built. Reaching groups inside a leader's group is to be built |
| One member can be given the right to act for another (who granted it recorded; revocable, expiring, listed by both) | Module only; not wired on the API; who may grant is not decided |

### Agency

| Change | State |
|---|---|
| Roles name the permissions they hold, modules carry their own settings, both checked before publishing; publishing creates or renames member roles. Permissions name their allowed actions and are listed over REST and MCP; a role can be ticked as staff; importing an agency file keeps role permissions. Actor is always on in a new lab; a switched-off module's wrong settings warn rather than block | Built. Older permissions name their actions (invite, decide join requests, approve forms, publish a report, run a poll, post; hiding board items also allows removing a raised item). Some have no action yet (record a promise's outcome, edit the register, edit services, manage appointments, assign board items); a permission with no action grants nothing, and owners and agents act |
| Module settings in three layers read in order: module default, agency definition, owner override, inside the agency's tables for that module. Declared: member code length (actor), task states (task manager), form approval and form types (forms), who is told per notice (comm), catalogue entry kinds (catalog), repositories and allowed tags (git). Defaults keep today's behaviour | Built per module. What happens to an override when the definition is republished is not decided; nothing on the API writes these layers yet |

### Task manager

| Change | State |
|---|---|
| A task can be handed to a person or a role, each hand-over kept. Through the API only owners and agents can be handed tasks; a repeating task's assignee passes the same check. A person handed a task is told through comm | Built. A hand-over to a role tells nobody yet |
| Cases group tasks and close themselves when the last task is done or cancelled; opening and closing are events. Served per agency at `/instances/{agency}/taskmanager/cases`; a case opened there records the signed-in caller as requester. Staff can end a case by hand (done is refused while a task is open; cancelling cancels open tasks) with a reply to the requester; a requester lists their own cases | Built over REST. Generated case tools are registered but their requester is still to be checked. Ending a case and the requester's list are module-only, not granted on the API |
| A task may link to something another module owns (a form, a booking) | Built |
| Every read answers one of five plain states (a setting; agencies can store their own, checked on save). A task can be moved by naming the state: a legal path or a refusal with reason. Failed reads as Waiting, split as Doing | Built in the module. The API does not write an agency's states yet |
| A task sits in one backlog at one step. A task nobody has placed reads in the first backlog at the step that names its status, and stays there when backlogs are reordered, replaced or have their steps' statuses cleared: saving the backlogs pins it first. A task that names a backlog that no longer exists reads as unplaced. When a placed task's status changes it moves to the step of its backlog that names the new status; a step that names no status keeps the task; if no step names the status the task stays in its backlog at no step (counted by the backlog, not by any step). Moving a task to a step writes the step first and puts the place back if a status hop fails. The held-issues check, the pinning and the save run in one transaction; the setting row is not locked, so two simultaneous edits on Postgres can still overwrite each other | Built in the module
| A person reads only the issues of the backlogs one of their groups can see, on every read that returns an issue: read one, read by name, assignments, a project's, a run's, a case's and the overdue list, plus the list itself. A hidden issue answers "not found" when read by id, by name or for its assignments, and is left out of every list. What an issue waits on, and what waits on it, leaves out edges whose other end is an issue the person cannot see, and a hidden issue has no edges to a person who cannot see it; no count of the omitted edges is returned, because the reply is a plain list. A backlog's counts only cover issues in that backlog, so a person never sees a count of hidden issues. A call with no person (the loader, an agent) and a hub with no owner group and no grant are not narrowed. Changing an issue (update, move, place, assign, delete) is not narrowed by this rule: it is held by the task permissions | Built in the module, proven through the route table. The other copy of the module is not synced |
| A person writes only where a group of theirs has Can move on the backlog the issue is in: create (the backlog it lands in, the first when none is named), update (and the backlog it is updated into), move to a state, place, delete, and an edge between issues (Can move on the issue it starts from, Can see on the one it points to). A person with Can see is refused with a 403. A call with no person, such as the loader, is not narrowed. A hub with no Product owner group and no grants is open to everyone; once either is set, a person whose groups cannot be looked up sees and writes nothing. The Product owner group must exist (checked when it is set, and an empty one is refused), and the first grant is refused until it is set, so a restricted hub never hides every backlog from its managers; a new backlog is seen by the owner group alone because the owner group always has Can move. Giving and taking access run in one transaction; on Postgres two simultaneous edits can still overwrite each other because the settings row is not locked. A grant to a group that no longer exists is listed with gone: true and counts for nothing. An issue whose stored backlog no longer exists reads in the first backlog and is visible to whoever sees it | Built in the hub's copy; not yet in mwanachama-backend-taskmanager. Other writes (assign, unblock, block, complete, case and run calls) are not checked yet |
| One call opens a dated task per item another module lists, replay-safe, each linked to its source | Built; source wiring on the API to be built. The lab could open one check per equipment item |
| One call opens one task per subject from a template in a single step; replay-safe; a blank or repeated subject refuses the whole call | Built; not reachable per agency on the API |
| Repeating tasks: one per period on a calendar rule or date list, set up per agency over REST and MCP | Built |
| Votes on a case, and a case grant (below) | See below |

### Case access and notices

| Change | State |
|---|---|
| A grant on one record lets a non-member read that one case only; ending the case or closing the record withdraws it, keeps history and tells the person; the holder is in the case thread's audience. Progress at `GET /instances/{agency}/taskmanager/cases/{case}/progress` shows only case and task titles and statuses, via membership or grant. Other case addresses stay members-only; a grant opens nothing in another agency | Built; a self-test answers "not found" without a grant, for a real and an invented case |
| Notices for case opened or closed and task assigned or overdue are declared. A member's case is theirs whatever the request names, and they are told when it opens and closes | Opened, closed and assigned built. Overdue: the task manager lists overdue tasks past the agency's grace period; raising the notice on a schedule is to be wired |

### Forms

| Change | State |
|---|---|
| Forms are read in the language asked, showing reviewed translations only; an answer records its language, and translations are written through the permission-checked routes | Built |
| A draft form can have a question removed (choices go too, rest renumbered) or moved; both refused once published | Built |
| A form can require several named approvals from different approvers; a refusal starts a new round; with none named it needs one plain approval | Built; today any owner or agent may give any approval; tying approvals to roles is not decided |
| An owner switches form approval on or off for the agency; with it on, an uncleared draft cannot be published and nobody approves their own form; with it off, asking is refused and forms publish directly | Built |
| One response per person: a second send by the same person for the same group and period edits the first | Built |
| Sends kept per period; a send can name its period and is refused once closed; a member reads last period's answers; a caller on the permission-checked routes lists audience members who sent nothing in a closed period (members of the form's groups and sub-groups) | Built |
| Publishing a closed form's report tells every member of each group it went to and inside them, once per member per publish; republishing adds a version and tells again. Residents read the latest report as a reference to where it is kept and which version | Built. Reading the report text in the member app is paused, with further report work, until a later product discussion |
| Each accepted send writes the sender's record to the agency's forms catalogue per group answered through, countable answers only (yes/no, numbers, choices); resend replaces; a person in two groups counts once overall. Group leaders list and count their own group's records over REST and MCP, only for groups the form was sent to; owners and agents read all; others are answered as if the address did not exist | Built. Free text, dates, times and files stay out while undecided. The member app's leader card and whether a parent-group leader reads inner records are to be built or decided |
| Promises in a published report become tasks on the agency's board, linked to form and report version, with owner, due date and outcome; a publish with a textless or ownerless promise, or no task board, is refused before anything is recorded. Latest promises: `GET /instances/{agency}/forms/forms/{form}/results/latest/promises`. Owners and agents record an outcome (kept, partly kept, not kept, with a note): `PUT /instances/{agency}/forms/forms/{form}/results/promises/{task}/outcome`; others, unknown tasks and other forms' promises are answered as if they did not exist | Built. Whether permission-holding staff may record outcomes is not decided. Showing promises to members is paused with report work |

### Catalog

| Change | State |
|---|---|
| An entry can have a go-live time, singly or in a batch (a batch naming a missing entry is refused whole); an editor's bulk write cannot move it | Module only; not yet an address |
| An agency can keep its own catalogues, each with an audience (public, members, staff), declared in its definition and checked before publishing. A reader below the audience, or below staff for unpublished, not-yet-public or private entries, is answered as if the entry did not exist; costs stay staff-only. Only declared catalogue parts can be asked for ("not found" naming the part); template settings go to the definition layer, malformed ones refused | Built; not mounted per agency on the API |
| Services can offer appointment times (window, places): a member books and cancels their own place; a full time or a second place for the same person is refused; staff cancel anyone's with a reason and list a day | Built through declared addresses where the booker is the signed-in caller; not mounted on the API. The lab could offer workshop places |
| One record per holder per subject (off unless the agency sets it): resending under the same standing replaces; a second standing is refused | Built |
| Staff can hide a raised item on the public board (leaves every public read, share link stops, showing restores both; never open to anonymous). A form's totals count each person once even when answering for two groups | Built. Known defect filed: filing under a hidden item's name is answered differently from an unused name, revealing the hidden item |
| The board: members raise items, staff file for people with no account, raised items group into board items with an outcome, "me too", replies; each a gated address and the actor always the signed-in caller. A member's raise ignores claimed filer or channel. Staff and public reads (public hides board items with nothing publishable; the near-a-place list shows only items under a visible board item; public board pages). Staff remove a raised item with a free-text ground and raisers read why. A board item is assigned to a person or role, unassigned, and closed once (a reply, removal or outcome never closes it). Replies: staff list all, a raiser or filing clerk reads their own. A raiser's list includes items staff filed for their register entry | Built in the module with route tests; not mounted per agency. Granting removal to staff on the API and the Manage the board permission carrying these actions are to come; until then owners and agents act. Hub Steward's issues are planned on task-manager cases; whether to use the board instead is not decided |
| The unanswered list defaults to ten weekdays (Monday–Friday, no holidays) when the agency sets no answer time; only a reply clears an item. A raised item can name its catalogue entry; staff list one entry's items | Built. A separate five-day not-acknowledged list is to be built |
| A raised item can get a follow key (stored as a fingerprint, shown once): its holder opens that item with its replies without an account; wrong keys all answer "not found"; a new key retires the old | Built. Who issues it and whether a reply can be for the raiser alone are not decided; today the key shows every reply |
| A dated, sourced figure about a scope (such as households reached), recorded by the caller and never edited; the latest date is current, history stays readable | Built; carried by the API's catalog declaration |

### Git, Voting, Engage

| Change | State |
|---|---|
| Git: a merge asks the host whether the caller may make it and records who merged; a refusal leaves the request open | Module only. The lookup of who may merge and the mapping of a records branch to its accountable role are to be built; any staff member can merge meanwhile |
| Voting (new module): polls with a question and choices, sent to groups, answered in a window (one choice, several, or a vote budget), counted from answers; results shown only when someone allowed publishes them; never secret. Mounted per agency at `/instances/{agency}/voting`, behind membership. An agency's definition can switch polls on and give a role the permission to run one | Saving, answering, counting, defaults and the mount built. Holders' counts, who chose what, a member's own choice, and published results read by members of the target group built in the module. Checks on publishing results and who may run a poll are not settled. Hub Steward's issue votes are planned on task-manager cases; moving them here is not decided |
| Engage (new module): notices with read marker and unread count, events answered I'm going / Not going, volunteer calls taking offers from which the poster picks and marks filled. No edits after sending. Events can be changed or cancelled (tells everyone going); self check-in during the event, a holder on its day. A volunteer call can close with fewer picks or cancel with none; offers withdraw until picked. An agency's definition can switch it on and give a role permission to post each kind | Built in the module; not mounted on the API. The lab could post a workshop or ask for helpers |

### Shared engine

| Change | State |
|---|---|
| Forms, Task manager, Comm and the API read one schedule shape: start, end, time zone, a rule or a date list (which needs an end), days each period stays open. Standing messages post once per occurrence into a group's chat, set up and stopped only by the group's leads. The lab could drive a weekly opening-hours reminder or monthly equipment check | Built. Known defect filed: a standing message set up for a group without naming a thread is reported sent but no member can read it; fix undecided. Posting to a group's thread directly works |

## Still to be built

| Need | Module | Notes |
|---|---|---|
| How residents reach the chat and member tools on the MCP endpoint | Mwanachama API | The tools are registered behind REST's membership and room checks; residents' access is not decided |
| Embeddings for document passages | Sources | Search takes a vector; model not chosen |
| Who may read a member's notes | Insights, API | Stretch; not decided |
| An agency manager's approve list in the phone app | Phone app | Placement not decided |
| The lab's member barcode and sign-in at the terminal | Phone app, API | Placement, and sign-in without email, not decided |
| Standing form: sent to nobody, open to every member, each send its own record (stretch) | Forms | Module built and route-tested: marked standing at creation; audience is supplied by the host per group (none supplied reaches nobody); never in a member's waiting list; a sender reads their own sends by id. To build: API supplying the audience; each send opening a case. Undecided: a window; repeating on a schedule |
| The lab's issue form: each send opens a case on the agency's board (stretch) | Forms, API | Forms does not depend on the task manager; the API connects them; survey answers unchanged |
| Hub Steward casting a case vote for the member who said "me too" (stretch) | API | Votes on a case (one per member, withdrawable, requester's counted first, owners and agents refused) and the list by votes are built, REST and MCP; the API stamps the caller's role as the voter's kind, so an agent caller is refused and casting for a member is not built |
| Standing issue form on the phone app's Forms screen (stretch) | Phone app | Drawn before built; no issues list |
