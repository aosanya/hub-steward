# Console: the calculating step page and its Function card

The page a builder reaches by opening one step of a workflow, and the first card on it: the function the step calls, always written with its version, and a notice when a newer version exists. It is drawn on screen 1 of [workflow-calculating-step.html](../2.%20design/mockups/console/agency/workflow-calculating-step.html), which the owner accepted on 2026-11-17, and described in [calculating-step-screen.md](../2.%20design/technical-spec/calculating-step-screen.md), sections Where it is reached from, The function card and What it calls. It is built for ISS-44.

## Where it lives

All of it is in `code/console/src/pages/calcstep/`.

| File | What it holds |
|---|---|
| `calcStepApi.ts` | The typed client: `CalcStepApi` with `openStep`, `listFunctions` and `chosenFunction`, and the helpers `written` (`fin.pmt@2`) and `newestOf` |
| `calcStepFixture.ts` | The invented data the client falls back on: three functions (`fin.pmt` at versions 1 to 3, `fin.rate`, `date.late_days`), the step's chosen function `fin.pmt@2` and a step header |
| `FunctionCard.tsx` | The card: a picker listing every function with every version, the version in use, the function's one-line description, and the newer-version notice |
| `CalcStepPage.tsx` | The page: the title row with Save step at its right end, the Function card, and `CalcStepRoute`, which reads `hubId` and `stepId` from the address |
| `FunctionCard.test.tsx`, `CalcStepPage.test.tsx` | The tests |
| `../../journeys/functionCard.walk.test.tsx` | The journey step that renders the page on the fixture and saves it for the screenshot |

The route is `calc-step/:stepId` under the hub in `src/App.tsx`, and `calc-step` is in `draftPages` of `src/data/draft.ts`, so the frame shows the draft bar on it. The words are the keys `calcstep.*` in `public/i18n.json`, in all seven languages; the other cards of this screen add their own keys under the same namespace.

## What the page calls

| Call | State |
|---|---|
| `agency_get_work_item` with `work_item_id`, through `callTool` | Real. It gives the step's id, code and title |
| The list of the agency's functions and their versions | Not built. `listFunctions` returns the fixture |
| The function and version a step calls now | Not built. `chosenFunction` returns the fixture's `fin.pmt@2` |
| Running a function on sample values | Not part of this page; the Try it card owns it |

The client is the one place that changes when the host serves the two missing calls; the page and the card take the client as a prop and never name a route. Nothing is guessed.

## What the card does

- The function is written `fn@version`, for example `fin.pmt@2`, in the picker and in the Version in use tag at the card's right edge.
- When the step calls an older version than the newest listed, the card says A newer version exists: `fin.pmt@3` and shows one button, Use version 3. Nothing moves until it is pressed; the notice says the step keeps calling the old version until then.
- A step with no function shows Pick a function and No function is picked yet.
- The card hands the choice to the page, which holds it. Save step is disabled until a function is picked and the assembly passes `onSave`; saving sends back the step id and the function as written.

## What stays open

- The two missing calls above. Until they are built, the page shows the fixture's functions and the fixture's choice for every step.
- Where a workflow's own page lives in the menu, which the page reaches the step from. The recommendation is a Workflows row under Agency after Goals; it is not built here.
- Whether Save step may be pressed with the failure choice empty. The recommendation is yes, because the Issue scan blocks publishing; the page does not yet know the failure choice, which the This step card holds.
- The other cards (inputs, step, Try it, posting step) are separate issues and are mounted by the assembly issue ISS-58, which edits `CalcStepPage.tsx` once this one is Done. The drawing's draft bar is shown by the frame, not by the page, so the walk screenshot, which mounts the page alone, does not carry it.

## How it was checked

`npx vitest run src/pages/calcstep/FunctionCard.test.tsx src/pages/calcstep/CalcStepPage.test.tsx src/journeys/functionCard.walk.test.tsx` passes with 19 cases. `npm run typecheck` reports nothing in this issue's files. A screenshot of the page at 1440 x 900, rendered through the journey test, is in [iss-44/function-card-1440.png](../4.%20qa/walk-records/iss-44/function-card-1440.png). To make it again, run the journey test with `WALK_SHOTS` set to a folder and open the saved page in a browser at 1440 wide.
