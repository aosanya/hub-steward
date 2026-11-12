# Worker caps and the Sinbin tag

From the owner's remark on 2026-11-11, after the hungarian-municipality workers ran very long (SW197). Decided as D126 to D135, D136 to D138 (proposed, SW221), D144 to D147 (Sinbin is a tag, SW239), and D150 and D151 (the hub enforces the caps, any runner reports, SW272), in [decisions.md](../../../../../hub-steward-swe/documentation/1.%20requirements/decisions.md). Drawn in [worker-caps.html](../../mockups/app/worker-caps.html); walked in [journey 10](../../../../../hub-steward-swe/documentation/4.%20qa/user-journeys/10-worker-caps/README.md). The Caps card and both editors are built (SW242); the red card, the hook and the Sinbin mark are not (ISS-48 for the tint).

## The caps (D126, D127)

| Cap | Counts | Default |
|---|---|---|
| Input tokens | everything sent to the model, cached re-reads included | 500,000 |
| Output tokens | everything the model wrote | 100,000 |
| Runtime | working time from the move to In Progress, not counting the wait for the owner's answer (D136) | 15 minutes |

One default for all workers. An issue may carry its own numbers, which replace the default cap by cap (D148, amending D127): a cap left empty uses the default.

## Runtime is working time (D136 to D138, screen 14)

Proposed for the owner. The runtime figure advances only while the worker is working, that is while its tokens are being counted. From the moment the worker asks the owner a question until the answer arrives it stands still, so waiting for a person never counts toward the 15 minutes.

| Question | Recommendation |
|---|---|
| What counts as asking | The worker's AskUserQuestion call to the owner; nothing else the worker does |
| What pauses | Only that wait; tool calls, builds and tests still count |
| Who runs the clock | The runner reports it: the Claude Code hook (SW203) measures working seconds from the worker's first Log entry and sets `clock_stopped` from the question to the answer; the application's agents set the same flag. The hub applies no runtime cap while it is set and has no timer of its own (D150) |
| What the card shows while it runs | While the issue is In Progress the Runtime line is worked out in the card: the time from the first worker Log entry to now, ticking every second, frozen while `clock_stopped` is set. Workers post nothing for it. The stored `seconds_used` is shown once the issue is no longer In Progress. On a board card or list row the same time shows as a chip ("10 min left", "30 s left", "Time is up") and the card shades red from half the time, redder as it runs out; `taskmanager_task_caps_nearest` returns `started_at` (the first worker Log entry) beside the caps in force so the screen needs no second call. Tokens still come only from a runner's usage write; the hub's runtime cap still compares the stored figure (2026-11-11) |
| An answer that never comes | The figure stays still; the cap does not stop a worker that is waiting |

The Caps card of a paused worker keeps the runtime figure and bar, adds the chip "Paused, waiting for your answer" to the runtime line and leaves the other two lines unchanged (D137). The issue card keeps its last tint and chip and does not rise while paused. A stop entry that names runtime says working time (D138). Drawn in [screen 14](../../mockups/app/worker-caps.html#s14).

## What happens at a cap (D128, D129, D133)

Passing any one cap ends the worker. The hub does this, not the runner (D150): a runner reports its totals with `taskmanager_task_usage_write` and the hub compares them with the caps in force, so the Claude Code hook and the application's own agents are treated the same. The hub writes one stop entry in the Log, drops Ready, adds the tag `Sinbin` and leaves the issue in To do (D144). There is no Sinbin step: the Backlog keeps To do, In Progress, Done and Cancelled. The entry says, in this order: the cap passed and what was used against it (the other two too), the last step finished, what is left, the files changed but not committed, and the tag and where the issue sits. Drawn in [screen 8](../../mockups/app/worker-caps.html#s8).

## The Caps card (D131, screens 1 to 6)

A third card on the issue page beside References and Log, collapsible with the same header and chevron, and shut when the page opens like the other two (D148).

| State | The card shows |
|---|---|
| No worker has run | Each cap as used / cap with an empty bar and 0% used: "0 / 500,000 tokens", "0 / 100,000 tokens", "0:00 / 15:00", and "Default for all workers"; nothing is Nearest and there is no updated time |
| A worker running | For each cap: used / cap ("200,222 / 500,000 tokens", runtime as working time in minutes and seconds, "3:20 / 15:00"), a bar, the percent; the highest percent is marked Nearest and its bar alone is accent-coloured; below the lines "updated <time>" from the consumption's updated_at; while the issue is in Doing the figures are read again every 15 seconds (Q22), and not otherwise |
| Stopped at a cap | The last run's final numbers; the passed cap has a full red bar and a Passed chip; a new run starts from nothing |
| Own numbers | The three caps, "This issue's own numbers" and the default beside them |
| Edit | Three number fields inside the card (input tokens, output tokens, runtime in minutes) with Save, Use the default and Cancel; a field left empty falls back to the default for that cap, all three empty is Use the default, a number that is not a whole number above zero is refused in place; no settings page |
| Own numbers, some | Where only some caps are the issue's own, the others carry a Default chip and the line reads "Some numbers are this issue's own" |

Every line reads used / cap in every state, the used figure being 0 when no worker has run (SW263, the owner: "I do not want caps only, I want to see 200222/500000"). A shut card shows only its name.

## Where the default is set (D132, screen 7)

A Workers block at the bottom of the console's Assistant page ([assistant-limits.md](assistant-limits.md)): three numbers (input tokens, output tokens, runtime in minutes), saved with that page's Save through taskmanager_worker_caps_set, each refused in place unless it is a whole number above zero. Built (SW242); the placement is still proposed.

## The red card (D134, D135, screen 11)

The issue card turns red as the nearest cap fills, on the board card, the list row and the issue page header.

| Used of the nearest cap | Tint | Chip |
|---|---|---|
| Below 50% | none | none |
| 50% | 20% of full red | Output 50% |
| 80% | 68% | Runtime 80%, red text |
| 100% | full red | Input passed |

The tint is `0` below 50% and `0.2 + 0.8 × (ratio − 0.5) / 0.5` from there, never above 1. The ratio is the highest used-of-cap of the three, the one the Caps card marks Nearest. Red is never the only signal: the chip carries the cap and its percent. A stopped issue keeps the tint of the last run's final numbers; Done and Cancelled issues show none.

It is one shared helper, not a copy for each surface: it takes the used figures and the caps and returns the ratio, the tint and the chip text, and the board, the list row and the issue page call it and differ only in where they put the chip. The tint is drawn from one CSS rule that reads the tint as a custom property.

The board and the list tint every card from one read, `taskmanager_task_caps_nearest` (SW266): it takes the ids of the issues on the screen, or a backlog, and returns for each the caps in force (its own numbers, else the default) and `nearest` with the key, used, cap and ratio of the cap the last or current run is closest to; `nearest` is absent when no worker has run, so that card shows no tint. The app asks once for the cards of a board, a list or a result list that are in progress or tagged Sinbin, and again every 15 seconds while one of them is in progress (Q22), so a stopped issue anywhere on a board of any length keeps its tint without one read for each card. The issue page keeps its one `taskmanager_task_caps_read` through the Caps card, which carries the full figures, and tints its own header from that.

Built by ISS-48 in `app/src/backlogs/caps` (`tintOf`, `useCapTint`, the `--cap-tint` rule in `caps.css`). The board and list load issues with `taskmanager_task_list`, which carries no used figures, so a row reads `taskmanager_task_caps_read` only for an issue in progress or tagged Sinbin and refreshes it every 15 seconds while the worker runs; the issue page takes its figures from the Caps card's own read. Every other card shows no tint until the app reads `taskmanager_task_caps_nearest` (SW266), which returns the nearest ratio of many issues in one call.

The board and the list tint every card from one read, `taskmanager_task_caps_nearest` (SW266): it takes the ids of the issues on the screen, or a backlog, and returns for each the caps in force (its own numbers, else the default) and `nearest` with the key, used, cap and ratio of the cap the last or current run is closest to; `nearest` is absent when no worker has run, so that card shows no tint. It is read every 15 seconds while a running issue is on the screen (Q22) and once otherwise, so a stopped issue anywhere on a board of any length keeps its tint without one read for each card. The Caps card on the issue page keeps `taskmanager_task_caps_read`, which carries the full figures.

## Sinbin is a mark (D144 to D147, screens 9, 10)

Sinbin is a tag beside Ready, Waiting and Blocked, with its own chip and its own filter chip, and no column or list of its own. A stopped issue sits in To do among the others: its card shows the Sinbin chip in a deeper orange, the passed-cap chip and the full red tint. Colours (D146): Waiting a light amber-orange, Sinbin a deeper orange, Blocked red; the red of the cap tint and the cap chips is a separate signal and no mark uses it. Tapping the Sinbin chip filters the board and the list to the stopped issues, as the other marks do.

| Question | Recommendation (D145, proposed) |
|---|---|
| Sinbin and needs-review | One tag: Sinbin replaces needs-review |
| Sinbin and Blocked, Waiting, Ready | An issue carries one mark; Sinbin is never Ready, and not also Blocked or Waiting |
| Who takes it | The Triager, as it takes Blocked issues; a worker never takes a Sinbin issue |
| Q24 | Answered: the stopped issue is Sinbin alone, not also Blocked |

## The review (D130, D145, screens 12, 13)

The owner asks the Triager in Chat to split a Sinbin issue; it answers with a card holding a table (piece, what it covers, waits on) and a Confirm button. Pieces are named as the original title and a letter, and wait on another piece only where one really needs the one before. After Confirm the pieces are created, the original is Cancelled with a Log note naming them and loses its Sinbin tag, and the pieces show as Ready, or Waiting where one waits on another.

The `split-sinbin` skill does this for every Sinbin issue in one pass: it reads each Log to find what is left, splits only that remainder into pieces that fit the caps and share no files, creates the pieces without a Confirm (asking for the skill is the owner's request, so the owner sees the result, not a proposal), titles each "MUN199a short description", files it one priority level above its original (the work is half finished, so it goes first), clears Sinbin and cancels the original. It starts no worker: the Ready pieces are picked automatically. This skips the Confirm that D130 asks of the Triager's single-issue split; D130 is unchanged for that path.

## Open

| Question | Recommendation |
|---|---|
| Q22: how often the used figures refresh on screen | Every 15 seconds while a screen showing a running issue is open; none when no worker runs |
| Q23: how a worker is told its caps | The hub measures; the lead puts the three numbers in the brief and `taskmanager_task_read` returns them |

## Filled by

Built by SW200 in the hub's taskmanager module (decision 143): the default is three hub settings, an issue's own numbers and its consumption are one record each keyed by the issue id, and the tools are taskmanager_task_caps_read, taskmanager_task_caps_set, taskmanager_task_caps_clear, taskmanager_task_usage_write, taskmanager_worker_caps_read and taskmanager_worker_caps_set. The caps read returns the caps in force, the default, the issue's own numbers and the consumption with whether the runtime clock is stopped. SW266 built `taskmanager_task_caps_nearest` in the same module (`task_caps_nearest.go`, GET `/caps-nearest`: `task_id` repeated or `backlog`, at most 500 issues in rank order, issues the caller cannot see or that do not exist left out) and its app side (`CapTintScope` and `useCapTints` in `app/src/backlogs/caps`, one call for each board, list or result list, none for a row outside one). SW242 built the Caps card (read with taskmanager_task_caps_read, edited with _caps_set and _caps_clear, the used figures, Nearest, Passed and the Paused chip) and the Workers block. SW266 built `taskmanager_task_caps_nearest` in the same module (`task_caps_nearest.go`, GET `/caps-nearest`: `task_id` repeated or `backlog`, at most 500 issues in rank order, issues the caller cannot see or that do not exist left out). SW203 built the hook that reports the consumption and ends the session; SW272 reduced it to an adapter that holds no cap number, comparison or stop text (D150), so the hub is the only place that knows the caps and the application's agents report the same call. With the hub unreachable the adapter does not stop on its own (D151, proposed). SW206 built the stop step in the hub, not in the hook, so any runner gets it: the usage write that reaches a cap writes the Log entry, swaps Ready for Sinbin, moves the issue to To do and replies `stop: true`; it also built the Sinbin mark (the smart-backlog rule `mark`, the chips and the filter). Still to build: the red card; no step is added for Sinbin (D144). The Triager's proposal and the creation of the pieces use the task tools it already has.
