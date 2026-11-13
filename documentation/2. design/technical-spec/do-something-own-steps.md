# Start: each member's own steps

The screen is reached from Start on Home (D154, which D155 left in place); the app has no Do Something button. Decided with the owner on 2026-11-05, after the phone app proved to open only the farmers' Create group order step. It applies to every `fill_form` step of every agency, and from 2026-11-11 to every `send_form` step and `route` fork.

## The rules

1. **Only your own steps.** The Start list shows a member the fill-form steps whose role the workflow names for a role she holds. A form that is not hers is neither listed nor accepted: the API refuses a send from a member without the step's role with 403, whoever else she is in the agency.
2. **Send moves the task on.** A send saves the answers as a row of the step's register. The row on the sender's list then shows `Sent`, and the run now waits for the next role: that person's Start list shows the next step.
3. **A sent form is answered by its recipient.** A `send_form` step names no role of its own; the role it is sent to (`recipient_role_id`) is the role that lists it, answers it and owns its register.
4. **A route sends the run down one branch.** A `route` step is the agency's own and is never listed. Once its sent form is answered, the run is offered the one step the first matching route goes to; the steps its other routes go to are skipped, and the run rejoins at the step after them. When no route matches, all of those steps are skipped, which is how the step named as the otherwise is reached.
5. **Any step, any agency.** The step's role and questions come from the published workflow, so no screen or tool is written per agency. Publishing makes a register for each fill-form step; an agency published earlier has none until it is published again, and a send for such a step is refused with a conflict that says so.

An earlier plan, one form per step aimed at the hub's root group, was dropped: a form reaches every member of the group it is aimed at, so anyone in the hub could have filled any form.

## What exists

| Part | Where | What it does |
|---|---|---|
| List my steps | `agency_list_my_open_steps` with `available` true | Returns the steps the caller can act on now: a workflow's first step (`state` start) and a later step whose run waits for her role (`state` waiting, with the run's `order_id`) |
| Send a step | `agency_submit_step_answers`, `POST /instances/{agency}/steps/{step}/answers` | Checks the role, checks the answers against the step's questions, saves the row and returns the next step |
| Start list | `code/app/src/home/StartRows.tsx` | Adds a row for each listed step that has no screen of its own |
| Step page | `code/app/src/steps/StepPage.tsx`, route `/a/<agency>/steps/<step>` (`routes.step`), with `?order=` for a waiting step | Shows the step's prompt and the earlier work (`EarlierWork.tsx`), builds the form from the step's questions, checks required answers and a number or currency, sends, then returns to Start |
| Questions | `code/app/src/forms/QuestionInput.tsx` | The question inputs the forms page already used, now shared |
| Send lock | `step_runs.go` (`stepSendLocks`) | A later step's send takes a lock on the agency and the run's `order_id`, so two sends at the same moment give one 201 and one 409 |
| Multi-select answers | `step_runs.go` (`resolveStepAnswers`) | A multi-select answer may be a list of options or one string; each option must be one the question offers (400 otherwise), and the row stores them joined by a comma and a space. A list for any other question type is refused with 400 |
| Register names | `step_records.go` (`stepRecordNames`) | Each fill-form step has its own register, named by its title. Two steps of one workflow with the same title get `Check` and `Check (2)`, in step order, so neither overwrites the other's questions |

The two tools, the register, the run's `order_id` and the checks are described in [Form steps](04-tools-and-apis/README.md#form-steps); this page does not repeat them.

## What the member sees

- A step with a screen of its own keeps it: the form named `Create group order`, the market steps and chat-workflow steps open their own screens. Every other fill-form step opens the step page, whatever its questions are: the farmers' `Group fertilizer order`, with its free-text, currency and number questions, gets the step page.
- The step page is titled with the form's name and, under it, the workflow's name. When the step has a description, the page shows it first inside the card, so the member can tell what the step asks of her before she answers; `agency_list_my_open_steps` and the `next_step` of a send carry it as `description`. After the description the page shows the step's prompt, what the member is meant to do, and for a step that waits on her role the earlier work (`EarlierWork.tsx`): one block per earlier step of the same run, with its title, the role that sent it and each question with its answer, in the step's order, unanswered ones left out. The reply carries them as `prompt` (omitted when empty) and, for a waiting step in the `available` listing, `earlier`. Send is checked on the phone first: a required question left empty says `This question needs an answer`, a number or currency that is not a number says `Enter a number`.
- Council lists. The council meeting steps of the Hungarian municipality carry a button to a read-only list: the step about the late matters (WI-40-4) opens Late matters at `/council/late-matters` (`routes.lateMatters`, `council/LateMattersPage.tsx`), the longest late first, each row with its title, place, owner department and days late; the step about the risk section (WI-64-6) opens Council risks at `/council/risks` (`routes.councilRisks`, `council/CouncilRisksPage.tsx`), overdue actions first, then every risk with its owner and status. The step is matched by its title, and the lists need the permissions `late_matters.read` and `risk.read`, which the Mayor / council chair holds. The hub-steward repo has no navigation-chart.md, so the two screens are listed here.
- Amending the earlier work. On a waiting step the earlier work is not only read: `AmendDraft.tsx` gives each earlier answer Change, Strike out and Keep, and the edits live in the page until Send. `amend.ts` turns each edit into an extra answer keyed `Changed: <step title>: <question>`, with the value `Changed from "<was>" to "<now>"` or `Struck out "<was>"`, and sends it in the same send as the step's own answers. The saved row already carries who sent it and when, so who changed what and when is recorded. The API lets a prompt that starts with `Changed:` through `validateRowAnswers`; any other prompt the step does not ask is still refused. The next role still sees the original draft, and an edit is lost if the page is reloaded before Send.
- A refusal from the API is shown on the page in words: not for your role (403), not ready or already sent, check your answers (400), could not be opened (404). A role refusal offers Go to Start and a not-ready refusal offers Go to Ongoing, buttons under the words. The API client reads a 409 as already sent, so it never reaches the page as a refusal.
- After a send the member is returned to Start, where the row shows `Sent` and cannot be opened again. Under the title the row says `Next: <role>` when the run goes on to another role, `Done` when the send finished the task, and nothing after a 409. The mark and that line are kept in the phone app's memory, per agency, per step and per run. The send returns the run's `order_id` and the sent run is marked under it, so the step list the app reads leaves out a first step she has sent in this session and the sent run shows as one `Sent` row, never beside a second open row of the same name. The API still lets a first step start another run, so the row comes back as a fresh start after a reload. If a reply carries no `order_id`, the app uses a local id so the start row is never blocked.
- A step is sent once per run whichever API process takes the request. Each step row carries a `send_key` (the step's record code and the run's `order_id`), and the `record_row` object declares a unique index on it that ignores retired rows and rows with an empty key. The second send of the same step in the same run hits the index and is answered 409 `that run is not waiting for this step`, as the in-process lock already did for two sends on one process. The lock stays so most losers are turned away before they write. Rows written before the key existed have an empty key, so a database that already holds two rows of one step starts and keeps them; only new sends are guarded.

## Approving in your own name

Decided with the owner on 2026-11-13. A step that asks the member to approve in their own name records who approved and when, put there by the server.

- **Which step.** A form step whose title, description or prompt has `approv*` before "own name" or "by name" in one sentence (`isApprovalStep`, `wakala-api/internal/api/http/approval_step.go`). No template change is needed.
- **What the member sees.** The open-steps reply carries `approval: true`. The step page shows `ApproveInOwnName.tsx`, `You approve this in your own name, as <name>.`, and the Send button reads Approve. The Done list shows `Approved by <name>` (`started/done.ts`).
- **What the server adds.** On send the row gets the answers `Approved by`, the signed-in member's display name (the actor of the session), and `Approved at`, the time in UTC RFC3339. A request that answers either prompt is refused with 400, and so is an approver without a display name. `modules/agency/approval_stamp.go` lets the two prompts past `validateRowAnswers`.
- **Who sees it next.** The next role's `earlier` and `agency_list_my_sent_steps` carry both answers.
- **Before it can be seen.** wakala-api and the app need a restart, and the approving member's actor needs a display name.

## The approval limit on a step

Added with MUN795. A step question can carry `checks_approval_limit`, and the server then holds the sender to the limit written to their role.

- **The question.** A currency question with `checks_approval_limit: true` (`StepQuestion.ChecksApprovalLimit`), such as the municipality template's WI-56-6 "What amount are you approving, in forints?".
- **What the member sees.** The open step carries `approval_limit {amount?}` in `my-open-steps` and `agency_list_my_open_steps` (`step_approval_limit.go`). The step page shows it in `ApprovalLimitNote.tsx`. No amount means no limit is written to any of the member's seats.
- **What the server refuses.** A send whose amount is above the limit is answered 422 `The amount 720 000 Ft is above the limit of 500 000 Ft written to your role. Another role must approve it.` A non-numeric or negative amount is answered 400 (`step_approval_refusal.go`). The app shows the 422 sentence as it is and keeps the answers (`overLimitRefusal.ts`).
- **Which limit.** The largest active seat limit of the session's caller, never a figure in the request. Limits are written with `actor_set_approval_limit`.

## Not yet built

- A question answered with a photo or a file: the step page cannot send one. A required photo or file question stops the send with a sentence saying so.
- `Sent` is kept in the phone app's memory only. After a reload a waiting step's row is gone from the sender's list, because the API no longer lists the run for her; a first step comes back as a fresh start.
- The phone app still sends a multi-select answer as one string of its labels joined by a comma and a space; a label that holds a comma is split in two and refused, so only a list is exact.
- A step of a kind other than `fill_form` and `send_form` (a notice, a yes or no, a chat) is still skipped by the run.
- A branch is chosen from the first row of the sent form in a run; a second row for the same step does not change it.
- Agencies published before this change need publishing again before their steps can be sent.
- The same change is not yet carried into Mwanachama's own wakala-api repository.
