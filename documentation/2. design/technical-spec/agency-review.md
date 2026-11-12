# Review an agency

A designer with a finished draft presses one button and AI reviewers read the whole draft at once, one reviewer for each part of it. Their findings are saved in the database, shown as a card for each part that opens that part's page, and read again by the next review. Decisions 105 and 107 bind this page.

It is a separate page. It is not the Review stage of [journey 26](../../1.%20requirements/user-journeys/26-design-an-agency/README.md) (experts, sign-offs and a hold on Publish); that journey can later be built on top of this one.

## What the designer does

| Step | The designer | What she sees |
|---|---|---|
| 1 | Opens Review, its own row in the Agency group above Publish, under a divider | With no review yet, one card that says so, with Run review inside it. Otherwise the latest review, as a card for each part. Under the Review row the menu lists the parts. |
| 2 | Presses Run review | One progress card, "Reading 3 of 7 parts". Nothing else shows until every reviewer has finished. She may leave the page; the run carries on and is there when she returns. |
| 3 | Reads a part | Clicks a card, or the part under Review in the menu. The part's page has a two-sentence summary, then one row per finding with Apply, Details, Dismiss and Ask the chat about this, in the look of the Chat response tab. |
| 4 | Answers a finding | Apply changes the draft and marks the finding Applied. Dismiss marks it Dismissed. Ask the chat opens the normal chat. Details opens a tab on the Chat response that spells out the goal and objective codes the finding names. |
| 5 | Writes a comment on a finding | A comment box on the finding row. The next review reads it. |
| 6 | Runs the review again | The new review reads the previous one and her comments, then scans the whole draft again. Each earlier finding shows its fate. |
| 7 | A part could not be read | Its card says Failed, and its page gives the reason. The other parts keep their findings. |

Review never blocks Publish. The reviewers only read the draft; the only thing that changes it is the designer pressing Apply.

## The parts

One reviewer for each part, all started together.

| Part | The reviewer reads | Shown for |
|---|---|---|
| Profile | The agency profile: its name, its description and who it serves | Every agency |
| Goals | The goals page: written, measurable, owned | Every agency |
| Objectives | The objectives under each goal | Farmers' agency only, as the Objectives menu row is |
| Roles | Roles, their permissions, and each agent's description and tools | Every agency |
| Workflows | Every workflow: steps in a sensible order, a person at each wait, time limits, every exception a step and not a rule kept in a module (decision 144), and a name that starts with a verb | Every agency |
| Risks | The risks and what stands in their way | Every agency |
| Tests | Whether every rule has a scenario in Test | Every agency |

Modules has no reviewer in this first version.

Standard: workflow names start with a verb that says what the person does, such as `Create group order`, `Buy now` or `Approve a poster`; the Workflows reviewer raises any other name as a finding whose Apply renames it.

## The risks watch-list

Beyond the four judgements, the Risks reviewer checks ten things and raises each hit as a finding. It never invents an owner, action or condition.

| # | Watch | Hit when |
|---|---|---|
| 1 | Duplicates | the same hazard, threat or control is worded two ways |
| 2 | Stretched threats | a threat is really two threats, or a consequence in disguise |
| 3 | Gaps | a threat or consequence has no control |
| 4 | Advisory controls | a control only advises where the action could be enforced |
| 5 | Weak on_breach | flag is used where block fits, or high severity is held only by flag |
| 6 | Single points of failure | one control guards many threats or consequences |
| 7 | Wrong side | run_workflow sits on a threat, or preventive text on a consequence |
| 8 | Generic hazards | a hazard names no asset and no harm |
| 9 | Separation of duties | the same role holds both controls.edit and controls.approve |
| 10 | Unproven controls | an enforced control has no passing scenario |

## Where the data is

In the database, never in the browser. The tables are declared in the agency backend's blueprint (`mwanachama-backend-agency/agency.blueprint.json`) next to `scenario` and `test_run`, and are stored by wakala-api in the same database as the rest of the draft. For the hub that is the Supabase project `meta-hackathon-2026` ([database.md](../../../../meta-global-ai-hackathon-community-hubs/documentation/3.%20implementation/database.md)). Today the Chat response tab keeps its suggestions in the browser's localStorage (`chat.review.<hubId>`); the Review page does not use that.

Four tables. Every table has an opaque `id` as its key.

### review: one run for one draft

| Column | Holds |
|---|---|
| `draft_id` | The draft that was read |
| `status` | `running`, `done` or `failed`; `failed` only when every part failed |
| `previous_review_id` | The review this run read first; empty for the first run |
| `started_by` | The person who pressed Run review |
| `started_at`, `finished_at` | When it began and ended |
| `tokens` | The total spent across the parts |

### review_area: one reviewer's part of a run

One row for each reviewer: six, or five where the agency has no objectives.

| Column | Holds |
|---|---|
| `review_id` | The run it belongs to |
| `area` | `goals`, `objectives`, `roles_agents`, `workflows`, `risks` or `tests` |
| `status` | `reading`, `done` or `failed` |
| `failure_reason` | The sentence shown on a Failed part's page |
| `summary` | The two sentences at the top of the part's page |
| `tokens` | What this reviewer spent |

### review_finding: one suggestion row

| Column | Holds |
|---|---|
| `review_id`, `area_id` | The run and the part it came from |
| `title`, `detail` | "Describe Farmer R-47" and the sentence under it |
| `tool`, `arguments`, `then` | What Apply runs, in the shape the Chat response tab uses today |
| `status` | What the designer did: `open`, `applied` or `dismissed` |
| `fate` | The reviewer's judgement of the problem: `new`, `fixed`, `still_open` or `withdrawn` |
| `fate_reason` | Why, in one sentence |
| `carried_from_id` | The earlier finding this one answers; empty for a new one |

### review_comment: the designer's note on a finding

| Column | Holds |
|---|---|
| `finding_id` | The finding it is on |
| `author` | Who wrote it |
| `body` | The text |
| `created_at` | When |

Indexes: by `draft_id` on `review` (the latest review of a draft), by `review_id` on `review_area` and `review_finding`, and by `finding_id` on `review_comment`.

## How a run works

1. Run review writes a `review` row with status `running` and one `review_area` row for each part with status `reading`, and answers at once.
2. A background job inside wakala-api, like the test runs of decision 102, starts every reviewer together. Each reads its part of the draft through the agency tools, and the reviewers run on the hub's default AI account. The run is refused with a plain sentence when no default account is set.
3. A reviewer writes its findings, its summary and its tokens, and sets its area to `done`. A reviewer that fails or runs out of allowance sets its area to `failed` with the reason; the other reviewers are not stopped.
4. When no area is left `reading` the review is settled: `done` when at least one area is `done`, `failed` only when every area failed (a review of one part whose part failed is `failed`). The page reads the run again to fill the progress card, and shows the cards once it is done.
5. A restart picks the run up and re-runs only the areas still `reading`.

## What a later run does with earlier findings

A later run sets `previous_review_id` to the latest earlier review. Each reviewer reads that review's findings for its part and the designer's comments on them, and also scans the whole part again as if there were no earlier run.

Every earlier finding gets one row in the new run, with `carried_from_id` pointing at it and a fate:

| Fate | Meaning |
|---|---|
| `new` | Found by this run and not in the earlier one |
| `fixed` | The problem is gone, whether she applied it or changed the draft by hand |
| `still_open` | The problem is still in the draft |
| `withdrawn` | The reviewer no longer holds it, usually because her comment explains it |

The designer's action carries over. A finding she dismissed stays Dismissed even when its fate is `still_open`. It is reopened (status `open`) only when her comment no longer explains it or the draft changed under it, and `fate_reason` says so. An applied finding whose problem is gone is `fixed`; one whose problem is still there comes back `open`.

Only the latest earlier review is read. Its rows already carry what happened before it.

## The tools

Eight tools of the agency backend carry the page and the runner. Every tool takes the agency it is called on from the connection, as the other agency tools do. A finding is always the same object, called a finding below.

A finding: `id`, `area_id`, `ordinal`, `title`, `detail`, `tool`, `arguments`, `then`, `status`, `fate`, `fate_reason`, `carried_from_id`, and `comments` (each `id`, `author`, `body`, `created_at`).

| Tool | Takes | Returns | Used by |
|---|---|---|---|
| `agency_start_review` | `draft_id` | `{review, areas}`: the new review (status `running`, `previous_review_id` set to the latest earlier review) and one area row per reviewer, all `reading`. Refused with "A review of this draft is already running." while one runs | Run review |
| `agency_get_review` | `review_id`, or `draft_id` for the latest | `{review, areas}`; each area carries `summary`, `failure_reason`, `tokens` and its `findings`. `{review: null}` when the draft has none | The page, polling every 2 seconds while running |
| `agency_list_reviews` | `draft_id` | `{items}`, newest first, without findings | Earlier reviews, later |
| `agency_list_running_reviews` | nothing | `{items}`: every review still `running`, in any draft of the agency, newest first, without parts or findings | Nothing in wakala-api calls it yet; its description says a restart reads it to resume the reviews it left running instead of walking every draft |
| `agency_set_finding_status` | `finding_id`, `status` (`open`, `applied`, `dismissed`) | the finding | Apply and Dismiss |
| `agency_comment_finding` | `finding_id`, `body` | the comment | The comment box |
| `agency_review_input` | `review_id`, `area` | `{previous}`: the findings of the previous review for that area, each with its comments; empty for a first run | A reviewer, before it reads the draft |
| `agency_record_review_area` | `review_id`, `area`, `status` (`done` or `failed`), `summary`, `failure_reason`, `tokens`, `findings` (each `title`, `detail`, `tool`, `arguments`, `then`, `fate`, `fate_reason`, `carried_from_id`, `reopen`) | `{area, review_status}` | A reviewer, once, when it has finished |

`agency_record_review_area` carries the designer's action over: a finding with a `carried_from_id` takes the earlier finding's `status`, except that an earlier `applied` finding whose fate is `still_open` comes back `open`, and an earlier `dismissed` one comes back `open` only when `reopen` is true. It also adds the area's tokens to the review, and when no area is left `reading` it settles the review, `failed` when every area failed and `done` otherwise, and writes `finished_at`.

The reviewer, in wakala-api (package `reviewruns`, beside `testruns`), is a function from an area input to an area result:

- `AreaInput`: the review id, the area, the draft id, and the previous findings with their comments.
- `AreaResult`: `Summary` (two sentences), `Findings`, `Tokens`.
- `Reviewer`: `Area() string` and `Review(ctx, AreaInput) (AreaResult, error)`. An error becomes a failed area with the error's sentence as its reason.

## What is kept and who sees it

- Every review stays in the database; none is deleted. The page shows only the latest and the earlier ones are kept for later.
- The reviews belong to the draft. Publishing freezes the draft into a version, and the reviews stay with the draft.
- Anyone who can open the draft in the console sees the same reviews and comments.

## To confirm

- Whether each part's page has an Apply all, as the Chat response tab does today.
- Whether the Objectives part is the only one that depends on the agency kind.
- The menu id of the Review row is `publish-review` until this is settled. Journey 26's board rows plan a page called Review in the Agency group (HS454, HS459), so the two must be reconciled when either is built.
- Whether the earlier reviews should have a page of their own.
