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
| [Report files](report-files.md) | Agencies whose role holders publish a stored report | A role holder picks a stored file and version to publish |
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
| List the steps I have sent | `GET /instances/{agency}/my-sent-steps?limit=&after=` | reads the rows the caller added to the live version's step registers, current rows only (a corrected row is replaced by its correction), newest first, each with `step_id`, `title`, `form_name`, `workflow_id`, `workflow_name`, `record_code`, `order_id`, `row_id`, `sent_at` (the row's creation time) and `answers`; `limit` is 50 by default and 200 at most, `after` is the `row_id` of the last item of the page before and an unknown one is refused with 400; another member's rows never appear, the owner's included | member, or an AI role seated in the agency | Exists | Exists: `agency_list_my_sent_steps`, action `instance.my_sent_steps.read` |

How it works:

- **A register per form step.** Publishing an agency makes sure each live fill-form step with a form and questions has a register named after the step, in the same workflow, that its role adds rows to and that carries the step's questions. A step that changes between versions updates its register at the next publish. An agency published before this existed has no registers for its steps until it is published again, and a send for such a step is refused with a conflict saying so.
- **Who may send.** Holding the step's role is the check, the same one the plain list `my-open-steps` makes, so a form that is not a member's is neither listed nor accepted: a member without the role, and the owner without it, are refused with 403.
- **A run is an order id.** The first step of a workflow starts a new run: the caller leaves `order_id` empty and the answer names a new one. Every later step of that run is sent with the run's `order_id`, and the run must be waiting for exactly that step. Which step a run waits for is read from its rows: the first step, in order, that has no row for that order id. A wrong or missing run is refused with 409 or 400.
- **Checks.** The answers are checked by the register's own row check: every question the form asks is answered if required, a number or currency is a number, a yes or no is yes or no, a date is a date, a choice is one of the options, and nothing is answered that the form does not ask. The same answers saved twice for one run within a minute are refused.
- **Multi-select answers.** An answer is a string. For a multi-select question the REST send also takes a list of the chosen options, and the saved answer is the chosen options joined by a comma and a space (`Fever, Cough`); the MCP tool takes only the joined string. A string is read back as one option when it equals an option (so an option that itself holds a comma stays whole) and is otherwise split at each comma and space. Every chosen option must be one the question offers, or the send is refused with 400; a list given for a question that is not multi-select is refused with 400 too.
- **Two sends at once.** Sends for one run are taken one at a time, so two simultaneous sends of the same later step give one 201 and one 409 (the run is no longer waiting for that step).
- **What the next role sees.** After a send the response carries the next step (title, role, form name, questions, `order_id`). That role's `available=true` list shows it as waiting, and the sender's list no longer shows that run.
- **Where the rows go.** The rows are the register's rows, so the register screens and tools read them with the register's own visibility.

Limits: this moves on fill-form steps, and since 2026-11-11 also `send_form` steps and `route` forks (see `../do-something-own-steps.md`); a step of any other kind in the same workflow is skipped by the run.

## Other families on the MCP endpoint

The bundled API registers more tool families than the lab uses. They belong to agencies whose definitions switch the module on, and they are listed so a reader can see the whole surface; the registrations are in `code/wakala-api/internal/api/http/mcp.go`.

| Family | What an agency's roles do with it |
|---|---|
| `agency_*`, `instance_*` | Register an agency, add an agent, list its services, read and set its join mode, name and languages, run a review, design from a spec, and propose, list, read, amend and decide approvals |
| Custody consent | Read, publish, agree to and withdraw the consent text: [custody consent tools](custody-consent-tools.md) |
| Report files | List the stored versions of a form's report files: [report files](report-files.md) |
| Forms, forms catalogue, forms git | Compose, send and answer forms; keep the counted answers and the records branch |
| Market | Offers, asks, orders and group orders that wait for a named person's yes |
| Risk | The risk register of threats, consequences and safeguards |
| AI | An agency's AI accounts, roles and limits |
| Insights | `insight_create`, `insight_list` |
| Audit | `audit_list_entries`: what has been done in the agency, newest first; see [Audit log](#audit-log) |
| Places | `digitaltwin_address_*`, `digitaltwin_tenure_*` and `digitaltwin_land_use_*`: addresses, holdings and land use of places; see [Places records](#places-records-digitaltwin) |
| Council | `council_*`: meetings, agendas, minutes, resolutions and bylaws, for agencies that run the council module; see [Council records](#council-records) |
| Finance | `accounting_budget_*`, `accounting_report_*`, `accounting_bill_*`, `accounting_payment_*`, `accounting_tender_*`, `accounting_quote_*`: budget lines, reports, bills, payments and procurement; see [Finance tools](#finance-tools-accounting) |

Whether each tool is open to an agent role is set by the agency's role permissions, not by this page.

## Audit log

| Operation | Method and path | Reads / writes | Who | REST | MCP |
|---|---|---|---|---|---|
| List the agency's audit entries | `GET /audit/entries` | reads entries, newest first, each with `id`, `instance_id`, `actor`, `action`, `subject` and `at`; only the named agency's | the agency's owner, or a role that holds the permission `audit.view` | Exists | Exists: `audit_list_entries`, action `audit.entry.list` |

- **Module.** `modules/audit` in `code/wakala-api`: the object `audit_entry` (table `audit_entries`) and the one list operation, declared in `audit.blueprint.json` and `audit.operations.json`. An entry is append-only; it is never edited or removed.
- **Permission.** `audit.view`, "View the audit log", carries the single action `audit.entry.list` (`modules/agency/models/permissions_catalog.json`). A caller who is neither the owner nor holds it is refused with a message naming the permission. The check is in `internal/api/http/mcp_tools_audit.go`.
- **Writes that record an entry.** On the MCP tool path, after the write succeeds, `internal/api/http/mcp_audit_records.go` records the caller as `actor`, a plain `action` and the thing changed as `subject`, for the agency in the call's `instance_id`:

| Tool | Action | Subject |
|---|---|---|
| `instance_rename` | renamed the agency | the new name |
| `actor_grant_role` | granted a role | the `actor_id` argument |
| `forms_form_publish` | published a form | the `form_id` argument |

A failed write records nothing, and no other write records an entry yet. A failure to record is logged and does not undo the write.

- **Commits on dev.** `aef05cf3` (failing test), `18c5002f` (module), `c218fcec` (permission and guard), `be95447a` (the three recorded writes).

## Finance tools (accounting)

Served from `modules/accounting` in `code/wakala-api` (MUN983, hub MUN1045). Every tool takes the agency as `instance_id`; the caller's account id fills `created_by`, `billed_by`, `paid_by` and `quoted_by`, and a request that names one of them is refused. Amounts are whole numbers in the smallest unit. `routes.BuildTools` is the allowlist: the account, entry, contract and variance operations of the module are not served as tools.

| Tool | Action | Arguments besides `instance_id` | Reads / writes | Permission |
|---|---|---|---|---|
| `accounting_budget_set` | `accounting.budget.set` | `account_id`, `period_start`, `period_end`, `amount`, optional `name`, `department` | writes one budget line per account and period; setting it again replaces name, department and amount | `accounting.manage` |
| `accounting_budget_list` | `accounting.budget.list` | optional `account_id`, `department`, `limit` | reads lines with `planned` and `spent` (the account's balance over the period, debits minus credits) | `accounting.manage`, `accounting.view` |
| `accounting_budget_read` | `accounting.budget.read` | `budgetID` | reads one line | `accounting.manage`, `accounting.view` |
| `accounting_report_list` | `accounting.report.list` | optional `limit` | reads one report per period that has budget lines, oldest first; the difference is planned minus spent | `accounting.manage`, `accounting.view` |
| `accounting_report_read` | `accounting.report.read` | `period_start`, `period_end`, exactly as the budget lines were set | reads one report: `name`, `figures` (planned, spent, difference as planned minus spent, per department, closing balance per account type) and `lines`; folded on every call | `accounting.manage`, `accounting.view` |
| `accounting_upward_report_send` | `accounting.upward_report.send` | `period_start`, `period_end`, `kind` (`budget_and_actuals` or `spending_by_department`) | folds the same report `accounting_report_read` gives and records one append-only send: totals (difference is planned minus spent), department figures, every budget line for `budget_and_actuals`, `sent_at`, `sent_by`; nothing is transmitted | `accounting.manage` |
| `accounting_upward_report_list` | `accounting.upward_report.list` | optional `limit` | reads the recorded sends, newest first; the difference is planned minus spent | `accounting.manage`, `accounting.view` |
| `accounting_dimension_totals` | `accounting.dimension.totals` | `key`, optional `account_type`, `period_start`, `period_end` | reads one total (debits minus credits) and entry count per value of the dimension `key`, sorted by value, over the entry sides on accounts of `account_type`; with no type every entry nets to zero, so ask for `expense` or `income`; a period needs both bounds, start inclusive and end exclusive | `accounting.manage`, `accounting.view` |
| `accounting_bill_create` | `accounting.bill.create` | `income_account_id`, `receivable_account_id`, `amount`, `due_at`, optional `payer`, `payer_actor_id`, `narration` | writes one entry: debit the receivable, credit the income account, `due_at` set, `document_kind` `bill`; `payer` stays display text, `payer_actor_id` is the payer's person id (a uuid, refused as invalid when malformed) and is stored as the entry dimension `payer_actor_id` | `accounting.manage` |
| `accounting_bill_list` | `accounting.bill.list` | optional `income_account_id`, `status`, `payer`, `actor_id`, `as_of`, `limit` | reads bills by due date with `settled`, `outstanding`, `status` (`open`, `overdue`, `settled`, `reversed`), `days_overdue` and `payer_actor_id`; `actor_id` is an exact match on `payer_actor_id`, never a name match | `accounting.manage`, `accounting.view` |
| `accounting_bill_read` | `accounting.bill.read` | `billID` | reads one bill, with `payer_actor_id` | `accounting.manage`, `accounting.view` |
| `accounting_bill_update` | `accounting.bill.update` | `billID`, `amount`, `due_at`, optional `payer`, `payer_actor_id`, `narration` | corrects one bill in place; a correction that sends no `payer_actor_id` clears the link, as it does for `payer`; refused as locked (409) when the bill is settled or reversed, and when it already has a payment and the `amount` differs, because a bill with a payment keeps its amount | `accounting.manage` |
| `accounting_payment_mark_paid` | `accounting.payment.mark_paid` | `billID`, `cash_account_id`, optional `amount`, `paid_on`, `narration` | writes one entry: debit the cash account, credit the bill's receivable, `settles_entry_id` set to the bill; no `amount` pays what is outstanding, a smaller one is a part payment; the payment copies `payer` and `payer_actor_id` from its bill | `accounting.manage` |
| `accounting_payment_list` | `accounting.payment.list` | optional `kind` (`bill` or `certificate`), `bill_id`, `payer`, `actor_id`, `limit` | reads payments oldest first: bill payments and milestone payment certificates; a reversed payment is left out; each payment returns `payer_actor_id`; `actor_id` is an exact match on `payer_actor_id`, never a name match, and leaves certificate payments out when it is set | `accounting.manage`, `accounting.view` |
| `accounting_milestone_list` | `accounting.milestone.list` | `accountID` (the budget line's account), optional `limit` | reads that account's milestones oldest first, each with `status` (`planned`, `part_certified`, `certified`) and `certified_amount` | `accounting.manage`, `accounting.view` |
| `accounting_certificate_list` | `accounting.certificate.list` | `milestoneID`, optional `limit` | reads the payment certificates of one milestone oldest first, each with `payee_account_id`, `retention_account_id`, `amount`, `retention_bps`, `retention_amount`, `certified_by`, `certified_at`, `release_due_at`, `released_at` | `accounting.manage`, `accounting.view` |
| `accounting_tender_create` | `accounting.tender.create` | `budget_id`, `title`, optional `description`, `closes_at` | writes one tender on an existing budget line | `accounting.manage` |
| `accounting_tender_update` | `accounting.tender.update` | `tenderID`, `title`, optional `description`, `closes_at` | corrects one tender; the budget line stays; refused as locked once `closes_at` has passed | `accounting.manage` |
| `accounting_tender_list` | `accounting.tender.list` | optional `budget_id`, `limit` | reads tenders oldest first, each with `quote_count` and `lowest_amount` | `accounting.manage`, `accounting.view` |
| `accounting_tender_read` | `accounting.tender.read` | `tenderID` | reads one tender with `quote_count` and `lowest_amount` | `accounting.manage`, `accounting.view` |
| `accounting_quote_create` | `accounting.quote.create` | `tenderID`, `supplier`, `amount`, optional `note`, `valid_until` | writes one quote; a supplier that changes its offer before the tender closes either records another quote or corrects this one with `accounting_quote_update` | `accounting.manage` |
| `accounting_quote_update` | `accounting.quote.update` | `quoteID`, `supplier`, `amount`, optional `note`, `valid_until` | corrects one quote in place; the tender stays; refused as locked once its tender has closed | `accounting.manage` |
| `accounting_quote_list` | `accounting.quote.list` | `tenderID`, optional `limit` | reads the tender's quotes, lowest price first | `accounting.manage`, `accounting.view` |

- **Permissions.** `accounting.manage`, "Keep the books and set budgets", carries every action above and the account and entry actions; `accounting.view`, "Read accounts, budgets and reports", carries the list and read actions only (`modules/agency/models/permissions_catalog.json`, MUN1052). `guardToolPermissions` in `internal/api/http/mcp_sources_permissions.go` applies the actions to an agent caller: an agent whose agency roles hold neither permission is refused as for any agency tool. A caller who is not an agent is not held to the catalog by that guard.
- **Nothing derived is stored.** `spent`, the figures of `accounting_dimension_totals`, a report's figures, a bill's `settled`, `outstanding` and `status`, the payment list and a tender's `lowest_amount` are folded on every call from entries and quotes.
- **Refusals.** An unknown budget line, bill, tender or cash account answers not found. A missing required argument, a non-positive amount, a malformed instant, a cash or receivable account of the wrong type, and paying a settled or reversed bill or more than is outstanding answer invalid.
- **Storage.** Budget lines, bills and payments live in the ledger's budget lines and entries; tenders and quotes are the blueprint objects `tender` and `quote`, whose tables `Provision` creates.
- **Edit tools (MUN1112).** `accounting_budget_set` is the budget edit: setting a line again for the same account and period keeps its id and replaces name, department and amount, so there is no separate budget update tool. `accounting_bill_update`, `accounting_tender_update` and `accounting_quote_update` send the whole record as it should now read and answer `ErrLocked` (409) in words that say why when the rule above refuses. They rewrite only the editable columns (a bill's amount, due date, narration, payer and payer person id; a tender's title, description and closing date; a quote's supplier, price, note and validity) and leave who recorded it, when and what it points at.
- **Not built.** Awarding a tender to a quote, and tying an award to a contract and its milestones.
- **Contract stages (MUN1331).** Creating a milestone, certifying a payment and releasing retention are REST only (`accounting.milestone.create`, `accounting.certificate.create`, `accounting.certificate.release_retention`) and are not served as tools.
- **Commits on dev.** `2910c9a7` (budget), `3819e72d` (reports), `45b1971b` (bills, with the store and test files of the procurement work), `4eabbfd4` (procurement), `56030154` (payments), `6942f8f9` (the two permissions). Evidence: `projects/hungarian-municipality/documentation/3. implementation/todo/MUN983-finance-records/README.md`.

## Council records

Sixteen tools keep what a council does: its meetings, each meeting's agenda and minutes, the resolutions it takes and its bylaws. They exist for an agency that runs the `council` module (a mountable entry in `modules/agency/models/modules_catalog.json`). Every tool takes the agency as `instance_id`, and every read, list and write is narrowed to that agency.

| Tool | Method and path | Arguments | Permission |
|---|---|---|---|
| `council_meeting_create` | `POST /council/meetings` | `name`, `date` (`YYYY-MM-DD`), optional `place` and `committee` | `council.manage` |
| `council_meeting_list` | `GET /council/meetings` | optional `committee`; earliest day first | `council.view` |
| `council_meeting_read` | `GET /council/meetings/{meetingID}` | `meetingID` | `council.view` |
| `council_meeting_update` | `PATCH /council/meetings/{meetingID}` | `meetingID`, `name`, `date`, optional `place` and `committee`; the whole record as it should now read | `council.manage` |
| `council_agenda_set` | `PUT /council/meetings/{meetingID}/agenda` | `meetingID`, `items` (non-blank lines, in order); setting again replaces the items | `council.manage` |
| `council_agenda_read` | `GET /council/meetings/{meetingID}/agenda` | `meetingID` | `council.view` |
| `council_minutes_set` | `PUT /council/meetings/{meetingID}/minutes` | `meetingID`, `text`; setting again replaces the text | `council.manage` |
| `council_minutes_read` | `GET /council/meetings/{meetingID}/minutes` | `meetingID` | `council.view` |
| `council_resolution_create` | `POST /council/resolutions` | `title`, `date` (`YYYY-MM-DD`), `outcome` (`adopted`, `rejected` or `deferred`), optional `meeting_id` of a meeting of the same agency | `council.manage` |
| `council_resolution_update` | `PATCH /council/resolutions/{resolutionID}` | `resolutionID`, `title`, `date`, `outcome`; the meeting it was taken at cannot be changed | `council.manage` |
| `council_resolution_list` | `GET /council/resolutions` | optional `meeting_id` and `outcome`; earliest day first | `council.view` |
| `council_resolution_read` | `GET /council/resolutions/{resolutionID}` | `resolutionID` | `council.view` |
| `council_bylaw_create` | `POST /council/bylaws` | `title`, `year` (four digits), optional `text` | `council.manage` |
| `council_bylaw_update` | `PATCH /council/bylaws/{bylawID}` | `bylawID`, `title`, `year` (four digits), optional `text` | `council.manage` |
| `council_bylaw_list` | `GET /council/bylaws` | optional `year`; earliest year first, then title | `council.view` |
| `council_bylaw_read` | `GET /council/bylaws/{bylawID}` | `bylawID` | `council.view` |

- **Module.** `modules/council` in `code/wakala-api`: the objects `meeting`, `agenda`, `minutes`, `resolution` and `bylaw`, declared in `council.blueprint.json`, `council.wakala.json` and `council.operations.json`. A meeting has one agenda and one set of minutes (unique on agency and meeting).
- **Permissions.** `council.manage` ("Put council meetings on record and read them") carries all sixteen actions, `council.<object>.<verb>`, one for each tool; `council.view` ("Read council meetings") carries the eight list and read actions. Both are in `modules/agency/models/permissions_catalog.json`.
- **Guard.** `internal/api/http/mcp_tools_council.go` runs before any `council_*` call and refuses it when:
  - the call names no agency (`instance_id`);
  - the caller is not a member of the agency (the refusal is the same not-found as for an unknown agency, so the agency is not confirmed);
  - the agency does not run the council module, even for its owner;
  - the caller is not the owner and holds no role with the call's action. The refusal names the missing permission: `council.view` for a list or read tool, `council.manage` for a create or set tool.

  The owner passes once the agency runs the module. A server started without a council manager refuses every call.
- **Tool list.** The council tools are shown only to an agency that runs the module (the tool prefix `council` is the module code). The sixteen names are pinned in `testdata/mcp_roster/no-mounts.txt`, and the permission-coverage checks see each tool through `mcp_tool_actions.go`.
- **Errors.** A blank or malformed value, a blank agenda item, or a year, date or outcome out of shape is refused as invalid (400); an unknown id, a meeting or resolution of another agency, or a read of an agenda or minutes never set is refused as not found (404).
- **Commits on dev.** `b7113c46` (meetings, the permissions and the catalog entry), `5d811795` (agenda and minutes), `61489b52` (resolutions), `521236ea` (bylaws), `6076e6b7` (served on the hub, with the guard). Evidence: `projects/hungarian-municipality/documentation/3. implementation/todo/MUN982-council-records/README.md`.

## Places records (digitaltwin)

Nine tools keep what the Places & Addresses screens show beyond a place's name: its street addresses, who holds it and how it is zoned. They exist for an agency that runs the `digitaltwin` module. Every tool takes the agency as `instance_id`.

| Tool | Method and path | Arguments | Permission |
|---|---|---|---|
| `digitaltwin_address_create` | `POST /addresses` | `street`, `number`, optional `area`, `postcode` and `place_id` (a registered place node) | `digitaltwin.manage` |
| `digitaltwin_address_list` | `GET /addresses` | optional `street`, `area`, `place_id`; oldest first | `digitaltwin.view` |
| `digitaltwin_address_read` | `GET /addresses/{addressID}` | `addressID` | `digitaltwin.view` |
| `digitaltwin_tenure_create` | `POST /tenures` | `place_id`, `holder`, optional `kind` (`owner` by default, `tenant`, `leaseholder`, `occupant`, `custodian`) and `since` (`YYYY-MM-DD` or RFC 3339) | `digitaltwin.manage` |
| `digitaltwin_tenure_list` | `GET /tenures` | optional `place_id`, `holder`, `kind` | `digitaltwin.view` |
| `digitaltwin_tenure_read` | `GET /tenures/{tenureID}` | `tenureID` | `digitaltwin.view` |
| `digitaltwin_land_use_create` | `POST /land-uses` | `zone`, `use`, and `place_id` or `area` | `digitaltwin.manage` |
| `digitaltwin_land_use_list` | `GET /land-uses` | optional `place_id`, `area`, `zone` | `digitaltwin.view` |
| `digitaltwin_land_use_read` | `GET /land-uses/{landUseID}` | `landUseID` | `digitaltwin.view` |

- **Module.** `modules/digitaltwin` in `code/wakala-api`: the roles `address`, `tenure` and `land_use` in `digitaltwin.blueprint.json`, filled by `digitaltwin.wakala.json` (tables `addresses`, `tenures`, `land_uses`) and the four testdata domains; operations in `digitaltwin.operations.json`; the records in `address_record.go`, `tenure_record.go` and `land_use_record.go`. A place named by `place_id` must exist as a node, otherwise the record is refused as invalid.
- **Permissions.** `digitaltwin.manage` carries all nine actions, `digitaltwin.view` the six list and read actions; both are in `modules/agency/models/permissions_catalog.json`. In the Hungarian municipality the clerk (Jegyzo) holds `digitaltwin.manage` and the council member `digitaltwin.view`.
- **Serving.** `modules/digitaltwin/mcp/resolve.go` registers only the address, tenure and land use operations and resolves the agency's twin manager per call, as the accounting tools do; `internal/api/http/mcp_tools_digitaltwin.go` guards them with the shared permission check. The other digitaltwin operations (nodes, links, observations) stay on the HTTP routes and are not tools. The nine names are pinned in `testdata/mcp_roster/no-mounts.txt`.
- **Screens.** Addresses, Ownership & Tenure and Land Use read these tools (MUN1116, commit `b5dbb10b`); Places and the place detail still read assetmanager.

## Issues and votes (stretch)

| Operation | Reads / writes | Who | REST | MCP |
|---|---|---|---|---|
| Send the agency's standing issue form (the lab's first use) | writes one send; each send opens a case with the sender as requester | any member; Hub Steward on a member's behalf | Partly built: a standing form keeps each send as its own record, is reached through an audience the host supplies and can be read back by its sender; supplying that audience on the Mwanachama API and opening a case are to be built | To be built |
| Vote for an open issue, or take the vote back | writes one vote per member per case, recording who cast it | members; owners and agents are refused as voters | Exists: `POST /instances/{agency}/taskmanager/cases/{case}/votes`, `DELETE …/cases/{case}/votes/{member}` | Exists: `taskmanager_case_vote`, `taskmanager_case_take_back_vote` |
| List open issues by votes | reads open cases, most votes first | members and the manager | Exists: `GET /instances/{agency}/taskmanager/cases/ranked` | Exists: `taskmanager_case_list_by_votes` |
| The todos of an issue that can start now | reads one issue's todo list and returns those not Done and not Blocked whose every predecessor is Done, in order, with done and total, plus the todos held Blocked with their reason; a todo behind a Blocked one is not returned | anyone who can read the issue; an unseen issue is 404 | Exists: `GET /instances/{agency}/taskmanager/tasks/{task}/todos/ready` | Exists: `taskmanager_task_todo_ready` |
| What is left on the issues in progress of one backlog (MUN1171) | reads one backlog's issues that sit at its In Progress step (the step named In Progress, without regard to case, whatever its id: `doing` in Backlog, `in-progress` in the Municipal Journey Book; the issue's status is ignored, so an issue at To do, Review or Done is never listed, and a backlog with no such step lists nothing; a smart backlog lists its issues that sit at an In Progress step of their own backlog), and returns `total` (those issues), `total_pending_todos` and `items`: the first `limit` (1 to 100, default 25; `offset` pages) in rank order, each with `id`, `code`, `title`, `priority`, `tags`, `step`, its todos that are not Done in order (`id`, `code`, `title`, `ordinality`, `state` To do, In progress or Blocked, `blocked_reason`, `depends_on`) and `done` and `total`; an issue at the In Progress step with no pending todo is listed with an empty list; `backlog` (id or name) is required and a blank one is 400 | anyone who can see the backlog; a backlog that does not exist and one the caller cannot see are refused the same way, as unknown (400) | Exists: `GET /instances/{agency}/taskmanager/pending-todos?backlog=` | Exists: `taskmanager_task_todo_pending` |
| Read only the new entries of an issue's Log | reads one issue's Log, oldest first; with no argument the whole Log; `after` (the id of the last entry seen, or an RFC 3339 time) keeps only strictly newer entries, `kind` (`person`, `worker` or `automatic`, repeatable) keeps those kinds, `limit` (1 to 200) keeps the newest that many, still oldest first; they apply in that order; an `after` that is neither an entry of the issue nor a time, an unknown `kind` and a `limit` outside 1 to 200 are 400 (MUN1180) | anyone who can read the issue; an unseen issue is 404 | Exists: `GET /instances/{agency}/taskmanager/tasks/{task}/notes?after=&kind=&limit=` | Exists: `taskmanager_task_note_list` with optional `after`, `kind`, `limit` |
| The next Ready issue to take | reads the issues at the To do step that carry Ready, lowest rank first, and returns `total_ready` and the first `limit` (1 to 5, default 1), each compact (id, code, title, priority, effort, tags, rank, backlog, step) and without the description; an issue tagged Sinbin, Blocked or Waiting is never returned even beside Ready; optional `backlog` (id or name) and `tag` (repeatable) narrow it; a backlog the caller cannot see is 400 as unknown (MUN1175) | anyone; only the backlogs their groups can see | Exists: `GET /instances/{agency}/taskmanager/next-ready?backlog=&tag=&limit=` | Exists: `taskmanager_task_next_ready` |
| What an issue waits on and what waits on it (MUN1181) | reads one issue's depends_on edges both ways and returns `depends_on` and `needed_by`, each a list of `id`, `code`, `title`, `step`, `state` and `open` (true while that issue is not Done or Cancelled) in rank order, and `blocks_start` (true when any issue it waits on is open, a hidden one included); an issue in a backlog the caller cannot see is not named, `hidden_depends_on` and `hidden_needed_by` carry how many were left out; read-only | anyone who can read the issue; an unseen issue is 404 | Exists: `GET /instances/{agency}/taskmanager/tasks/{task}/dependencies` | Exists: `taskmanager_task_dependencies` |
| Everything a worker reads before starting an issue (MUN1174) | `taskmanager_task_brief`, `GET /tasks/{taskID}/brief`: one read that returns `issue` (in full, description included), `caps` (as `taskmanager_task_caps_read` gives them), `log` (the last `log_limit` entries, 1 to 50, default 10, oldest first, and every entry of kind person beyond them), `todos` (`items`, `done`, `total`), `depends_on` (each with `id`, `code`, `title`, `step`, `state`, `open` and `last_entries`, the last 3 Log entries of that issue) and `needed_by`; an issue in a backlog the caller cannot see is counted in `hidden_depends_on` or `hidden_needed_by` and never named, and an issue the caller cannot see is 404; read-only, in the `task.read` permission |
| The figures a worker's final report carries (MUN1182) | counted from one issue: `step` and `tags`; `todos_done` and `todos_total` and `blocked` (the Blocked todos with their reason); `commits` (every Log link whose text starts with `commit`, in order, one for each commit hash); `entry_count` and `last_entry_id`; `first_entry_at`, `last_entry_at` and `minutes_between` them (null when the Log is empty); `missing`, the todos that are Done but have no Log entry starting `Todo n of total done`; read-only | anyone who can read the issue; an unseen issue is 404 | Exists: `GET /instances/{agency}/taskmanager/tasks/{task}/report` | Exists: `taskmanager_task_report` |
| The issues in progress that are past their working-time cap (MUN1177) | reads one backlog's issues that sit at its In Progress step (the step named In Progress, without regard to case; status ignored) and whose time since their first worker Log entry is past their working-time cap (the issue's own, else the default 15 minutes), and any issue at that step with no worker entry; each item has `id`, `code`, `title`, `minutes_since_first_entry`, `minutes_since_last_entry` (null with no entry), `cap_minutes`, `clock_stopped` and `last_entry` (kind, first 200 characters, time); names no cause; `backlog` is required, 400 when blank, and an unseen backlog is refused as unknown; read-only | anyone who can see the backlog | Exists: `GET /instances/{agency}/taskmanager/timed-out` | Exists: `taskmanager_task_timed_out` |
| Take an issue without a race (MUN1173) | in one transaction moves the issue to the In Progress step of its backlog (the step that holds the in_progress status, else the step named In Progress or Doing), sets its status to in_progress and writes the first Log entry, `Taken by <caller>. Caps in force: <input> input, <output> output, <minutes> minutes` (kind worker); returns the issue compact, `note_id` and `caps`; the first statement is a compare-and-swap on the issue's status, so of two claims at once exactly one wins and the other is refused 409 as already in progress; refused 409 with the reason when the issue is tagged Sinbin, Blocked or Waiting, waits on an open dependency or has left To do; 403 without Can move on its backlog; 404 when it is unknown or unseen | workers and the manager | Served: `POST /tasks/{taskID}/claim`, MCP `taskmanager_task_claim` |
| Stop work on an issue as Blocked or Sinbin (MUN1178) | in one transaction writes the Log entry (kind worker, the mode and the reason, with the links), replaces the marks so exactly one of Ready, Waiting, Blocked and Sinbin is left (`blocked` adds Blocked, `sinbin` adds Sinbin, Ready is dropped, every other tag is kept), sets the todo named in `todo_id` Blocked with the reason when the mode is `blocked`, sets its status back to pending and moves the issue to the To do step; returns `id`, `code`, `title`, `mode`, `tags`, `backlog`, `step`, `status`, `note_id` and `todo_id`; refused 409 unless the issue sits at the backlog's In Progress step (the step named In Progress without regard to case, or with the id doing or in-progress), whatever its status, 403 without Can move on its backlog, 400 for another mode, a blank reason, a todo of another issue or a todo sent with mode `sinbin`, 404 when the issue or todo is unknown or the issue unseen; nothing is written when it is refused | workers and the manager | Served: `POST /tasks/{taskID}/release`, MCP `taskmanager_task_release` |
| Name the paths an issue will touch (MUN1183) | the issue carries `files`, a list of strings, each a path relative to its repo, optionally prefixed with the repo name and a colon (`hub-steward:code/app/src/app/menu/MenuEditForm.tsx`); a trailing slash means everything under that folder; sent on create and patch, returned by read (an empty list for an issue that has none or was made before the field), and left out of the compact lists such as pending; at most 100 entries, each not blank, at most 300 characters, no control character, no leading slash and no `..` segment, duplicates and surrounding spaces dropped, a bad entry refused 400 naming it and nothing written; a patch with `files` replaces the whole list and an empty list clears it, a patch or a whole update that leaves `files` out keeps it; stored in the issue document (the `files` field of the taskmanager blueprint, added to the table by the migration at start) | whoever may create or move the issue | Served: `POST /tasks` and `PATCH /tasks/{taskID}` with `files`, `GET /tasks/{taskID}` | Served: `taskmanager_task_create`, `taskmanager_task_patch` take `files`; `taskmanager_task_read` returns it |
| The issues in progress that touch the same files (MUN1184) | `taskmanager_task_file_overlaps`, `GET /file-overlaps`: send `taskID` (an issue whose `files` are used) or `files` (a list of paths, repeatable, for when no issue exists yet), or both; one of the two is required, 400 otherwise, and a bad path is 400 as on create; `items` are the issues at the In Progress step of every backlog the caller can see (the step named In Progress, without regard to case; status ignored), each with `id`, `code`, `title`, `step` and `overlapping`, the pairs `{asked, theirs}` of paths that overlap; two paths overlap when they are equal, or one is a folder (trailing slash) containing the other, within the same repo prefix; the issue asked about is never listed against itself, an issue with no `files` overlaps nothing, and an issue in a backlog the caller cannot see is not listed or counted; read-only, in the `task.read` permission | anyone; only the backlogs their groups can see; an unseen `taskID` is 404 | Exists: `GET /instances/{agency}/taskmanager/file-overlaps?taskID=&files=` | Exists: `taskmanager_task_file_overlaps` |

The API stamps the caller's agency role on every vote, so a vote Hub Steward casts for a member who said "me too" is refused as an agent's; casting on a member's behalf is not built. The catalog's public board already has "me too" in its module, but the API serves the catalog at `/catalog` and not per agency. These votes are on the task manager's cases. Mwanachama also
has a polls module, mounted per agency; whether issue votes use it instead is
not decided yet.

Approving a draft carries it out when wakala-api has an applier for its kind:
the write is made as the deciding manager, and a write the agency refuses answers
422 and leaves the draft pending. A draft of any other kind is recorded
approved and nothing is written.

## Changing a person and a place

Three tools change a record that already exists, and each carries its own permission so an app can tell who may change it and show or hide its Edit button (MUN1127, split from MUN1108).

| Tool | Action | Permission |
|---|---|---|
| `actor_set_actor_display_name` | `actor.actor.set_display_name` | `member.edit`, "Change a person's name and details" |
| `actor_set_actor_attributes` | `actor.actor.set_attributes` | `member.edit` |
| `assetmanager_location_update` | `assetmanager.location.update` | `location.edit`, "Change a place" |

- **Who may.** The agency's owner always may. Any other caller, an agent or a resident, may only when one of the roles they hold carries the permission; a resident holds a role through a group the agency gave it to. Without it the tool answers with a message naming the permission, for example `you need the permission "Change a place" (location.edit) in this agency to do this`. The check is `guardChangeTools` in `internal/api/http/change_permissions.go`; the same file lets a resident who holds `member.edit` through the actor routes and a resident who holds `location.edit` through the asset manager routes, and refuses the asset manager's place update on the HTTP route the same way.
- **Catalogue.** Both codes are in `modules/agency/models/permissions_catalog.json`, so `agency_list_permissions` lists them.
- **Grants.** No role of the municipality agency files is given either code: none of them could change a person or a place before, and a grant is the owner's to make on the permissions page.
- **Tests.** `internal/api/http/change_permissions_test.go` (owner, agent and resident, with and without the code, the refusal naming it) and `modules/agency/models/permission_edit_test.go`.

## Setting what a role may do

`agency_set_role_permissions` replaces the whole list of permission codes a role holds in an open draft (MUN1167, the owner's decision of 2026-11-16). `agency_update_role` stays the tool for a role's name and description.

| Item | Value |
|---|---|
| Tool | `agency_set_role_permissions` |
| Route | `PUT /instances/{agency}/roles/{role_id}/permissions` |
| Action | `agency.role.set_permissions` |
| Arguments | `instance_id`, `role_id` (id or code), `permissions` (every code the role should hold afterwards) |
| Returns | the role, with its stored `permissions` |

- **Replaces, never adds.** A code left out is unticked and an empty list unticks everything; a repeated code is kept once. The role's name, description and staff flag are untouched.
- **Who may.** The action is listed under the locked code `permission.override` in `modules/agency/models/permissions_catalog.json` and under no other code. The owner holds every code, so the owner may; an agent may only through a role that holds `permission.override`; a resident or a stranger is refused by the same membership check as every other `agency_*` tool.
- **Refused in words.** The locked codes `agent.manage`, `api_key.manage`, `agency.go_live`, `agency.delete` and `permission.override` answer 400 `... belongs to the owner alone and cannot be given to a role`; a code the catalogue does not list answers 400 `... is not a permission the catalogue knows`. Both name every offending code, and a refused call changes nothing.
- **A draft change.** It is refused once the draft is archived, and a role's permissions are part of the publish hash (MUN1158), so a permissions change alone publishes as a new version and changes what the live roles hold only then.
- **Where.** `SetRolePermissions` in `modules/agency/role_impl.go`; the declaration in `modules/agency/agency.operations.json`; the registry's cache is told through `internal/agencies/role_edits.go`.
- **Tests.** `modules/agency/mcp/role_permissions_tool_test.go` (replace, clear, de-duplicate, each locked code, unknown codes, archived draft, the catalogue entry), `internal/api/http/role_permissions_set_test.go` (owner, agent without the code, resident and stranger, a locked code, publish) and `internal/agencies/role_permissions_edits_test.go`; the roster pin counts rose by one.
