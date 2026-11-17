# Console: the calculating step screen

The five cards of the calculating step put one under the other on one screen, and the Save step button that writes the step into the agency's draft. It is drawn as screen 1 and screen 2 of [workflow-calculating-step.html](../2.%20design/mockups/console/agency/workflow-calculating-step.html), which the owner accepted on 2026-11-17, and described in [calculating-step-screen.md](../2.%20design/technical-spec/calculating-step-screen.md), sections Screens, The posting step and What it calls. It is built for ISS-58.

## The cards

The screen builds none of them. Each has its own page:

| Card | Page |
|---|---|
| Function | [console-calculating-step-page.md](console-calculating-step-page.md) |
| Inputs | [console-calculating-step-inputs.md](console-calculating-step-inputs.md) |
| This step | [console-calculating-step-card.md](console-calculating-step-card.md) |
| Try it | [console-calculating-step-tryit.md](console-calculating-step-tryit.md) |
| Post the payment and What it does | [console-posting-step-panel.md](console-posting-step-panel.md) |

## Where it lives

All of it is in `code/console/src/pages/calcstep/`, on the `dev` branch of this repo, not in the studio repo the issue names.

| File | What it holds |
|---|---|
| `CalcStepScreen.tsx` | `CalcStepScreen`: the five cards in the order of the drawing. It holds no state and calls nothing |
| `CalcStepPage.tsx` | Keeps the state of the screen, shows the title row with Save step, and mounts `CalcStepScreen` when it is given a `setup`. Without a setup it shows the Function card alone, as it did before |
| `saveStep.ts` | `saveStep` and the two functions that build what it sends, `calculatingFields` and `postingFields` |
| `stepSetup.ts` | `StepSetup`, the type of what the screen is set up with, and `loanPaymentSetup`, the loan payment step on the fixture |
| `CalcStepScreen.test.tsx`, `saveStep.test.ts` | The tests |
| `../../journeys/buildCalculatingStep.walk.test.tsx` | The journey that builds the loan payment step from an empty step to a saved one and saves three pages for the screenshots |

## What Save step does

Save step is at the right end of the title row. It is on only when a function is chosen and no input is flagged: every input has a source, and a fixed value is not blank. An empty failure choice does not turn it off. That is the page's own recommendation while a workflow is being built, because the step it goes to may not exist yet; the Issue scan blocks publishing a calculating step without a choice, and the screen shows the sentence for it as drawn.

Pressing it calls `saveStep`, which:

1. Reads the agency's open draft with `agency_list_drafts` and takes the first one.
2. Writes the calculating step with `agency_update_work_item`: `function` written `name@version`, `bindings`, `result_name` and, when a choice is made, `on_failure`. `bindings` and `on_failure` are sent as JSON text, in the shapes of [step-fields.md](../../../../mwanachama-backend-agency/documentation/3.%20implementation/step-fields.md).
3. Writes the posting step with a second `agency_update_work_item`: `amount_step_id`, `account`, `counter_account`, `direction` and `reason`, only when the amount, both accounts and a reason are all given.

Both calls carry the draft's id when there is one. The page then calls `refreshMenu`, which makes the draft bar read the draft again.

## What runs on the fixture

| What | State |
|---|---|
| The step's title, `agency_get_work_item` | Called through the typed client |
| The agency's functions and the step's function | The fixture, until the call to list functions is built on the API side |
| The inputs, steps, roles, accounts, the amount choices | `loanPaymentSetup`, until the host calls to list them exist |
| Try it | The fixture client in `stepSetup.ts`: it answers 564.88 when every input has a value and lists the blank ones otherwise. The call to run a sample is not built yet |
| Save step | The real `agency_update_work_item`. The journey test answers it with the test double of the console, never with a live hub |

## The screenshots

At 1440 wide, in [walk-records/iss-58/](../4.%20qa/walk-records/iss-58/), taken from the pages the journey saves, in headless Chrome, with the console's own stylesheets:

- [calculating-step-problems-1440.png](../4.%20qa/walk-records/iss-58/calculating-step-problems-1440.png): the empty step. Save step is off, every input says No source, and the failure choice shows its sentence.
- [calculating-step-set-up-1440.png](../4.%20qa/walk-records/iss-58/calculating-step-set-up-1440.png): the step set up in full, with the sample run answering 564.88 and the posting read back as a sentence.
- [calculating-step-posting-1440.png](../4.%20qa/walk-records/iss-58/calculating-step-posting-1440.png): the posting panel on its own.

The first two are the height of the whole screen, not 900, because the five cards do not fit in one window. To make them again, run the journey test with `WALK_SHOTS` set to a folder and open each saved page in a browser at 1440 wide. The saved pages use `walkShot.ts`, which now also loads `ui/segmented.css` so that the choices of This step are drawn.

## What stays open

- **Who runs the step and the rounding rule are not saved.** The card sets both, but the agency stores no field for either yet: [step-fields.md](../../../../mwanachama-backend-agency/documentation/3.%20implementation/step-fields.md) lists none. Save step leaves them out until the agency has them.
- **The draft bar's count.** `data/draft.ts` has no change kind for `agency_update_work_item`, so a saved step is not counted in the draft's pending changes until one is added.
- **The step an input comes from is held by name.** `saveStep` turns the name into the step's id from the steps it was given, and sends the name when there is no such step. A source of the kind step or record has no picker for the step or the question yet, so the screen shows the kind chosen and the walk uses the ledger balance and fixed values.
- **Save step with the failure choice empty** is allowed, as the page recommends. The owner has not said.
- **The sample run's problem list** is shown by the Try it card, but the screenshot of the empty step does not run a sample, so the list is not on it.
- **Where a workflow's own page lives** is open on the design page. This issue adds no menu row and changes no route.
- **The owner has not looked at the screenshots yet.** The issue is done when they have.
