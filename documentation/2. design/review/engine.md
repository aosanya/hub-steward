# How a workflow runs

Status
- The market never reads the agency's published workflows: nothing in `mwanachama-wakala-api` calls `UseWorkflows` (`internal/agencies/registry.go` lines 635 to 655 set only coordinators, agents and names), so `workflow()` always returns the built-in `DefaultWorkflows` (`mwanachama-backend-market/workflows.go` lines 52 to 71 and 112 to 124), every order and group order is stamped `WorkflowVersion` 1, and a published step's actor or order is not what the gate checks. This is HS549 on the board; the premise (an order keeps a published version) is not carried out for the market. Open, board row HS549.
- Cancel is gated with the wrong version: `CancelOrder` passes the Buy now order's `WorkflowVersion` to the Cancel workflow (`orders.go` line 83), and `workflow()` refuses a found workflow whose version differs (`workflows.go` line 118). It is invisible while the source is unset; the day HS549 wires the published source, a Buy now at version 3 asks for Cancel version 3 and the cancel fails with 'not usable'. Open, build finding.
- Ask, yes and quote steps pin nothing: the gates in `asks.go` (line 94), `quotes.go` (lines 38, 91, 117, 142, 160) pass version 0 (latest) and neither `ask`, `yes`, `quote` nor `notice` has a `workflow_version` column (only `order` and `group_order` do, `market.blueprint.json` line 489 and 591). Edit and publish the Buy now workflow while a Supplier's answer is waiting and the answer is judged by the new steps. Open, build finding; turned into nothing because Q112 and decision 87 already say an order keeps its version.
- Cancel and Mark paid race, and each can undo the other: `CancelOrder` and `MarkPaid` read the order, check, then `update` writes every column back by id alone (`orders.go` lines 78 to 123, `manager.go` line 157), unlike group orders whose `updateGroupFrom` carries state and terms version in its WHERE. Mark paid does not check the state, so a cancelled order can be marked paid; a cancel does not look at `Paid`, so a paid order can be cancelled; and two overlapping writes restore the other's old columns. Turned into Q160.
- A yes is never used up and a cancel closes every yes: `BuyNow` accepts a yes that is open and never changes it (`orders.go` lines 38 to 56), so one yes can back several orders; nothing in the module or in wakala-api ever sets a yes to delivered; and `closeYeses` (`workflows.go` lines 180 to 182) sets every open yes of that picker and poster to called off, not the order's own `YesID`. Turned into Q161.
- Double taps create double rows: `CreateAsk` and `SendQuote` count then insert with no unique index (`asks.go` lines 51 to 58, `quotes.go` lines 45 to 53; the only indexes are on `poster_id, answer`, `request_id`, `notice_id`), so two taps at once make two asks to one Supplier or two quotes on one notice. Open, build finding (unique index on picker, poster, request, offer and on notice, poster).
- Accepting a quote is three separate writes with no transaction and no state condition on the notice: decline the others, mark the notice sold, accept the quote (`quotes.go` lines 157 to 168). Two overlapping accepts of different quotes both pass the open checks and both end Accepted, or a failure in the middle leaves the notice sold with the other quotes declined and none accepted. Open, build finding.
- A step is saved by replacing every column with no version compare and no merge: the studio chat rename (`mwanachama-wakala-studio/app/chat/useAgencyDashboard.ts` line 1420) empties kind, role, form, questions, routes, time limit and cancel workflow, two editors overwrite each other, and each save resets the step's scenarios (`mwanachama-backend-agency/workitem_impl.go` line 62, `store.go` `writeUpdate` line 206, `agency.operations.json` line 726). Turned into Q148.
- Marking a send paid and sending again are each a read followed by a whole-row write of the same `submission` row, with no condition and no lock, so a tie silently restores the other's old `paid_at`/`paid_by`; unmarking also erases who unmarked, and `GetSubmission` picks the first group's send of the period (`mwanachama-backend-forms/paid_impl.go`, `submission_impl.go` lines 14 to 24 and 35 to 57, `manager.go` lines 365 to 375). Turned into Q146.
- A queued form send is reported as Saved even when the phone could not keep it: `writeDraft` returns false on a full or private store and `sendAnswers` ignores it (`mwanachama-frontend-member/app/forms/drafts.ts`, `send.ts`). Turned into Q142.
- The waiting draft is keyed by agency and form only (`drafts.ts` `draftKey`), so MF102's many sheets of one form on one phone would overwrite each other before sending; build work for MF102 with forms F37 (fresh respondent per sheet, not built). Open.
- The send carries no idempotency key; a lost response is replayed as a whole-set send, which is safe only because the set replaces and `form_member_group` is unique (`mwanachama-backend-forms/forms.blueprint.json` line 241). Two overlapping sends of one set (screen and the 60 second outbox tick) can still make the loser fail on the unique key and be answered 500, retried and then succeed. Open, engineering only.
- Two coordinators correcting the same payment row at once both succeed, so the order counts the farmer twice; the one-correction and no-duplicate checks read then insert with no transaction or unique key (`mwanachama-backend-agency/record_row_correction.go`, `record_impl.go` `CreateRecordRow`). Turned into Q141. Open.
- A farmer's line in a group order can be changed ('Change my bags', `submission/code/app/src/buy/join/GroupOrderPage.tsx`) while the page was loaded open; nothing drawn or decided says what Send freezes, and the market module that would hold the check is not checked out. Turned into Q134.
- A clock cannot start a workflow run: the 5-minute schedule sweep makes a repeating task (a plain task and a period row) and nothing in that path calls `StartWorkflowRun`; no studio or app page draws a schedule. State: turned into Q128. Evidence: `mwanachama-wakala-api/internal/agencies/schedule_sweep.go`, `mwanachama-backend-taskmanager/repeating_store.go`.
- A loop of workflows through a run-another-workflow step or a cancel workflow passes the draft save and the validation scan (`mwanachama-backend-agency/workitemstep_impl.go` 121-129, `issue_impl.go` 189-196), and `mwanachama-wakala-api` has no run depth guard or consumer of the step (turned into Q105).
- A step's time limit is read from the pinned published version, but a failed read is swallowed: `publishedLimit` returns not-found on any error from `GetWorkflowRun`, the publication reader or an unknown step, and `BeginWorkflowRunStep` then uses the limit the caller passed, so a step can silently start with the wrong limit or none (`mwanachama-wakala-api/internal/agencies/step_limit.go` lines 28 to 33, 61 to 73). Open; engineering. Cost: see performance.md entry 29.
- A leader who leaves a group mid-run (an Admin with join requests waiting, a Coordinator whose order is open) keeps an active seat if leave is built on `Deregister`, so the notices and the Coordinator check go on reaching her. Turned into Q120.

- Updated 2026-11-01: one run starter exists, for a buyer's ask only. `mwanachama-wakala-api/internal/agencies/ask_run.go` `StartAskRun` starts a run pinned to the production version (`StartWorkflowRun(..., publication.Version, ...)`) and begins the first timed yes-or-no step; the task manager's `workflow_run` now carries `workflow_code`, `workflow_version`, `under_way` and `step_due_at`. No other trigger (a form sent, a message, a Start tap) starts a run. Still open for every other workflow.
- The ask's run picks the lowest-ordinality timed yes-or-no step of the whole production document (`firstTimedYesNoStep`, `ask_run.go`), not the step of the ask's own workflow, and reads and sorts every workflow and step of the document on each ask (cost grows with workflows and steps; read from code, not measured). Turned into Q112.
- A failed or skipped start of an ask's run is logged and swallowed (`market_ask_run.go` `CreateAsk`; no production publication returns nil), so the ask has no time limit and the minute sweep (`step_limit.go` `SweepStepLimits`) never sees it. Turned into Q112.
- Decision 112's open-steps read for the caller has no human role to read: the only person-to-agency-role link is one `AgencyRoleID` on an agent's membership (`internal/agencies/member.go`, `agency_role_link.go` `errOnlyAgentsLink`). Turned into Q111.
- Event flow steps (`topics, consumer, handler_code`) are rows in the agency; the engine that consumes them was not found in the repos read (the task manager dropped its dispatcher, `mwanachama-backend-taskmanager/CLAUDE.md`: "has to be re-homed"). Open.
- Two Farmers joining the last bag at the same moment, the same message twice, an answer after a cancel: nothing found that fences them. The task manager guards its own writes with compare-and-swap on the failure budget and `AND deleted = false` updates; nothing like that is declared for an order's lines. Open.
- Run costs in model calls and who pays: the Test page says one token pool; no counter was found. Open.
- A member's chat post starts nothing: no code reads a post and calls the agent (HS643 plans it), and the agency's weekly allowance on the agent's account is shared by every member of the chat; what she sees when it runs out is undecided. Turned into Q153.
- Who may do a step at run time: roles carry `permissions` (`agency.blueprint.json` role.permissions), checked by whoever mounts; no step names a permission. Open.
- A Farmer who is removed from a group while holding bags in an order under way, or who wants to change them: no tool or rule found; the client in `submission/code/market/market.go` has join and revision calls only. Closed for the product half on 2026-10-29, decision 92. The write fence between a join and the coordinator's Send (one transaction over the order's lines, or a version on the order row) is an engineering need either way and is open.
- A waiting person who never answers (a buyer's ask) has no closing time in the market client's Ask type (`submission/code/market/market.go` line 52). Closed on 2026-10-29, decision 99 (a time limit in the workflow); the sweep index is an engineering need.
- The only sweep of runs that wait too long is `mwanachama-backend-taskmanager/workflow_run_watchdog.go` `ListWorkflowRunsStaleSince`: no caller loops it in the repos read, no ORDER BY, and finished runs are dropped in Go after `Limit(500)`; a finished run keeps matching because only `MarkTimeoutPublished` sets `timeout_published`. After 500 finished orders older than the cutoff the page can hold nothing but finished runs and every waiting order is missed. Decision 99's time limit depends on this sweep. Open; the lateness the person sees is turned into Q90; the query and index fix is build work.
- One sweep per agency: the task board is one table set per agency, so a sweep that serves decision 99 visits each agency that has a step with a time limit, not one table. The published version tells which; it is already cached 30 seconds in `module_switch.go`. Open; part of Q90's cost.
- A Route step has no start and no rule for answers that change: forms lets a farmer resend until close. Turned into Q94.
- A Payments row is written by the agency owner role only at the route (`record_rows.go` `callerMayAddRows`), while the record names its own role and the agency module checks that role (`CreateRecordRow`); the two checks disagree for a Group coordinator who is not an owner. Open; build finding.

- An approved proposal is carried out by `applyApproved` (`mwanachama-wakala-api/internal/api/http/approvals_apply.go`) in two steps, apply then `RecordApplied`; if the process stops between them the row stays approved with `applied` empty and a second Decide is refused as already decided. On a failed apply `Reopen` makes it pending again with no undo of steps already taken. Open; build finding.
- A proposal of a kind with no applier (`approvalAppliers` has 15; none for a record row, a workflow, a step or a record) is marked approved and nothing is written: `applyApproved` returns it unchanged. The agent's proposed Payments row (Q74) would be approved and lost. Open; build finding.
- An approved change lands in `workingDraftID`: whichever draft is open when the owner decides, or a new draft called "Approved proposals"; the proposal does not remember the draft it was written against. Consistent with decision 58; open as a build note.
- Only an agency owner decides an approval (`approvals_routes.go` `decideApproval` calls `mustOwnAgency`); a Group coordinator who is not an owner cannot approve a row proposed to her. Part of Q74; open.

- A module switched off by Publish is cut off for orders under way: the gate reads the production channel's latest publication, not the order's version, and the answer lags up to 30 seconds per server because Publish does not clear it (`mwanachama-wakala-api/internal/api/http/module_switch.go`). Turned into Q107.

Log
- Review run (decision 105): a finding's Apply runs the stored tool and arguments with no check that the row is as the reviewer read it (`agency.blueprint.json` `review_finding`; `reviewruns/runner.go`). Turned into Q108.
- The step-limit closing and a person's answer race with no condition: `workflow_run.go` `saveRun` writes every column by id, `closePastLimit` saves a run it read before opening the cancel run, `AnswerWorkflowRunStep` saves a run it read before the close, so a closed run can be written back open (or an answer lost) and the notice goes out from the stale list; two wakala-api replicas run the sweep with no lock (`cmd/server/step_limit_sweep.go`) and can close and tell one run twice. Turned into Q144. Evidence: `mwanachama-backend-taskmanager/workflow_run_step_limit.go` 62-130, `mwanachama-wakala-api/internal/agencies/step_limit.go` 117-135.

## 2026-10-29 15:00 UTC

Read taskmanager blueprint and CLAUDE.md, agency event_flow_step. The run engine itself is not in the repos read.

## 2026-10-29 17:10 UTC

Looked at the group order join path from the app screen to the client.

## 2026-10-29 17:35 UTC

Read the market client's Ask and AnswerAsk: no time, no expiry.

## 2026-10-29 20:40 UTC

Read the task manager's watchdog helpers and the `workflow_run` blueprint for the time limit of decision 99. Found the sweep that is blind after 500 finished runs, and that nothing calls it. Q90 added.

## 2026-10-30 00:30 UTC

Added the Route start gap (Q94).

## 2026-10-30 02:40 UTC

Noted the role check mismatch on row adds.

## 2026-10-30 16:40 UTC

Traced rollback and the run's version pin: `SetPublicationChannel` touches no run (decision 95), and the step-limit read at step start is the pin's one reader. Opened one gap and performance entry 29; no new owner question.

## 2026-10-30 18:35 UTC

Read approvals (store, apply, routes) for the agent-proposes path: three build gaps, no new question.

## 2026-10-31 00:40 UTC

Traced the run-another-workflow step from the draft save to the scan to wakala-api. Opened the loop gap; turned into Q105.

## 2026-10-31 04:45 UTC

Traced the Modules page switch to the production gate. One gap, turned into Q107.

## 2026-10-31 06:40 UTC

Traced the Review page's run from `review_runs.go` through `reviewruns/service.go`, `runner.go` and the agency's `review_start_impl.go`. One gap, turned into Q108. Reviewers run as goroutines inside the API process, one per part; a part left reading when the process stops is picked up by `Resume` after `reviewResumeDelay`.

## 2026-11-01 20:35 UTC

Traced decision 112's read of the caller's roles and open steps and found no human role link; traced the one run starter (`StartAskRun`). Corrected the stale bullet that said no run starter exists. Gaps turned into Q111 and Q112.

- Two leaders deciding one join request: safe. The decision is a compare-and-swap on pending state in one transaction (`mwanachama-backend-actor/join_impl.go` lines 307-352), the loser gets `ErrJoinRequestDecided`. What the loser's Inbox row shows afterwards is not drawn. Open; turned into Q119 for the Vice Admin case.

## 2026-11-02 16:40 UTC

Read the decide path in actor; no change to earlier entries.

## 2026-11-02 20:40 UTC

Same trace as backends.md; no change to earlier entries.

## 2026-11-03 12:45 UTC

- A called-off order's pickers are told after the call-off is written, outside its transaction, and a failed re-read or `Raise` is swallowed or only logged (`mwanachama-wakala-api/internal/api/http/market_announced_calledoff.go`, `market_names.go` `raiseNamed`): the order can be called off with farmers never told, and nothing retries. Open; cost in performance.md entry 36. The join race on the last bag stays open: `mwanachama-backend-market` is not checked out.

## 2026-11-04 UTC

Traced what a clock can start. The sweep makes plain tasks only; no schedule start for a workflow run. Opened one gap, turned into Q128.

## 2026-11-04 20:40 UTC

Traced the group order join against the built page (GroupOrderPage.tsx, api.ts); market module unreadable. Opened one gap, turned into Q134.

## 2026-11-05 UTC (seventh run)

Money rows: a correction is append-only (the replaced row stays), but the one-correction and no-duplicate rules are read-then-insert with no transaction, so two simultaneous coordinators can both succeed. Turned into Q141; open. Evidence: `mwanachama-backend-agency/record_row_correction.go`, `record_impl.go` `CreateRecordRow`.

## 2026-11-06 UTC

Traced the member app's offline send (outbox, drafts, worker) against the forms submit. Opened the silent lost save (Q142), the one-draft-per-form key for field sheets, and the missing idempotency key. The offline shell caches only built assets; no API read is cached (decision 147), which matches the design.

## 2026-11-06 UTC (second run)

Traced the step limit sweep end to end (limitedBoard, SweepStepLimits, CloseWorkflowRunsPastLimit, the step_due index). The index and the 500 page cap are sound; the closing and the answer are unconditional full-row writes. Opened one gap, turned into Q144. Read from code, not run.

## 2026-11-06 UTC (third run)

Traced the paid mark on a form send (forms MarkPaid, writeSubmission, replace, the submission blueprint and its two indexes). The mark and the resend race on a whole-row write; the blueprint's promise that a resend leaves the mark alone holds only without a tie. Q146 asked. Not found: any test that runs the two together.

## 2026-11-07 UTC (third run)
Traced the step update path from the studio chat shortcut to `writeUpdate` (agency work_item update, dispatch whole-body bind). One gap opened, turned into Q148.

## 2026-11-07 UTC (fourth run)

Traced decision 147's Ask in Chat to the room and the missing answering agent; weekly limits in the AI gateway tests; opened the allowance question, Q153.

## 2026-11-08 UTC

Read the market module for the first time (join, send, mark paid, revise). A group order's state change is compare-and-swap; line writes are not. Opened the lists' name lookup (Q159) and the line races in backends.md. Read the AI module's limit check: per account and role only, rolling week; Q153 now carries a recommendation.

## 2026-11-08 UTC (market orders, quotes, asks)
Read orders.go, quotes.go, asks.go, workflows.go gate and workflow. Found that no caller wires the published workflows into the market, opened the version, race, yes and double-tap gaps. Two turned into Q160 and Q161.
