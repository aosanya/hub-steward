# Workflow canvas screen

How a workflow's calculating and posting steps look when the builder sees the whole workflow at once. Drawn for ISS-20. The drawing is [`agency/workflow-canvas.html`](../mockups/console/agency/workflow-canvas.html) in the console mockups, two screens of the same workflow, Loan payment, with invented figures. It sits next to the [calculating step screen](calculating-step-screen.md), which is where one step is set up; this page is where the steps are seen together.

Status: drawn, not yet reviewed by the owner. The open questions at the end are still open.

## What the canvas shows today

Written from what exists in the two places that draw a workflow. Where something could not be found it is said so.

| Where | What a workflow looks like today |
|---|---|
| The studio's canvas (`/agency/{id}/canvas`, its mockup S03 and its route in the studio app) | Three tabs: Structure, Responsibility and Flow. Flow has an outline with an event trigger, a run step, a true path and a false path, and a palette to add a trigger, a condition or an action. A table beside it shows who is responsible for each step. The graph is drawn from the agency's own data. |
| The console's workflow edit page (`/workflow-edit/{id}/{tab}`) | Three tabs: Workflow, Steps and Records. The steps are a list of cards. A card shows the kind of step, who runs it (the agency or a role), where a route step goes, and a line saying which steps lead to it. It has no graph. |
| The console mockups | One screen that touches a workflow: the calculating step screen. An approval's detail shows the name of its workflow as one row. There is no mockup of a workflow's steps drawn together. |

Neither place has a calculating step or a posting step, a function and its version, a link from the step an input comes from, a result name, a failure target, or any state that says a step is not working. The studio's canvas draws who is responsible and the path of a flow; it does not draw figures.

Not found: a console mockup of the Steps tab, and any record of what the studio's canvas draws for a step that sends a form. Only the studio's route and its mockup were read, not every component behind the graph.

## What this drawing adds

| Added | How it is drawn |
|---|---|
| A calculating step | A card with a gold edge: its name, the function and version it calls, the name its result is kept under, who runs it and where it goes when it fails |
| A posting step | A card with a green edge: its name, the amount it takes and the ledger account it writes to |
| Where figures come from | A link into the step for each input, labelled with the input's name, from an earlier step, a record or the ledger balance |
| Where figures go | A link out of the step labelled with the result's name, into the next calculating step or the posting step that takes it |
| Where a failure goes | A dashed gold link to the step that is chosen, or the words "stop and tell the person" on the step when there is no link |
| A step acting on a list | Two cards stacked behind the step and the tag "Every loan in the list" |
| A step's state | One tag at the top right of the step |

## Screens

| # | Screen | What is on it |
|---|---|---|
| 1 | The workflow as it should be | Set the terms, then a bulk calculating step confirmed by the Treasurer, then a calculating step run by the agency, then two posting steps. The payment step is working. The late fee step carries the tag No scenario has run it. |
| 2 | The same workflow after a change | The payment step has two inputs drawn in red, one with no source and one whose question was reworded, a newer version of its function exists, and its tag reads Needs attention. The late fee step is working. |

The page keeps the console's menu, with Agency open on Workflows (the row a workflow opens from) and the breadcrumb Agency / Workflows / Loan payment, the draft bar under the title row, and the chat folded to its rail so the canvas has room.

## The states of a step

| State | Where it shows | Words |
|---|---|---|
| Working | Tag at the top right of the step | Working |
| An input with no source | A dashed red stub from the step with a cross, and the input's name | The input's name, then "no source" |
| A reworded question | A dashed red link, and the input's name | The input's name, then "reworded" |
| A newer library version | Tag at the bottom of the step | Newer version: fin.pmt@3 |
| A step no scenario has passed through | Tag at the top right of the step | No scenario has run it |
| Several of the above | The tag at the top right reads Needs attention and the cause is drawn where it is | Needs attention |

The words are the ones used on the calculating step screen, so a builder who sees a flag here finds the same words when the step is opened.

## What the screen asks of the data

All of it is proposed.

| Needs | From |
|---|---|
| The steps of a workflow, their kind, who runs each and the route a failure takes | `agency_get_workflow`, `agency_list_work_items` |
| The records an input reads | `agency_list_records` |
| The confirming role | `agency_list_roles` |
| That a step has been passed through by a scenario | The scenario runs of the agency; no page found reads them yet |
| That a newer version of a function exists | The library's version list, as on the calculating step screen |

## Open questions

1. Where does the canvas live? The issue names the studio's canvas, and the owner has asked for this to be drawn in the console. The drawing is a console screen reached from the workflow. Recommended: keep it in the console and give the studio's canvas the same drawing later, from the same data.
2. Can the builder change the workflow on the canvas, or only look? Recommended: only look. Clicking a step opens the calculating step screen or the posting step panel, so there is one place where a step is set up.
3. Is a step "passed through" only in a published agency, or in a draft too? Recommended: in the draft too, counting only the scenario runs made on this draft, so the tag does not go on saying a changed step is fine.
4. When a step has several faults, is "Needs attention" enough at the top right? Recommended: yes, because the causes are drawn where they are.
