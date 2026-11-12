# The working-time clock

A worker's runtime cap counts working time. This page is the rule for when that clock starts, stops and restarts, and what a stop means. The code is `code/wakala-api/modules/taskmanager` (`task_caps_nearest.go`, `task_clock_idle.go`, `task_caps_stop.go`).

## Start

The clock starts at the first Log entry that a worker or a person wrote. The hub's own entries are marked `automatic` on the Log (`task_note.automatic`) and never start it: "A dependency is open: Waiting added", "... finished: Waiting dropped" and the entries of the clock itself. `taskmanager_task_caps_nearest` returns that moment as `started_at`; an issue with no worker or person entry has none.

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
