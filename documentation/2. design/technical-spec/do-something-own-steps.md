# Start: each member's own steps

The screen is reached from Start on Home (D154, which D155 left in place); the app has no Do Something button. Decided with the owner on 2026-11-05, after the phone app proved to open only the farmers' Create group order step. It applies to every `fill_form` step of every agency, and from 2026-11-11 to every `send_form` step and `route` fork.

## The rules

1. **Only your own steps.** The Start list shows a member the fill-form steps whose role the workflow names for a role she holds. A form that is not hers is neither listed nor accepted: the API refuses a send from a member without the step's role with 403, whoever else she is in the agency.
2. **Send moves the task on.** A send saves the answers as a row of the step's register. The row on the sender's list then shows `Sent`, and the run now waits for the next role: that person's Start list shows the next step.
3. **A sent form is answered by its recipient.** A `send_form` step names no role of its own; the role it is sent to (`recipient_role_id`) is the role that lists it, answers it and owns its register.
4. **A route sends the run down one branch.** A `route` step is the agency's own and is never listed. Once its sent form is answered, the run is offered the one step the first matching route goes to; the steps its other routes go to are skipped, and the run rejoins at the step after them. When no route matches, all of those steps are skipped, which is how the step named as the otherwise is reached.
5. **Any step, any agency.** The step's role and questions come from the published workflow, so no screen or tool is written per agency. Publishing makes a register for each fill-form step; an agency published earlier has none until it is published again, and a send for such a step is refused with a conflict that says so.

## Who may do what to a row

Built for ISS-158 (D11, D19, D33, D42 to D44, D69, D72, D77). The row check is one function, `callerMayDoRow` in `code/wakala-api/internal/api/http/row_decision.go`, and every path that reads or writes a row asks it. It answers from the caller, the action, the record and the field.

| Question | Answer |
|---|---|
| Whose roles count | Only the roles seated for the person in the group the person has assumed, read by the one role resolver (ISS-188). A seat in another group gives nothing. With no assumed group, or a disabled one, nothing is allowed |
| Where the codes are read | From the published version of each role, not the draft (D77). A role of an agency never published grants nothing |
| The codes asked | `record.<code>.add.<field>` or `add.*` to add, `edit.<field>` or `edit.*` to edit, `view.<field>` or `view.*` to see rows, and `record.<code>.delete` to delete, which has no field part (D29). The star covers every field the record has at the time of the check (D30) |
| The owner | The platform owner has no pass on rows. The owner assumes a group like anyone and needs a seat in a role that carries the codes (D11, D19, D42). Membership still decides who may write directly through the live-records add route, which stays closed to everyone but the owner |
| Add and edit need no view | A role may add or edit a field without holding view for it (D43, D44) |
| The row part | Which rows are reached is the reach rule of ISS-189 (`row_reach.go`): a shared tag, or the system tag `all`. The decision function calls it and compares no tags itself. A row that names a person, or that the person added, is not reached for that reason (D47), so the rows list shows nothing to a person with no view code even on a row that names them |
| Which paths ask | The generated Add, Edit and Delete steps, the direct add and edit on the live-records route and the tool `agency_add_live_record_row`, the `can_add_rows` flag of the record list, the rows list and the tool `agency_list_live_record_rows`, and the row a designed form step writes, which needs an add code of its derived record (D69). The designer's routes and tools `agency_create_record_row`, `agency_list_record_rows`, `agency_add_record_row_tag`, `agency_retire_record_row` and `agency_return_record_row` ask the same codes and the same reach, with no owner shortcut (D72) |
| Not settled, so unchanged | Which code a send back needs, and whether it needs the rows of the run reached, is question 9 of the row paths inventory and no decision answers it, so `sendBackStep` still asks only the step's role and the designer's return route asks only reach. The subject step's own rule is ISS-159 |
| What the check asks of a path | The path asks for any field of the action. The fields a role may add or edit within a row, the required field it cannot add and the fields shown on a read are ISS-192, ISS-193 and ISS-191 |

The catalogue pass that lets the owner use the catalogue's tools is not about rows and is untouched.

### Who holds a generated step (D33, D42, D75, ISS-157)

The Add, Edit and Delete steps of a record (`record.<code>.add.1` and so on) hold no role of their own. They are listed for every role that carries the codes the step stands for, through a seat the person holds in the group she has assumed; a person who has assumed no group is offered no step, and a seat in another group does not count. A generated step shows to every holder, so two roles that both carry the codes both see it.

| Step | A role holds it when it carries |
|---|---|
| Add | `record.<code>.add.*`, or an `add.<field>` for every required field of the record (D75, D31, D51). A record with no required field: `add.*` or at least one `add.<field>` |
| Edit | `record.<code>.edit.*` or at least one `edit.<field>` |
| Delete | `record.<code>.delete` |

A role that carries `add` for only some of the required fields does not hold the add step. The record of a step is read from the workflow's `generated_for`, never from the step's code. One function, `roleHoldsGeneratedStep` in `step_holders.go`, decides the rule; the open and available lists (`caller_open_steps.go`) and the step board (`requireHeld` in `step_role_board.go`) call it, so a change to the rule is made in one place. The row the step then adds, edits or deletes is checked by the row check of ISS-158, not here. A designed step is unchanged: it keeps its one role, held through the seats of the assumed group.

An earlier plan, one form per step aimed at the hub's root group, was dropped: a form reaches every member of the group it is aimed at, so anyone in the hub could have filled any form.

## What exists

| Part | Where | What it does |
|---|---|---|
| List my steps | `agency_list_my_open_steps` with `available` true | Returns the steps the caller can act on now: a workflow's first step (`state` start) and a later step whose run waits for her role (`state` waiting, with the run's `order_id`) |
| Send a step | `agency_submit_step_answers`, `POST /instances/{agency}/steps/{step}/answers` | Checks the role, checks the answers against the step's questions, saves the row and returns the next step |
| Start list | `code/app/src/app/home/StartRows.tsx` | Adds a row for each listed step that has no screen of its own, except the start step of a workflow that names a subject record (see A workflow that runs on one row) |
| Step page | `code/app/src/features/steps/StepPage.tsx`, route `/a/<agency>/steps/<step>` (`routes.step`), with `?order=` for a waiting step | Shows the step's prompt and the earlier work (`EarlierWork.tsx`), builds the form from the step's questions, checks required answers and a number or currency, sends, then returns to Start |
| Questions | `code/app/src/features/forms/QuestionInput.tsx` | The question inputs the forms page already used, now shared |
| Send lock | `step_runs.go` (`stepSendLocks`) | A later step's send takes a lock on the agency and the run's `order_id`, so two sends at the same moment give one 201 and one 409 |
| Multi-select answers | `step_runs.go` (`resolveStepAnswers`) | A multi-select answer may be a list of options or one string; each option must be one the question offers (400 otherwise), and the row stores them joined by a comma and a space. A list for any other question type is refused with 400 |
| Register names | `step_records.go` (`stepRecordNames`) | Each fill-form step has its own register, named by its title. Two steps of one workflow with the same title get `Check` and `Check (2)`, in step order, so neither overwrites the other's questions |

The two tools, the register, the run's `order_id` and the checks are described in [Form steps](04-tools-and-apis/README.md#form-steps); this page does not repeat them.

## What the member sees

- A step with a screen of its own keeps it: the form named `Create group order`, the market steps and chat-workflow steps open their own screens. Every other fill-form step opens the step page, whatever its questions are: the farmers' `Group fertilizer order`, with its free-text, currency and number questions, gets the step page.
- The step page is titled with the form's name and, under it, the workflow's name. When the step has a description, the page shows it first inside the card, so the member can tell what the step asks of her before she answers; `agency_list_my_open_steps` and the `next_step` of a send carry it as `description`. After the description the page shows the step's prompt, what the member is meant to do, and for a step that waits on her role the earlier work (`EarlierWork.tsx`): one block per earlier step of the same run, with its title, the role that sent it and each question with its answer, in the step's order, unanswered ones left out. The reply carries them as `prompt` (omitted when empty) and, for a waiting step in the `available` listing, `earlier`. Send is checked on the phone first: a required question left empty says `This question needs an answer`, a number or currency that is not a number says `Enter a number`.
- Council lists. Steps of an agency's council meeting can carry a button to a read-only list: the step about the late matters opens Late matters at `/council/late-matters` (`routes.lateMatters`, `council/LateMattersPage.tsx`), the longest late first, each row with its title, place, owner department and days late; the step about the risk section opens Council risks at `/council/risks` (`routes.councilRisks`, `council/CouncilRisksPage.tsx`), overdue actions first, then every risk with its owner and status. The step is matched by its title, and the lists need the permissions `late_matters.read` and `risk.read`, which the council chair role holds. The hub-steward repo has no navigation-chart.md, so the two screens are listed here.
- Amending the earlier work. On a waiting step the earlier work is not only read: `AmendDraft.tsx` gives each earlier answer Change, Strike out and Keep, and the edits live in the page until Send. `amend.ts` turns each edit into an extra answer keyed `Changed: <step title>: <question>`, with the value `Changed from "<was>" to "<now>"` or `Struck out "<was>"`, and sends it in the same send as the step's own answers. The saved row already carries who sent it and when, so who changed what and when is recorded. The API lets a prompt that starts with `Changed:` through `validateRowAnswers`; any other prompt the step does not ask is still refused. The next role still sees the original draft, and an edit is lost if the page is reloaded before Send.
- A step that reviews earlier work. When a step carries earlier work, the card opens with one plain line, `Read the work so far, then give your decision.`, ahead of the description. A `Work so far` heading (the shared `SectionHeading`) sits over the earlier steps and a `Your decision` heading over the step's own questions, so the member's part is named and starts near the top. Change, Strike out and Keep are small text buttons (`Button` kind `text`) at the end of each answer's own row (`.amend-row` in `amendDraft.css`); a struck answer reads struck through. A step with no earlier work shows neither the line nor the headings. A step that can be sent back also names its decision, see Approve or send back.
- **Earlier answers follow the view codes (D67, D22).** `earlierStepsOf` keeps an earlier answer only when the person holds `record.<code>.view.<field>` or `record.<code>.view.*` for that field in the published version, through one `fieldView` read from the roles of the assumed group. A field she may not view is left out, and so is a `Changed:` answer about it; an earlier step left with no answer is not listed. A person with no view codes still gets the step, with no Earlier work. The Approved by and Approved at stamps are not fields of the record and are still listed.
- A refusal from the API is shown on the page in words: not for your role (403), not ready or already sent, check your answers (400), could not be opened (404). A role refusal offers Go to Start and a not-ready refusal offers Go to Ongoing, buttons under the words. The API client reads a 409 as already sent, so it never reaches the page as a refusal.
- After a send the member is returned to Start, where the row shows `Sent` and cannot be opened again. Under the title the row says `Next: <role>` when the run goes on to another role, `Done` when the send finished the task, and nothing after a 409. The mark and that line are kept in the phone app's memory, per agency, per step and per run. The send returns the run's `order_id` and the sent run is marked under it, so the step list the app reads leaves out a first step she has sent in this session and the sent run shows as one `Sent` row, never beside a second open row of the same name. The API still lets a first step start another run, so the row comes back as a fresh start after a reload. If a reply carries no `order_id`, the app uses a local id so the start row is never blocked.
- A step is sent once per run whichever API process takes the request. Each step row carries a `send_key` (the step's record code and the run's `order_id`), and the `record_row` object declares a unique index on it that ignores retired rows and rows with an empty key. The second send of the same step in the same run hits the index and is answered 409 `that run is not waiting for this step`, as the in-process lock already did for two sends on one process. The lock stays so most losers are turned away before they write. Rows written before the key existed have an empty key, so a database that already holds two rows of one step starts and keeps them; only new sends are guarded.

## Many sheets on a record step

Built 2026-11-16 (MUN845a in wakala-api `8ca493e6`, MUN845b in the app `437f1e8d`). A step that records answers a person brings back, such as the district clerk's `We record the answers that arrived on paper`, takes one sheet for each name, so forty sheets no longer need forty runs of the workflow.

- **The request.** `agency_submit_step_answers` and `POST /instances/{agency}/steps/{step}/answers` take `another_sheet: true` with the run's `order_id`. The first sheet is an ordinary send. Every further sheet is a send with `order_id`, `another_sheet` true and a `send_key` made for that sheet.
- **What the server does.** It writes one more row to the step's register under the same `order_id`, taking the same lock on the agency and the run as a later step does. The row's `send_key` is the record code, the `order_id` and `:sheet:` with the request's `send_key` (a fresh id when none is sent), so sending one sheet twice with the same key is answered 409 and writes one row. The reply is the ordinary one, with the run's next step.
- **What it refuses.** No `order_id` is 400 (`order_id names the run the sheet is added to`). A step the run has not yet sent is 409, `that run is not waiting for this step`, because a first sheet is not another sheet. An approval step (`isApprovalStep`) is 400, because an approval is decided once. The role check, the answer checks and the approval limit apply to every sheet as they do to a first send.
- **The phone card.** The step page treats a step as a record step when one of its questions starts with `On whose behalf`. After Send on such a step the page stays and shows a card: `Sheets recorded: N`, `Add another sheet` and `Finished`. Add another sheet clears the `On whose behalf` answer, keeps the other answers, makes a new send key and shows the form again; the next Send goes out with `order_id` and `another_sheet` and raises the count. Finished sets the `Next: <role>` line of the last reply on the row, which the first Send already marked `Sent`, and returns to Start. Every other step keeps the single send and the return to Start.
- **Early visibility.** The run moves on at the first sheet: the first send writes the row, the next role's Start list shows the next step from then, and Finished tells the server nothing. The next role can therefore open the order after sheet 1, before the clerk has entered the rest, and rows added afterwards appear in the register as they are sent. Holding the order until Finished needs a new `record_row` column that says the step is closed, and it is not built.
- **Leaving before Finished.** The first Send already marks the row `Sent` on Start, without the `Next: <role>` line; Finished adds that line. If the clerk leaves the card by Back, every sheet already sent stays in the register and the row stays `Sent` without the line. The count lives in the page, so it restarts at 0 on a reload, and the row cannot be opened again to add a sheet.

## Approving in your own name

Decided with the owner on 2026-11-13. A step that asks the member to approve in their own name records who approved and when, put there by the server.

- **Which step.** A form step whose title, description or prompt has `approv*` before "own name" or "by name" in one sentence (`isApprovalStep`, `wakala-api/internal/api/http/approval_step.go`). No template change is needed.
- **What the member sees.** The open-steps reply carries `approval: true`. The step page shows `ApproveInOwnName.tsx`, `You approve this in your own name, as <name>.`, and the Send button reads Approve. The Done list shows `Approved by <name>` (`started/done.ts`).
- **What the server adds.** On send the row gets the answers `Approved by`, the signed-in member's display name (the actor of the session), and `Approved at`, the time in UTC RFC3339. A request that answers either prompt is refused with 400, and so is an approver without a display name. `mwanachama-backend-agency/approval_stamp.go` lets the two prompts past `validateRowAnswers`.
- **Who sees it next.** The next role's `earlier` and `agency_list_my_sent_steps` carry both answers.
- **Before it can be seen.** wakala-api and the app need a restart, and the approving member's actor needs a display name.

## The approval limit on a step

A step question can carry `checks_approval_limit`, and the server then holds the sender to the limit written to their role.

- **The question.** A currency question with `checks_approval_limit: true` (`StepQuestion.ChecksApprovalLimit`), such as "What amount are you approving?" on an approver's step.
- **What the member sees.** The open step carries `approval_limit {amount?}` in `my-open-steps` and `agency_list_my_open_steps` (`step_approval_limit.go`). The step page shows it in `ApprovalLimitNote.tsx`. No amount means no limit is written to any of the member's seats.
- **What the server refuses.** A send whose amount is above the limit is answered 422 `The amount 720 000 Ft is above the limit of 500 000 Ft written to your role. Another role must approve it.` A non-numeric or negative amount is answered 400 (`step_approval_refusal.go`). The app shows the 422 sentence as it is and keeps the answers (`overLimitRefusal.ts`).
- **Which limit.** The largest active seat limit of the session's caller, never a figure in the request. Limits are written with `actor_set_approval_limit`.

## Approve or send back

Decided by the owner on 2026-11-23 (IAS decision 17).

- **What Send back does.** For now it goes back one step: the run reopens the previous step for the role that holds it, with the sender's reason attached. Where work goes after a send-back is to be designed in the workflow itself and may branch to other targets later; that is a later issue and nothing here assumes one target.
- **What the member sees.** Under `Your decision` the member picks Approve or Send back, writes a reason and presses one button, the same shape as the Go or no-go form (a yes or no question, then Reason). There is no second button in the bottom bar. The one button reads Approve once Approve is picked, Send back once Send back is picked, and `Approve or send back` and disabled until one is picked.
- **How the step says so.** An open step that can be sent back carries `send_back {decision, reason}`: the prompt of the yes or no question that holds the pick (yes is Approve, no is Send back) and the prompt of the question that holds the reason. The app labels that question's two choices Approve and Send back (`approvalDecision.ts`) and reads no other step as sendable back; a step without `send_back` keeps Send, or Approve on an approval step.
- **What is checked.** Picking Approve checks every question as any send does. Picking Send back checks only the decision and the reason, which must be written; the member's edits to the earlier answers are not sent, because the role the work goes back to changes it.
- **What is sent.** Approve is the ordinary send of the answers. Send back is `StepsClient.sendBack(step, reason, sendKey)`, which posts `{order_id, reason, send_key}` to `POST /instances/{instance}/steps/{step}/send-back` and answers `{step_id, order_id, role_name}` for the step reopened. The refusals are the send's: 403 not for your role, 404 no such step, 409 not ready or already sent, 400 no reason. After a send back the page returns to Start and the sent list reads `Sent back to <role>`.
- **What the reopened step carries.** The reopened step, in the open steps of the role it goes back to, carries `sent_back {reason, role_name, at, answers}`: the sender's reason, the sender's role, when, and the answers the member gave before. The page opens with an info message above the card, `Sent back by <role> on <time>`, and the reason under it, and the form starts with those answers (a draft the member already saved wins over them). The shared `MessageBox` and the Edit prefill (`prefillOf`) draw it.
- **What the platform does.** `POST /instances/{instance}/steps/{step}/send-back` and the tool `agency_send_back_step` (action `instance.step.send_back`, open to every seated member) mark every current row of the previous step for the run as returned (`ReturnRecordRow` of the agency sibling, v0.1.5), so the step no longer counts as done and its send key is free; the previous step is the nearest earlier form step the run has sent, chosen by one replaceable function (`previousStepOf`), and the reason, the sender's name and the time are kept on the returned row. No row is written for the sending step. Each send back writes one audit entry, "sent a step back". A run whose first step is returned reopens that step in the same run. A step declares its prompts with `send_back_decision` and `send_back_reason` (both or neither, only on a form step with a role); the IAS agency names them on Approval for submission.
- **What the run does.** The previous step's row is marked returned with the reason, the sender and the time, so the run's next step is that step again, held by the same role; the sending step's row is not written. The role's open step carries `sent_back {reason, role_name, at}` and the answers it gave before. When she sends again the run reaches the approving step once more.
- **The send-back reason is a note, not a field (D68).** It is kept on the returned row as `returned_reason`, apart from the answers, and is read as `sent_back.reason` by whoever holds the reopened step whatever view codes she holds; no one else reads it. The sender reads it too (owner's answer, option 3): the row keeps the sender's name and gains a sender id, which needs a change in the agency sibling after ISS-218, so the sender's reader is not built yet and is a follow-up issue. The delete reason follows the same rule and is likewise not yet built as a note.
- **What is not built.** The platform has none of it: a row cannot be marked returned (`RecordRow` is in the agency sibling), `runsOf` counts a row as done for good and the send key `<record>:<order>` stays taken. This is a change to the agency sibling, a tag the hub imports and a route, so it is hub issue ISS-139 and not part of ISS-136.

## A workflow that runs on one row

Built for hub issues ISS-135 and ISS-143. A workflow can name a subject record, and each run of it is then about one row of that record, such as one tender. The run is never named by a title the member types: the row is the name.

### What the agency file says

| Part | What it does |
|---|---|
| `subject_record` on a workflow | The code of the record the workflow's runs are about, such as `RC-1` |
| Import | `POST /instances/import` refuses a file whose workflow names a `subject_record` the file does not hold, with 400 and the record's code in the words, and nothing is imported |
| A workflow without it | Behaves as it always did |

### Where a member starts it

| Question | Answer |
|---|---|
| Is it a start row in My work > Start? | No. A workflow with a subject record is left out of Start as a start row |
| Where is it started? | On the row's own page: the row page, or the picked row's detail in the record's list, has a collapsed section `Workflows` that lists the workflows whose subject is that record |
| Who sees the entry? | Only a member who holds the role of the workflow's first step. A member with no such role sees no Workflows section |
| What does the row hand over? | Tapping the workflow opens its first step with `?row=<row id>` in the page address, and the screen it was opened from as Back |
| Where does Back, and Send, return? | To the screen the step was opened from: the row's page when it was opened from a row page, the record's list on that row when it was opened from there |
| Does a start get used up? | No. The first step stays on offer for every row, after any number of runs, because each run is on a row |
| Do later steps show in Start? | Yes. A step of a subject run that waits for a member's role is a row in her Start list, as any waiting step is, and opens the run's step page |
| Edit and Delete | Stay with the row's facts and are not in the Workflows section |

### What the server does

| Step of the run | What happens |
|---|---|
| Starting | The first step needs `row_id` in `POST /instances/{agency}/steps/{step}/answers` and in `agency_submit_step_answers`. A missing `row_id`, a row of another record, a retired row and an id that does not exist are each refused with 400 and the row's record named, and nothing is written |
| Writing | The first row of the run is written with `subject_row_id`. The agency backend (`record_row_subject.go`) copies it onto every later row with the same `order_id` and refuses a row that names another. Nothing is stored beside the rows |
| Every later step | Takes no `row_id`; one sent with it is not read. It carries `record_code` (the subject record) and `row_id` (the row) in the open steps and in the `next_step` of the send before it |
| Sent back | A step sent back keeps its row. The run's row is read with returned rows included, so the reopened step and the step after it still carry `record_code` and `row_id` however many times it is sent back. A new run on a retired row is still refused after a send back |
| Runs open before the change | Keep working with the typed title. Their rows carry no `subject_row_id`, so each step shows with its own `record_code`, no `row_id`, the earlier answers (the typed title among them) and its full form, and each later step is sent without a row until the run finishes. Nothing is migrated or deleted, and only a new first step asks for the row |
| What a send returns | The top level `record_code` and `row_id` stay the step's own register and the row the send wrote; the subject is on `next_step` |

### What the step page shows

| Part | Behaviour |
|---|---|
| Title | The row's title sits under the step's heading, where the workflow's name sat for a step with no row. It is the title the row page draws (`rowTitleOf`) |
| The row's own questions | A question the row already answers is left out of the form. It is matched by the question's prompt text: when the row has a non-empty answer under the same prompt, the question is not asked again. The first step of a tender's workflow therefore does not ask for the tender's title |
| Where the row comes from | The first step takes it from `?row=` in the page address. A later step takes it from its own `row_id`, so a waiting step opens from Start without `?row=` |
| A step that is not a subject step | Keeps its plain form: a waiting step of a run started without a row, and any step of a workflow with no subject record |
| Send | The first send posts `row_id` with the answers; the later sends post only `order_id` |

### The fields on each reply

| Reply | Subject fields |
|---|---|
| Workflow list: `GET /instances/{agency}/workflows`, `agency_list_workflows` | `subject_record` |
| Open steps, plain: `GET /instances/{agency}/my-open-steps`, `agency_list_my_open_steps` | `subject_record` on every step of a subject workflow, and nothing else, because the plain list has no run |
| Open steps with `available` true, the start step of a subject workflow | `subject_record`, and `record_code` set to the subject record; no `row_id`, because no row is chosen yet |
| Open steps with `available` true, a waiting step of a subject run | `subject_record`, `record_code`, `row_id` |
| Send, `next_step` | `record_code`, `row_id` and `subject_record` of the step it names, when that step is a subject run's |

A waiting step of a run that has no row carries `subject_record` but no `row_id`.

### Known limits

- A subject start that was sent also shows in My work > Start as a `Sent` row, though the start itself is not listed there: the app keeps the mark of every sent step in its memory, and a sent run's mark names the run, which the open start step does not. The row clears when the phone app's memory does.
- The question match is by prompt text. A question whose prompt is spelled differently from the row's question, or a row whose question was renamed after the row was written, is asked again.
- A row page needs a `record` entry in the declared Home (agency-home.md, section 3) for the Workflows section to be reached. A subject workflow in an agency whose Home has no entry for the record cannot be started from any screen.
- A subject start opened without `?row=` (a copied link, a reload that lost the address) shows `This task has closed.`, because the page cannot tell which row it is on.
- The Workflows section lists the workflows of the row's record only; a workflow whose subject is another record is not shown on this row.


## Not yet built

- A question answered with a photo or a file: the step page cannot send one. A required photo or file question stops the send with a sentence saying so.
- `Sent` is kept in the phone app's memory only. After a reload a waiting step's row is gone from the sender's list, because the API no longer lists the run for her; a first step comes back as a fresh start.
- The phone app still sends a multi-select answer as one string of its labels joined by a comma and a space; a label that holds a comma is split in two and refused, so only a list is exact.
- A step of a kind other than `fill_form` and `send_form` (a notice, a yes or no, a chat) is still skipped by the run.
- A step that closes after the last sheet: the run is offered to the next role after sheet 1 and Finished is only on the phone (see Many sheets on a record step).
- A branch is chosen from the first row of the sent form in a run; a second row for the same step does not change it.
- Agencies published before this change need publishing again before their steps can be sent.
- The same change is not yet carried into Mwanachama's own wakala-api repository.
