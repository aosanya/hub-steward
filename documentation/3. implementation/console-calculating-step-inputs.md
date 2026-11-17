# Console: the inputs card of the calculating step

The card that shows one row for each input of the function the step calls, where each input comes from, and whether the source fits. It is drawn on screens 1 and 2 of [workflow-calculating-step.html](../2.%20design/mockups/console/agency/workflow-calculating-step.html), which the owner accepted on 2026-11-17, and described in [calculating-step-screen.md](../2.%20design/technical-spec/calculating-step-screen.md), section The inputs card. It is built for ISS-45.

## Where it lives

All of it is in `code/console/src/pages/calcstep/`.

| File | What it holds |
|---|---|
| `sourceFlags.ts` | The row types and `sourceFlag`, the pure function that works out the flag of a row |
| `SourcePicker.tsx` | The picker of one row: the four sources, a field for a fixed value |
| `InputsCard.tsx` | The card: a table of rows with Input, Where it comes from and Check |
| `sourceFlags.test.ts`, `InputsCard.test.tsx` | The tests |
| `../../journeys/inputsCard.walk.test.tsx` | The journey step that renders the rows of screen 2 and saves the page for the screenshot |

The card takes everything as props and fetches nothing. The page that mounts it is the assembly issue ISS-58.

## What the card takes

| Prop | Meaning |
|---|---|
| `rows` | One `InputRow` for each input: its name, its type and its chosen source, or `null` |
| `fits` | Optional. The rule that says whether a source of one type may fill an input of another. The default is that the two types are the same |
| `onChoose(input, kind)` | The builder chose a source kind for an input, or `null` for none |
| `onFixedValue(input, value)` | The builder typed a fixed value |

A type is one of currency, number, text, date and yes or no. A source is one of an answer from an earlier step (the step, the question, the question's type), a field of a record (the record, the question, the question's type), the member's ledger balance, and a fixed value.

## The flags

`sourceFlag(row, fits)` gives at most one flag, in this order:

1. No source: the row has no source, or its fixed value is blank.
2. Question reworded: the source is a question and the wording it is known by now differs from the wording the input was connected to. Inputs are never matched by name on their own, so a reworded question must not silently disconnect an input (compute-side decision 1).
3. Wrong type: the source has a type and `fits` refuses it for the input. The ledger balance is a currency. A fixed value has no type of its own and is never flagged for its type.

A row with no flag shows "Currency fits", "Number fits" and so on in the Check column. The flags are written in words in the Check column and, with the question or the source, under the picker. The four sources are listed as buttons under the picker while the input has none, which is the open picker of the drawing.

## Words

The words are the keys `calcstep.inputs.*` in `public/i18n.json`, in all seven languages. The sentence with the question's old and new wording is `noteReworded`. The type names are `calcstep.inputs.type.*`, and the phrase used in a source line, such as "a currency", is `calcstep.inputs.a.*`.

## What stays open

- The real rule of fit between an input's type and a source's type belongs to the library and its input checks. The card writes no rule of its own: its default is equal types, and `fits` lets the page pass the library's rule in. Whether a number input may take a currency answer is therefore not decided here.
- The drawing's red border on the picker of a flagged row is not drawn. The class is in the mockup styles and not in the console's, and this card adds no style. The flag in the Check column and the sentence under the picker carry the message.
- The picker chooses the kind of source. Choosing the step and question, or the record and question, needs the list of earlier steps and the questions of a record, which the page supplies; that list is not part of this card yet.
- None of the four open questions of the screen page is about this card.

## How it was checked

`npx vitest run src/pages/calcstep/sourceFlags.test.ts src/pages/calcstep/InputsCard.test.tsx src/journeys/inputsCard.walk.test.tsx` passes. A screenshot of the card at 1440 x 900, rendered through the journey test with the rows of screen 2, is in [iss-45/inputs-card-1440.png](../4.%20qa/walk-records/iss-45/inputs-card-1440.png). To make it again, run the journey test with `WALK_SHOTS` set to a folder and open the saved page in a browser at 1440 wide.
