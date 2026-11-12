# Creation journey

How one agency gets made, from the requester's side. Roles in *italics* are
AI roles; the Requester is a person. Built from [decisions.md](../../../../hub-steward-agency_creator/documentation/1.%20requirements/decisions.md);
the places a question is still open are marked with its Q.

## The cast

| Role | Who | Writes | Decision |
|---|---|---|---|
| Requester | Person | Material, answers, and a yes or no after each stage | D2, D5 |
| *Researcher* | AI, if Q1 says so | A digest of the documents, links or sector | Q1 |
| *Interviewer* | AI | The brief | D3 |
| *Role designer* | AI | `roles` and their `permissions` | D3 |
| *Goals and objectives writer* | AI | `goals`, `objectives`, `values`, `rules` and their attachments | D3, D10 |
| *Workflow designer* | AI | `workflows`, `work_items`, `workflow_objectives`, and with them the `modules` | D3, D7 |
| *Risk writer* | AI | The starter risk library | D3, D11 |
| *Domain reviewer* | AI | Findings: missing or wrongly ordered steps, invented practice | D4 |
| *Consistency reviewer* | AI | Findings: unknown roles, unlinked workflows, repeated codes | D4 |
| *Risk and fairness reviewer* | AI | Findings: self-approval, people left out, personal data exposed | D4 |
| *Assembler / validator* | AI | The final file, and the import check | D4 |

## The stages

| # | Stage | What the Requester sees | Writer | Checked by |
|---|---|---|---|---|
| 1 | Brief | A one-page description of their organisation and what they want it to do, to correct | *Interviewer* | *Domain reviewer* |
| 2 | Roles | The seats people will hold, each with what it may do | *Role designer* | *Consistency*, *Risk and fairness* |
| 3 | Goals and objectives | Goals, the objectives under each, the values and rules behind them | *Goals and objectives writer* | *Domain*, *Consistency* |
| 4 | Workflows | Each workflow as ordered steps, each given to a role and tied to an objective | *Workflow designer* | all three reviewers |
| 5 | Risks | The starter risks and what guards against each | *Risk writer* | *Risk and fairness*, *Domain* |
| 6 | Assembly | The finished agency loaded in a test hub, with every workflow listed | *Assembler / validator* | the import check |

## Each stage

1. The writer drafts from the confirmed earlier stages and the brief.
2. The reviewers named for the stage each write findings, or none.
3. A finding goes back to the writer, who revises. At most 3 rounds (D6).
4. Still failing after round 3, the draft goes to the Requester with the notes.
5. Otherwise the Requester sees the draft and confirms, or sends it back with
   what is wrong (D5). The next stage does not start before a yes.

Reviewers never edit a draft.

## Input

The Requester may give a chat description, documents, web links and a sector
name, in any mix (D2). The brief records which of them it was built from; for
a sector named alone, the sources the research used are listed (compare
[sources.md](../../../../hub-steward-agency_creator/documentation/1.%20requirements/sources.md)).

## Output

A file `agency/<name>.json` in this repo, in the shape of
[agency/examples/municipality.en.json](../../../../hub-steward-agency_creator/agency/examples/municipality.en.json),
plus the risk library files in the shape of
[agency/examples/risks/](../../../../hub-steward-agency_creator/agency/examples/risks/). Both are loaded into a
local test hub (D9). The creator never imports into the live catalog (R17).
