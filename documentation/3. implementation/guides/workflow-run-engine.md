# The workflow-run engine

The task manager keeps one run for each order of a published workflow. Two
doors write to it: the routes under `/instances/<I>/taskmanager/workflow-runs`
and the MCP tools `taskmanager_workflow_run_start` and
`taskmanager_workflow_run_begin_step`. Both reach the same board, and the board
checks every call against the published agency.

## What a start must satisfy

- The version is a published version of the agency.
- The workflow code is a workflow of that version.
- Otherwise the call is refused with 400 (`ErrWorkflowNotPublished`).

## What a step must satisfy

| Check | Refused as |
|---|---|
| The run carries a published workflow and the step belongs to it | 409 `ErrStepNotInWorkflow` |
| The step is the first of the workflow, or the one after the run's current step, by ordinality | 409 `ErrStepOutOfOrder` |
| A cancel workflow, when given, is a workflow of the run's version | 400 `ErrWorkflowNotPublished` |
| The caller holds the role the published step names (through a seat, a group or a role assignment) | 403 `ErrStepRoleNotHeld` |

A step with no role in the publication has no role to check. A step that
belongs to no workflow gets 409 before the role is looked at, because there is
no role to name.

The time limit and the cancel workflow of a step are the published ones; a
limit sent with the call is replaced by the published one.

## Where the checks live

- `wakala-api/internal/agencies/published_runs.go` holds the start check, the
  step membership, order and cancel-workflow checks, on `limitedBoard`, the
  wrapper every task manager of an agency is built with.
- `wakala-api/internal/api/http/step_role_board.go` holds the role check, on a
  wrapper that `taskManagerFor` puts around the board for callers. The HTTP
  routes and the MCP tools both resolve their board through it.
- The market ask runner starts and begins its own timed yes-or-no step from
  inside the server, through the registry board and not the caller board. It
  marks the context as trusted, which skips only the order check, because the
  step it waits at is the first timed yes-or-no step of a workflow and not
  always the first step.

## The test

`internal/api/http/misuse_workflow_run_test.go` drives the routes as the owner
against a published three-step referral workflow, and
`internal/agencies/step_limit_sweep_cover_test.go` covers the board checks on
their own.
