# Calculating step screen

The console screen where a builder sets up a calculating step, and the panel of the posting step that follows it. Drawn for ISS-21. The drawing is [`agency/workflow-calculating-step.html`](../mockups/console/agency/workflow-calculating-step.html) in the console mockups, three screens. The example is one invented step, Work out the monthly payment, in the workflow Loan payment of the farmers' agency; every figure is invented.

## Where it is reached from

Agency > Goals, then an objective, then its workflow, then one step. There is no page for a workflow in the console yet, so the drawing keeps Goals as the open menu row and shows the path in the breadcrumb: Agency / Goals / Loan payment / Work out the monthly payment. Because the screen edits the agency's definition it carries the draft bar under the title row, and its one filled button, Save step, sits at the right end of the title row.

## Screens

| # | Screen | What is on it |
|---|---|---|
| 1 | The step set up in full | Function card, Inputs card, This step card and a Try it card, one under the other. Every input has a source, the agency runs the step, a step is chosen for failure, and the sample run shows 564.88. |
| 2 | The same step with problems | The inputs flagged in words, the four sources open on the input that has none, the confirming role chosen, the failure choice left empty with its sentence, the sample run listing every problem, and Save step disabled. |
| 3 | The posting step | One card with Amount, Account, Other side, Direction and Reason, and a short card saying in words what the step does. |

## The function card

The function is picked from the agency's functions and is always written with its version, `fin.pmt@2`. When a newer version exists a notice sits under the picker: "A newer version exists: fin.pmt@3", with one button, Use version 3. Nothing moves until the builder presses it, because a published step keeps the version it names. The card says in a tag which version is in use.

## The inputs card

One row for each input of the function, with its name and type at the left. Beside it is the picker for where the input comes from, and a Check column.

| Source in the picker | What the row shows under it |
|---|---|
| Answer from an earlier step | The step and the question, with the question's type |
| Field of a record | The record and the question, with the question's type |
| The member's ledger balance | Nothing more; it is a currency |
| Fixed value | The value typed in |

Inputs are never matched by name on their own. A question is known by its wording, so rewording one must not silently disconnect an input. Three things are flagged in words in the Check column and under the picker:

- Wrong type: the source's type does not fit the input, such as a text answer for an amount.
- No source: the input has none. Every input needs one.
- Question reworded: the question the input was connected to now has other wording; the builder chooses it again.

## The step card

| Row | What it offers |
|---|---|
| Who runs it | The agency runs it, or a named role confirms the figure first. Choosing a role shows a role picker and the sentence that the role must exist in the draft. |
| If it cannot work out a result | Go to a step, with a picker of the other steps of the workflow, or stop and tell the person what is wrong. One choice covers bad inputs and a calculation that fails. The row has the required mark and is never left empty: until a choice is made it shows a sentence in red. The picker never lists the step itself. |
| Result is kept as | The name the result is known by. The posting step and later steps find it under this name. |
| Rounding | The five rules, one chosen: down, up, half up, half down, half even. Half up is used when none is chosen. |

## The Try it card

The builder types sample values for each input and presses Run on this sample. The card shows the result, with the function and the rounding rule used, or one list with every problem found at once, in the order the function lists its inputs. Each problem names the input, the value received and a plain sentence. The sentences are drawn for this page; the real ones come from the function's own input checks, so the screen shows whatever the library returns and writes none of its own. Nothing is posted or saved by a sample run.

## The posting step

The amount is the result of a calculating step earlier in the workflow and nothing else, so the picker lists only those and the sentence under it says nobody types an amount here. The account is the member's account the entry is written to; the other side is the account on the opposite side, so every posting names both. Direction says which side of the account the amount goes on and is never a minus sign. The reason is a line in words. The card on the right reads the whole posting back as a sentence.

## What it calls

| Action | Call | State |
|---|---|---|
| Open the step | `agency_get_work_item` | Exists |
| Save step | `agency_update_work_item` | Exists; the new fields of the calculating and posting kinds are to be built |
| Pick the function and its versions | A call that lists the agency's functions and versions | To be built |
| Pick roles and steps | `agency_list_roles`, `agency_list_work_items` | Exists |
| Run on this sample | A call that runs the function on given values and returns the result or every problem | To be built |

## Words

The page says function, input, source, result and step. It does not say binding, key or formula engine. Failure is written as "cannot work out a result".

## Open questions

1. Where does a workflow's own page live? Recommendation: a Workflows row under Agency, after Goals, with each step opening this screen; it is not in the menu today.
2. May Save step be pressed with the failure choice empty? Recommendation: yes while the workflow is being built, since the target step may not exist yet, but the Issue scan blocks publishing until every calculating step has a choice; the screen shows the sentence as drawn.
3. Is the rounding list the same for every result? Recommendation: yes, and whether an agency can change its own default is for the agency's settings, not this screen.
4. Does the Try it card save the sample values? Recommendation: no; they live on the screen only.
