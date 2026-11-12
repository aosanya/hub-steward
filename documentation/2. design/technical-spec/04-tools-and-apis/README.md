# 04 · Tools and APIs

Every tool below is a Mwanachama operation. Each one is served twice from
the same declaration: as a REST route under `/instances/{agency}/…` and, where
marked, as an MCP tool. Every call needs a signed-in caller who is a member
of that agency; anyone else is answered "not found".

**Who** is who the operation is meant for: *member* is anyone in the agency;
*agent* is an AI role of the agency (Hub Steward in the lab example);
*manager* is the agency's owner. On the bundled API each MCP tool names a
permission action and is refused when the caller's role does not hold it,
so narrowing a tool to the roles shown is a matter of the agency's role
permissions.

MCP tools that act on an agency take it as an `instance_id` argument and
check membership on every call, so an agency the caller does not belong to
reads exactly like one that does not exist.

## What the tools cover

The sections below are grouped by what an agency's roles do with them. The
Siaya computer lab is the worked example: it uses chat, documents, bookings,
members, approvals and tasks. Every agency uses chat, members and
approvals; the rest depend on the modules its published definition switches on.

| Capability | Used by | Lab example |
|---|---|---|
| [Chat](#chat) | Every agency | Members ask in the lab's room |
| [Documents](#documents) | Any agency that answers from its own documents | House rules, Wi-Fi guide, booking rules, opening hours |
| [Bookings](#bookings) | Agencies that hold shared things for a time | Seats as holds on terminals |
| [Members](#members) | Every agency | Member set-up |
| [Approvals, tasks and the agent](#approvals-tasks-and-the-agent) | Every agency | A seat or Wi-Fi draft the manager approves |
| [Form steps](#form-steps) | Agencies whose workflows have form steps | A member's own form, then the next role's step |
| [Other families on the MCP endpoint](#other-families-on-the-mcp-endpoint) | Agencies that switch the module on | Not used by the lab |

## Chat

Paths are relative to `/instances/{agency}/comm`. Every agency has rooms; the lab's members ask Hub Steward in its room.

| Operation | Method and path | Reads / writes | Who | REST | MCP |
|---|---|---|---|---|---|
| Activity across rooms | `GET /chat/activity` | reads unread counts | member | Exists | Not generated yet |
| List a room's threads | `GET /groups/{room}/chat/threads` | reads threads with unread counts | member | Exists | Exists |
| List messages | `GET /groups/{room}/chat/threads/{thread}/messages?after={message}` | reads messages, only newer than `after` when given | member | Exists | Exists |
| Post a message | `POST /groups/{room}/chat/threads/{thread}/messages` | writes a message | member | Exists | Exists |
| Mark read | `POST /groups/{room}/chat/threads/{thread}/read` | writes the read marker | member | Exists | Exists |
| Start a thread | `POST /groups/{room}/chat/threads` | writes a thread | member | Exists | Exists |
| Archive a thread for yourself | `POST /groups/{room}/chat/threads/{thread}/archive` | writes the caller's own archive mark; the thread stays in everyone else's list | member | Exists | Exists |
| Bring an archived thread back | `DELETE /groups/{room}/chat/threads/{thread}/archive` | removes the caller's own archive mark | member | Exists | Exists |
| List your archived threads | `GET /groups/{room}/chat/threads/archived` | reads the caller's own archived threads | member | Exists | Exists |
| What one person can read | `GET /people/{actor_id}/chat/reach` | reads every thread in the person's rooms that she may read, with why; never direct messages | the mount decides | Exists | Exists: `comm_person_reach_list` |
| My notifications | `GET /notifications` | reads the caller's own notifications, newest first | member | Exists | Exists: `comm_notification_list` |
| My unread count | `GET /notifications/unread` | reads how many of the caller's notifications are unread | member | Exists | Exists: `comm_notification_unread` |
| Mark notifications read | `POST /notifications/read` | writes the read mark on the caller's own notifications | member | Exists | Exists: `comm_notification_mark_read` |

## Documents

Paths are relative to `/instances/{agency}/sources`. Any agency that answers from its own documents uses these; the lab's are house rules, a Wi-Fi guide, booking rules and opening hours.

| Operation | Method and path | Reads / writes | Who | REST | MCP |
|---|---|---|---|---|---|
| Add a source | `POST /sources` | writes a source: title, kind, properties | manager | Exists | Exists: `sources_source_create` |
| Add a document | `POST /sources/{source}/documents` | splits text into passages with heading path and position | manager | Exists | Exists: `sources_document_create` |
| List passages | `GET /sources/{source}/chunks` | reads passages | member | Exists | Exists: `sources_chunk_list` |
| Search passages | `POST /chunks/search` | reads the passages closest to a query vector, each with its source and who verified it | agent | Exists | Exists: `sources_chunk_search` |

Search needs vectors; making them is still to be built.

## Bookings

Paths are relative to `/instances/{agency}/assetmanager`. These are the asset manager's calls for holding a shared thing for a time. The lab holds terminals; another agency would name its own assets. The bundled API mounts the asset manager for every agency, so the lab's definition, which switches on only comm and the task manager, needs no setting for it.

| Operation | Method and path | Reads / writes | Who | REST | MCP |
|---|---|---|---|---|---|
| List terminals | `GET /assets` | reads assets | agent | Exists | Exists: `assetmanager_asset_list` |
| List holds | `GET /holds` | reads holds | agent | Exists | Exists: `assetmanager_hold_list` |
| Hold a terminal | `POST /holds` | writes a hold, optionally with a start and an end; an overlapping slot on the same terminal is refused | agent, after approval | Exists | Exists: `assetmanager_hold_create` |
| Commit or release a hold | `POST /holds/{hold}/commit`, `/release` | writes the hold's state | manager | Exists | Exists: `assetmanager_hold_commit`, `assetmanager_hold_release` |

## Members

Paths are relative to `/instances/{agency}/actor`. These serve member set-up:
Hub Steward finds who is asking to join and drafts the set-up for the
manager. Mwanachama lets the agent decide a join request as the agency,
but the lab's Hub Steward does so only after the manager has approved its draft.

| Operation | Method and path | Reads / writes | Who | REST | MCP |
|---|---|---|---|---|---|
| Find people | `GET /actors?q={text}` | reads members whose name or member code contains the text | agent or manager; members are refused | Exists | Exists: `actor_list_actors` |
| Join requests across the agency | `GET /join-requests?pending_only=true` | reads every group's join requests, newest first | agent or manager; members are refused | Exists | Not generated yet |
| Approve or decline a join request as the agency | `POST /join-requests/{request}/operator-approve`, `/operator-decline` | writes the decision; a decline is told with a reason or made quietly, and a told one reaches the member's Notifications page | manager or agent, whether or not they lead the group; members are refused | Exists | Exists: `actor_operator_approve_join_request`, `actor_operator_decline_join_request` |
| Approve or decline a join request as a group leader | `POST /join-requests/{request}/approve`, `/decline` | writes the decision | a leader of that group | Exists | Exists: `actor_approve_join_request`, `actor_decline_join_request` |

## Approvals, tasks and the agent

| Operation | Method and path | Reads / writes | Who | REST | MCP |
|---|---|---|---|---|---|
| Propose a draft | `POST /instances/{agency}/approvals` | writes kind, summary and payload; the proposer is the caller | agent or manager | Exists | Exists: `agency_propose_write` |
| List drafts | `GET /instances/{agency}/approvals?status=` | reads drafts, newest first | agent or manager | Exists | Exists: `agency_list_approvals` |
| Approve or refuse | `POST /instances/{agency}/approvals/{draft}/decision` | writes the decision and a reason; only a pending draft moves | manager; the agent is refused | Exists | Exists: `agency_decide_approval` |
| Open a task | `POST /instances/{agency}/taskmanager/tasks` | writes a task for the manager; an assignee, if named, must be the agency's owner or agent for now, anyone else is refused | agent | Exists | Exists: `taskmanager_task_create` |
| Hand a task to someone | `POST /instances/{agency}/taskmanager/tasks/{task}/assign-holder` | writes the assignee and keeps the earlier ones as history; a person handed the task is told | agent or manager; the assignee must be the agency's owner or agent for now, anyone else is refused | Exists | Exists: `taskmanager_task_assign_holder` |
| Set up a repeating task | `POST /instances/{agency}/taskmanager/repeating-tasks` | writes a rule that makes one task per period for one assignee | agent or manager; the assignee is checked as for a hand-over, so it must be the agency's owner or agent for now | Exists | Exists: `taskmanager_repeating_task_create` |
| Group tasks in a case | `POST /instances/{agency}/taskmanager/cases`, `PUT …/cases/{case}/tasks/{task}` | writes a case, with the caller as requester, and links its tasks; the case closes when its last task settles | agent or manager | Exists | Generated with the task tools; the requester binding there is still to be checked |
| Add a member with the agent role | membership | writes a membership | manager | Exists | Exists: `agency_add_agent` (owner only) |
| Make a key for an agency's agent | `POST /instances/{agency}/api-keys` | writes a key that acts as an agent of this one agency | manager | Exists | Not offered: a key cannot make a key |
| The agency's rules | agency rules | reads the agency's rules | member | Exists | Exists: `agency_list_rules` |
| Notes about a member | `insight_create`, `insight_list` | writes and reads short notes keyed by an opaque member id | agent | — | The tools exist; their use for one member's notes, and who may read them, is not decided yet |

## Form steps

A workflow step of kind fill form names the role that acts on it and the form's questions. A member sees and sends only the steps of the roles they hold, and a send moves the workflow on to the next role. Steps of the farmers' market keep their own tools; the two tools below serve every other fill-form step in any agency.

| Operation | Method and path | Reads / writes | Who | REST | MCP |
|---|---|---|---|---|---|
| List the steps I can act on now | `GET /instances/{agency}/my-open-steps?available=true` | reads the live version's fill-form steps whose role the caller holds and that can be acted on now: a workflow's first step (`state` start) and a later step whose run waits for the caller's role (`state` waiting, with its `order_id`), each with its form's questions and the register's code | member | Exists | Exists: `agency_list_my_open_steps` with `available` true |
| Send a step's answers | `POST /instances/{agency}/steps/{step}/answers` | checks the caller holds the step's role, checks the answers against the step's questions, saves them as a row of the step's register and returns the run's `order_id`, the row and the next step | member, or an AI role seated in the agency | Exists | Exists: `agency_submit_step_answers` |

How it works:

- **A register per form step.** Publishing an agency makes sure each live fill-form step with a form and questions has a register named after the step, in the same workflow, that its role adds rows to and that carries the step's questions. A step that changes between versions updates its register at the next publish. An agency published before this existed has no registers for its steps until it is published again, and a send for such a step is refused with a conflict saying so.
- **Who may send.** Holding the step's role is the check, the same one the plain list `my-open-steps` makes, so a form that is not a member's is neither listed nor accepted: a member without the role, and the owner without it, are refused with 403.
- **A run is an order id.** The first step of a workflow starts a new run: the caller leaves `order_id` empty and the answer names a new one. Every later step of that run is sent with the run's `order_id`, and the run must be waiting for exactly that step. Which step a run waits for is read from its rows: the first step, in order, that has no row for that order id. A wrong or missing run is refused with 409 or 400.
- **Checks.** The answers are checked by the register's own row check: every question the form asks is answered if required, a number or currency is a number, a yes or no is yes or no, a date is a date, a choice is one of the options, and nothing is answered that the form does not ask. The same answers saved twice for one run within a minute are refused.
- **Multi-select answers.** An answer is a string. For a multi-select question the REST send also takes a list of the chosen options, and the saved answer is the chosen options joined by a comma and a space (`Fever, Cough`); the MCP tool takes only the joined string. A string is read back as one option when it equals an option (so an option that itself holds a comma stays whole) and is otherwise split at each comma and space. Every chosen option must be one the question offers, or the send is refused with 400; a list given for a question that is not multi-select is refused with 400 too.
- **Two sends at once.** Sends for one run are taken one at a time, so two simultaneous sends of the same later step give one 201 and one 409 (the run is no longer waiting for that step).
- **What the next role sees.** After a send the response carries the next step (title, role, form name, questions, `order_id`). That role's `available=true` list shows it as waiting, and the sender's list no longer shows that run.
- **Where the rows go.** The rows are the register's rows, so the register screens and tools read them with the register's own visibility.

Limits: only fill-form steps are moved on by this; a step of another kind in the same workflow is skipped by the run. The run moves in step order and does not branch on an answer.

## Other families on the MCP endpoint

The bundled API registers more tool families than the lab uses. They belong to agencies whose definitions switch the module on, and they are listed so a reader can see the whole surface; the registrations are in `code/wakala-api/internal/api/http/mcp.go`.

| Family | What an agency's roles do with it |
|---|---|
| `agency_*`, `instance_*` | Register an agency, add an agent, list its services, read and set its join mode, name and languages, run a review, design from a spec, and propose, list, read, amend and decide approvals |
| Custody consent | Read, publish, agree to and withdraw the consent text: [custody consent tools](custody-consent-tools.md) |
| Forms, forms catalogue, forms git | Compose, send and answer forms; keep the counted answers and the records branch |
| Market | Offers, asks, orders and group orders that wait for a named person's yes |
| Risk | The risk register of threats, consequences and safeguards |
| AI | An agency's AI accounts, roles and limits |
| Insights | `insight_create`, `insight_list` |

Whether each tool is open to an agent role is set by the agency's role permissions, not by this page.

## Issues and votes (stretch)

| Operation | Reads / writes | Who | REST | MCP |
|---|---|---|---|---|
| Send the agency's standing issue form (the lab's first use) | writes one send; each send opens a case with the sender as requester | any member; Hub Steward on a member's behalf | Partly built: a standing form keeps each send as its own record, is reached through an audience the host supplies and can be read back by its sender; supplying that audience on the Mwanachama API and opening a case are to be built | To be built |
| Vote for an open issue, or take the vote back | writes one vote per member per case, recording who cast it | members; owners and agents are refused as voters | Exists: `POST /instances/{agency}/taskmanager/cases/{case}/votes`, `DELETE …/cases/{case}/votes/{member}` | Exists: `taskmanager_case_vote`, `taskmanager_case_take_back_vote` |
| List open issues by votes | reads open cases, most votes first | members and the manager | Exists: `GET /instances/{agency}/taskmanager/cases/ranked` | Exists: `taskmanager_case_list_by_votes` |

The API stamps the caller's agency role on every vote, so a vote Hub Steward casts for a member who said "me too" is refused as an agent's; casting on a member's behalf is not built. The catalog's public board already has "me too" in its module, but the API serves the catalog at `/catalog` and not per agency. These votes are on the task manager's cases. Mwanachama also
has a polls module, mounted per agency; whether issue votes use it instead is
not decided yet.

Approving a draft carries it out when wakala-api has an applier for its kind:
the write is made as the deciding manager, and a write the agency refuses answers
422 and leaves the draft pending. A draft of any other kind is recorded
approved and nothing is written.
