# Step kinds

Status
- A step's `tool` (the one tool the person acting uses) is declared on `work_item` and the scenario block but the studio design draws no field for it, the scan never reads it, `validateStepTool` checks only its shape, and only the Test agent checks it against the role's tools (`internal/testruns/act.go` `namedTool`); a live run reads nothing from it (turned into Q113).
- A step whose actor is a group is accepted, scanned and published but appears in nobody's Start list (turned into Q151; `caller_open_steps.go` `roleByID`, `mwanachama-backend-agency/actor_pick_impl.go`).

- `work_item` held no kind, actor, form, notify target or attachment (closed on 2026-10-31: the blueprint now declares `kind`, `role_id`, `run_workflow_id`, `form_name`, `questions`, `recipient_role_id`, `sent_step_id`, `routes`, `otherwise_step_id`, `time_limit_minutes`, `cancel_workflow_id`; `mwanachama-backend-agency/agency.blueprint.json`). The drawn "Picks from" and attachment choices are still not in `questions` (see options.md).
- `event_flow_step` has topics, a consumer and a handler, none matching the drawn kinds; the two overlap as the place a step is declared (open).
- A step's form becomes a forms-module `form` and `question` rows (answer_type, prompt, option picks), but nothing creates one from a step; the drawn "Picks from the agency's groups" has no counterpart in `question` (open; `mwanachama-backend-forms/forms.blueprint.json`).
- Notify and Attach: comm raises notifications through `NotificationRepository.Raise` with a closed vocabulary; the drawn attachment of "the order's details" has no field there (open; `mwanachama-backend-comm/CLAUDE.md`).
- Step names differ between layers: the workflow says the agency sends the invitation, the Test run says "Farmers' agent" (open; `workflow-detail.html` screen 1, `test-run.html` screen 1).
- The Proposed note on every workflow screen lists four step kinds (fill a form, notify a group, say yes or no, run another workflow) while the Kind picker on the Steps tab offers six (adds Send form and Route), and the Test page's Add a block offers four, a different four (open; `workflow-steps.html` screens 1 and 2, `test-blocks.html`).
- Run another workflow: only a self-run is refused, a loop across two workflows is not (turned into Q105; see engine.md).

- A step has two role ideas: `role_id` (the one who acts) and the RACI labels on the step; nothing reads the labels at run time and nothing ties the actor to a label (turned into Q110).

Log

## 2026-10-29 14:05 UTC

First run. Read the workflow and test pages, the agency, catalog and forms blueprints and operations, wakala-api's market tools and tests, and the studio and member routes. The market module repo is not checked out, so its side is unread.

## 2026-10-29 15:10 UTC

Second run. No new question: unanswered steps are settled by decision 71 and orders under way by decision 91. Opened one gap, the step-kind lists that disagree inside the design. Still unread: the market module repo.

## 2026-10-31 00:40 UTC

Read the run-workflow rule in the agency module. One gap, turned into Q105.

## 2026-10-31 11:00 UTC

Re-read the work_item blueprint: the first status bullet was stale and is closed. Opened the actor against RACI-label gap, turned into Q110.

## 2026-11-02 02:35 UTC

Traced the `tool` field added on 2026-11-01 (agency `94ead5e`) from the blueprint through the document build, the scan and the Test agent. One gap, turned into Q113.

## 2026-11-02 15:30 UTC

Traced the chat step of workflow-chat.html (decision 123) to the work_item blueprint. Gap: the chat step has no kind value, one `tool` string cannot hold the six ticked tools, and no field holds Can start or Opens in; the ticks against the role's permission codes are turned into Q118 (status: open, `mwanachama-backend-agency/agency.blueprint.json`, `mwanachama-wakala-api/internal/api/http/agent_permissions.go`).

## 2026-11-07 UTC (third run)

Traced the actor picker to the Start list. Gap: a group chosen as a step's actor never reaches a person (Q151).
