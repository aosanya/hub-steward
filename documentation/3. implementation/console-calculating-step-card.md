# Console: the This step card of the calculating step

The card where a builder says who runs the calculating step, what happens when it cannot work out a result, what the result is called and which rounding rule applies. It is drawn on screens 1 and 2 of [workflow-calculating-step.html](../2.%20design/mockups/console/agency/workflow-calculating-step.html), which the owner accepted on 2026-11-17, and described in [calculating-step-screen.md](../2.%20design/technical-spec/calculating-step-screen.md), section The step card. It is built for ISS-47.

## Where it lives

All of it is in `code/console/src/pages/calcstep/`.

| File | What it holds |
|---|---|
| `failureChoice.ts` | The failure choice, the steps it may go to, the problem a choice has, and the five rounding rules |
| `StepCard.tsx` | The card: four rows built on the shared Card, SettingRows, Segmented, SelectControl and TextControl |
| `failureChoice.test.ts`, `StepCard.test.tsx` | The tests |
| `../../journeys/stepCard.walk.test.tsx` | The journey step: the choice is missing, then made, and the card is saved as a page for the screenshots |

The card takes everything as props and fetches nothing. The page that mounts it is the assembly issue ISS-58, which keeps the value of the card and decides what Save step does.

## What the card takes

| Prop | Meaning |
|---|---|
| `stepId` | The step the card is for. The picker of steps to go to never lists it |
| `steps` | Every step of the workflow, each with an id and a name |
| `roles` | The roles of the draft, each with an id and a name |
| `value` | The four settings of the step: `runner`, `failure`, `resultName` and `rounding` |
| `onChange(next)` | Called with the whole new value whenever the builder changes one setting |

`runner` is the agency, or a role with the id of the role that confirms. `failure` is `null` (nothing chosen), a step to go to with its id (empty until one is picked) or stop and tell the person. `rounding` is one of the five rules, or `null` when none is chosen.

## The rows

| Row | What it does |
|---|---|
| Who runs it | Two buttons: the agency runs it, or a role confirms the figure first. Choosing a role shows a role picker with the first role chosen and the sentence that the role must exist in the draft. When the draft has no role the card says so instead of showing an empty picker (compute-side decisions 2 to 4) |
| If it cannot work out a result | Two buttons: go to a step, or stop and tell the person what is wrong. Go to a step shows a picker of every other step of the workflow. One choice covers bad inputs and a calculation that fails (compute-side decisions 5 and 12) |
| Result is kept as | A text field with the name the posting step and later steps find the result under |
| Rounding | Five buttons: down, up, half up, half down, half even. Half up shows pressed while none is chosen (engine-side decisions 14 and 20) |

The failure choice and the result name carry a required mark.

## The failure choice

`failureChoiceProblem(choice, steps, stepId)` gives the problem a choice has, or `null`:

| Problem | When | Sentence the card shows, in red |
|---|---|---|
| `empty` | Nothing is chosen, or go to a step has no step picked yet | Choose what happens when this step cannot work out a result. The agency cannot be published until every calculating step has a choice. |
| `itself` | The step chosen is the step itself | A step cannot send its own failure to itself. Choose another step. |
| `unknown-step` | The step chosen is no longer in the workflow | The step chosen is no longer in this workflow. Choose another step. |

`otherSteps(steps, stepId)` is the list the picker shows. The card does not disable anything itself: it shows the sentence, and the Issue scan blocks publishing.

## Words

The card asks for 26 words under `calcstep.step.*` in `public/i18n.json`, written in the seven languages. They are the title, one for each row, each button, each hint, the three sentences of the table above, the placeholder `Choose a step` and the no-role sentence.

## Screenshots

`documentation/4. qa/walk-records/iss-47` holds the card at 1440 wide in two states: `step-card-empty-1440.png` (the choice is missing and the red sentence shows) and `step-card-made-1440.png` (go to a step chosen, a role confirming, half even). To make them again, run the journey test with `WALK_SHOTS` set to a folder, then shoot the two saved pages with a headless browser at 1440 x 900. The whole assembled page is shot on ISS-58.

## What stays open

- Whether Save step may be pressed with the failure choice empty. The page recommends yes, because the Issue scan blocks publishing; this card shows the sentence and does not disable Save. The page issue decides.
- Whether the rounding list is the same for every result (recommended yes), and whether an agency can change its own default rounding. The second belongs to the agency's settings, not to this card. The list of five rules is proposed on the engine side.
- The shared SettingRows takes a text label, so the required mark is an asterisk after the label text, not the red mark of the drawing. The shared Segmented always shows a label next to its buttons, so the card gives it an empty one. Both fit better with a small change in `src/ui`, which is outside this issue.

## How it was checked

`npx vitest run src/pages/calcstep/failureChoice.test.ts src/pages/calcstep/StepCard.test.tsx src/journeys/stepCard.walk.test.tsx src/i18nFiles.test.ts` passes (31 tests of the card, 1 journey step and the translation table), and `npm run typecheck` in `code/console` is clean. The two screenshots are linked above.
