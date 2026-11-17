# Console: the Try it card of the calculating step

The card where a builder types a sample value for each input of the function, presses Run on this sample, and sees either the result or one list with every problem found at once. Nothing is posted or saved by a sample run. It is drawn on screens 1 and 2 of [workflow-calculating-step.html](../2.%20design/mockups/console/agency/workflow-calculating-step.html), which the owner accepted on 2026-11-17, and described in [calculating-step-screen.md](../2.%20design/technical-spec/calculating-step-screen.md), section The Try it card. It is built for ISS-50.

## Where it lives

All of it is in `code/console/src/pages/calcstep/`.

| File | What it holds |
|---|---|
| `sampleRun.ts` | The types of a sample run and `runSample`, the module that calls the client and turns the answer into what the card shows |
| `TryItCard.tsx` | The card |
| `sampleRun.test.ts`, `TryItCard.test.tsx` | The tests, 9 and 11 cases |

The card takes everything as props and fetches nothing. The page that mounts it is the assembly issue ISS-58.

## What the card takes

| Prop | Meaning |
|---|---|
| `inputs` | The names of the function's inputs, in the order the function lists them |
| `initial` | Optional. The sample text to start from, by input name |
| `client` | The client that runs the sample, see the next section |

The card shows one box for each input, a Run on this sample button, and below it the answer. The button is off while a run is under way.

## The client the run needs

The call that runs a function on given values is not built yet, so the card never names a route. It is given a client with one method.

```
SampleClient = { run(values: { name: string; text: string }[]) -> Promise<SampleAnswer> }
SampleAnswer = { worked?: { label, value, function, rounding } } or { problems?: Problem[] }
```

- `run` receives the typed text of every input, in the order of `inputs`, with empty text for an input nobody typed in. It receives the text as typed and reads no number from it: reading it belongs to the library.
- A `worked` answer carries the label of the result, the result as text, the function written with its version (for example `fin.pmt@2`) and the name of the rounding rule used (for example `half up`).
- A `problems` answer is the list of the library's Validate problems, in the order the library gives, each in the shape of the problem record: `input`, `item`, `given`, `value`, `rule`, `sentence`, `code`, `check`. The record is described in `mwanachama-backend-compute`, documentation/3. implementation, problem.md. The card writes none of the sentences: it shows what comes back.
- The client has no method that saves or posts, and a test checks that nothing is kept in the browser after a run.

When the host's try-it runner exists (a separate issue), the client is a thin wrapper over its route. Until then the tests use a fake and the page uses a fixture.

## What the card shows

| Answer | Tag on the card | Body |
|---|---|---|
| none yet | none | the boxes and the button only |
| `worked` | Worked out | a tile with the label and the result, and under it the function with its version and the rounding rule, for example `fin.pmt@2, rounded half up` |
| `problems` | `3 problems`, or `1 problem` | a tile Nothing was worked out with the count, the sentence that every problem comes back at once, and a table with Input, Received and Problem, one row for each problem in the order given |
| the call failed | none | a notice, The sample could not be run |

- **Received** is the value exactly as the library returns it. When the input was not given at all it reads `nothing`. For a problem of a check there is no input, so the first column shows the check's text and the second column is empty.
- A new run replaces the old answer.
- What was typed stays on the screen only, and is never kept.

## Words

13 keys under `calcstep.tryit.` in `public/i18n.json`, written in the seven languages: `title`, `run`, `worked`, `nothing`, `problemOne`, `problemMany` (with `{n}`), `allAtOnce`, `how` (with `{function}` and `{rounding}`), `input`, `received`, `problem`, `nothingReceived` and `failed`. The name of the rounding rule is given by the client in words and is not translated here.

## Screenshots

Taken at 1440 x 900 from the real card, rendered with the fake client through the test harness and shot in headless Chrome against the console's own stylesheets: [the result](../4.%20qa/walk-records/iss-50/try-it-worked-1440.png) and [the problem list](../4.%20qa/walk-records/iss-50/try-it-problems-1440.png). They show the card alone, in a column 820 pixels wide. The screenshot of the whole assembled page is on ISS-58.

## What stays open

- Does the Try it card save the sample values? The page recommends no, and the card keeps them on the screen only. This is the owner's call and is open on the design page.
- The shape of an answer to an AI tool call is open on the engine side. This card reads only the problem list and the result.
- The drawing puts the function and rounding line inside the result tile. The shared `Tile` has no second line, so the line sits under the tile. Moving it inside needs a change to the shared `Tile`, which this issue does not own.
- The drawing has a play mark on the button. The shared icons have none, so the button has words only.
- Nothing has been added to a journey test. The walk of the whole page, with this card in it, belongs to the assembly issue ISS-58.
