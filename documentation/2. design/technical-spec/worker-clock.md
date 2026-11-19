# The working-time clock

A worker's runtime cap counts working time. This page is the rule for when that clock starts, stops and restarts, and what a stop means. The code is in the repository `mwanachama-backend-taskmanager` (`task_caps_nearest.go`, `task_clock_idle.go`, `task_caps_stop.go`), which `code/wakala-api` requires at a tag. Tag `v0.1.0` starts the clock at the first worker note; the hub's earlier rule, start at the latest claim, is listed in that repository's hub-import-drift page and is not in the tag.

## Start

The clock starts at the Taken entry of the latest claim. The hub's own entries are marked `automatic` on the Log (`task_note.automatic`) and never start it: "A dependency is open: Waiting added", "... finished: Waiting dropped" and the entries of the clock itself. `taskmanager_task_caps_nearest` returns that moment as `started_at`; an issue with no worker or person entry has none.

The rule, in order:

1. Take the latest automatic "Moved ... to ...doing" (or in-progress) entry. Its time is M.
2. The start is the earliest worker entry (not automatic) at or after M minus 5 seconds. The claim stamps the Taken note about 400 microseconds before the Moved note, so the 5 second window covers either order.
3. Entries a worker or a person wrote while the issue sat in To do, such as the "Still seen in ..." notes the run review adds, never start it.
4. A resumed issue (released, then claimed again) starts again at its new Taken entry.
5. An issue never moved keeps the old rule: its earliest worker entry.
6. An issue moved into doing with no worker entry since has no start.

The server (`taskmanager_task_caps_nearest`, `taskmanager_task_timed_out`) and the card (`app/src/features/backlogs/caps/elapsed.ts`) give the same start. The code is `task_clock_start.go`.

Entries written before the `automatic` flag existed carry no mark and still count; only entries written after the change are skipped.

## Stop

| Cause | Who stops the clock | Sign |
|---|---|---|
| The worker asks the owner and waits | the runner, with `clock_stopped` true in the usage write | `clock_stopped` |
| No usage write for `worker_idle_stop_seconds` (default 600, ten minutes) on an issue In Progress | the hub itself, the next time the caps are read (`taskmanager_task_caps_read`, `taskmanager_task_caps_nearest`) | `clock_stopped` and `idle_stopped`, one automatic Log entry saying why |

The hub does not stop the issue, move it or change its tags when it stops the clock.

## Restart

The next usage write replaces the figures of the run. A write with `clock_stopped` false starts the clock again, clears `idle_stopped` and adds one automatic Log entry saying so. A write of zeros starts a new run.

## What a stop means

| Stop | Reads as | Sinbin | Card |
|---|---|---|---|
| A working agent passed a cap (input, output or runtime) | too big | yes, tagged Sinbin and moved to To do by the usage write itself | Time is up, or the cap passed |
| The hub stopped an idle clock (`idle_stopped`) | interrupted or idle | never; the runtime cap is not applied while the clock is stopped | Interrupted |
| The worker waits for the owner (`clock_stopped`) | asked | never, for the same reason | the elapsed time as it was |

`taskmanager_task_caps_nearest` returns `interrupted` true for an idle stop, so a screen can say Interrupted instead of Time is up. The lead and the Triager read the last cause in the Log before a sinbin or a split (see the `backlog-worker` skill, "Check the cause before the sinbin").
